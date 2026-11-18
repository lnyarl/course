using MiniQueue.Core;

namespace MiniQueue.Transport;

public sealed record Delivery(Message Message, Guid Token, int Attempt);

// All commands and expiry checks belong to one owner. This is not thread-safe.
public sealed class LeasedQueue
{
    private sealed class Work(Message message)
    {
        public Message Message { get; } = message;
        public bool Done { get; set; }
        public int Attempt { get; set; }
        public Guid? RecordedToken { get; set; }
    }
    private sealed record Lease(Delivery Delivery, long StartedAt, TimeSpan Duration);
    private readonly QueueState ready = new();
    private readonly Dictionary<Guid, Work> work = new();
    private readonly Dictionary<Guid, Lease> inFlight = new();
    private readonly Journal journal;
    private readonly TimeProvider clock;
    public int ReadyCount => ready.ReadyCount;
    public int InFlightCount => inFlight.Count;
    public int DoneCount => work.Values.Count(x => x.Done);

    public LeasedQueue(Journal journal, TimeProvider? clock = null)
    {
        this.journal = journal;
        this.clock = clock ?? TimeProvider.System;
        var insertionOrder = new List<Guid>();
        foreach (var record in journal.Entries)
        {
            if (record.Kind == "enqueue")
            {
                if (record.Message is null || record.Message.Id != record.MessageId || work.ContainsKey(record.MessageId))
                    throw new InvalidDataException("Invalid or duplicate enqueue; chapter 5 defines publish deduplication");
                work.Add(record.MessageId, new Work(record.Message));
                insertionOrder.Add(record.MessageId);
                continue;
            }
            if (!work.TryGetValue(record.MessageId, out var item) || item.Done)
                throw new InvalidDataException("WAL transition has no pending message");
            if (record.Kind == "lease")
            {
                if (record.Token is not { } token || token == Guid.Empty || record.Attempt != item.Attempt + 1)
                    throw new InvalidDataException("Invalid lease transition");
                item.Attempt = record.Attempt;
                item.RecordedToken = token;
            }
            else if (record.Kind == "ack")
            {
                if (record.Token is null || record.Token != item.RecordedToken)
                    throw new InvalidDataException("ACK does not match recorded lease");
                item.Done = true;
            }
        }
        // Monotonic timestamps are local to this process and are never persisted.
        // On restart every unacknowledged message becomes Ready, in enqueue order.
        foreach (var id in insertionOrder)
            if (!work[id].Done) ready.Enqueue(work[id].Message);
    }

    public void Publish(Message message)
    {
        if (message.Id == Guid.Empty || work.ContainsKey(message.Id))
            throw new InvalidOperationException("Supply a new, non-empty message ID in this lab");
        journal.Append(new("enqueue", message.Id, message));
        work.Add(message.Id, new Work(message));
        ready.Enqueue(message);
    }

    public Delivery? Pull(TimeSpan duration)
    {
        if (duration <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(duration));
        Expire();
        if (!ready.TryDequeue(out var message)) return null;
        var item = work[message.Id];
        var delivery = new Delivery(message, Guid.NewGuid(), item.Attempt + 1);
        // If append/flush throws, the owner must stop. Restart replays the prior complete prefix.
        journal.Append(new("lease", message.Id, Token: delivery.Token, Attempt: delivery.Attempt));
        item.Attempt = delivery.Attempt;
        item.RecordedToken = delivery.Token;
        inFlight.Add(message.Id, new(delivery, clock.GetTimestamp(), duration));
        return delivery;
    }

    public int Expire()
    {
        var now = clock.GetTimestamp();
        var expired = inFlight.Where(pair => clock.GetElapsedTime(pair.Value.StartedAt, now) >= pair.Value.Duration)
            .Select(pair => pair.Key).ToArray();
        foreach (var id in expired)
        {
            inFlight.Remove(id);
            ready.Enqueue(work[id].Message);
        }
        return expired.Length;
    }

    public bool Ack(Guid messageId, Guid token)
    {
        Expire(); // Reject a late ACK even if a periodic expiry sweep has not run yet.
        if (!inFlight.TryGetValue(messageId, out var current) || current.Delivery.Token != token) return false;
        journal.Append(new("ack", messageId, Token: token));
        inFlight.Remove(messageId);
        work[messageId].Done = true;
        return true;
    }
}

public sealed class ManualClock : TimeProvider
{
    private long ticks;
    public override long TimestampFrequency => 1000;
    public override long GetTimestamp() => ticks;
    public void Advance(TimeSpan duration)
    {
        if (duration < TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(duration));
        ticks = checked(ticks + (long)duration.TotalMilliseconds);
    }
}

public static class LeaseLab
{
    public static void Verify()
    {
        var directory = Directory.CreateTempSubdirectory("miniqueue-lease-").FullName;
        try
        {
            var path = Path.Combine(directory, "queue.wal");
            var clock = new ManualClock();
            Guid doneId;
            Guid abandonedId;
            using (var journal = new Journal(path))
            {
                var queue = new LeasedQueue(journal, clock);
                var message = new Message(Guid.NewGuid(), "resize:photo-A", DateTimeOffset.UnixEpoch);
                doneId = message.Id;
                queue.Publish(message);
                var old = queue.Pull(TimeSpan.FromSeconds(5))!;
                clock.Advance(TimeSpan.FromMilliseconds(4999));
                LabCheck.That(queue.Expire() == 0 && queue.InFlightCount == 1, "lease not expired before deadline");
                clock.Advance(TimeSpan.FromMilliseconds(1));
                LabCheck.That(!queue.Ack(message.Id, old.Token), "exact deadline ACK must expire first");
                LabCheck.That(queue.ReadyCount == 1 && queue.InFlightCount == 0, "expired delivery returned to ready");
                var current = queue.Pull(TimeSpan.FromSeconds(5))!;
                LabCheck.That(current.Token != old.Token && current.Attempt == 2, "redelivery creates new token and attempt");
                LabCheck.That(!queue.Ack(message.Id, old.Token) && queue.InFlightCount == 1, "stale token cannot finish current lease");
                LabCheck.That(!queue.Ack(Guid.NewGuid(), current.Token), "message ID is part of ACK identity");
                LabCheck.That(queue.Ack(message.Id, current.Token), "current token ACK accepted after WAL flush");
                LabCheck.That(!queue.Ack(message.Id, current.Token), "duplicate ACK does not change state");
                var abandoned = new Message(Guid.NewGuid(), "resize:photo-B", DateTimeOffset.UnixEpoch);
                abandonedId = abandoned.Id;
                queue.Publish(abandoned);
                _ = queue.Pull(TimeSpan.FromMinutes(1));
                Console.WriteLine("PASS lease: before/exact expiry, redelivery attempt=2, stale token and wrong message rejected");
            }
            using (var recovered = new Journal(path))
            {
                var queue = new LeasedQueue(recovered, new ManualClock());
                LabCheck.That(queue.DoneCount == 1 && queue.ReadyCount == 1 && queue.InFlightCount == 0, "restart requeues only unacknowledged work");
                var delivery = queue.Pull(TimeSpan.FromSeconds(5))!;
                LabCheck.That(delivery.Message.Id == abandonedId && delivery.Message.Id != doneId && delivery.Attempt == 2, "durable ACK not redelivered; pending lease redelivered");
                LabCheck.That(queue.Ack(delivery.Message.Id, delivery.Token), "recovered work acknowledged");
            }
            using (var final = new Journal(path))
            {
                var queue = new LeasedQueue(final);
                LabCheck.That(queue.DoneCount == 2 && queue.Pull(TimeSpan.FromSeconds(5)) is null, "ACK survives second reopen");
            }
            Console.WriteLine("PASS lease WAL: durable ACK stays Done; unfinished lease returns Ready after reopen");
        }
        finally { Directory.Delete(directory, recursive: true); }
    }
}
