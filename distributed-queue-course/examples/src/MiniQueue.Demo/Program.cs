using MiniQueue.Core;

if (args.Length != 1)
{
    Console.Error.WriteLine("Usage: verify | load | fail-after-dequeue");
    return 2;
}

switch (args[0])
{
    case "verify":
        VerifyFifo();
        RunLoad(trace: false);
        FailAfterDequeue();
        Console.WriteLine("PASS FIFO, empty queue, backlog and lost work");
        return 0;
    case "load":
        RunLoad(trace: true);
        return 0;
    case "fail-after-dequeue":
        FailAfterDequeue();
        return 0;
    default:
        Console.Error.WriteLine("Usage: verify | load | fail-after-dequeue");
        return 2;
}

static void VerifyFifo()
{
    var queue = new QueueState();
    var messages = new[] { "A", "B", "C" }
        .Select(payload => new Message(Guid.NewGuid(), payload, DateTimeOffset.UnixEpoch))
        .ToArray();

    Check(!queue.TryDequeue(out _), "new queue should be empty");
    foreach (var message in messages)
        queue.Enqueue(message);

    foreach (var expected in messages)
        Check(queue.TryDequeue(out var actual) && actual == expected, $"expected {expected.Payload}");

    Check(!queue.TryDequeue(out _) && queue.ReadyCount == 0, "queue should be empty after draining");
    Console.WriteLine("PASS A -> B -> C, then empty");
}

static void RunLoad(bool trace)
{
    const int arrivalsPerSecond = 12;
    const int workerCapacityPerSecond = 8;
    const int seconds = 10;
    var queue = new QueueState();
    var accepted = 0;
    var processed = 0;

    for (var tick = 1; tick <= seconds; tick++)
    {
        var now = DateTimeOffset.UnixEpoch.AddSeconds(tick);
        for (var i = 0; i < arrivalsPerSecond; i++)
        {
            accepted++;
            queue.Enqueue(new Message(Guid.NewGuid(), $"resize:photo-{accepted}", now));
        }

        var oldestWaitSeconds = 0;
        for (var i = 0; i < workerCapacityPerSecond && queue.TryDequeue(out var message); i++)
        {
            if (i == 0)
                oldestWaitSeconds = (int)(now - message.EnqueuedAt).TotalSeconds;
            processed++;
        }

        Check(accepted == processed + queue.ReadyCount, "queue accounting mismatch");
        if (trace)
            Console.WriteLine($"t={tick:D2} accepted={accepted} processed={processed} ready={queue.ReadyCount} oldestTakenWait={oldestWaitSeconds}s");
    }

    Check(accepted == 120 && processed == 80 && queue.ReadyCount == 40, "expected 40 queued after 10 seconds");
}

static void FailAfterDequeue()
{
    var queue = new QueueState();
    var results = new HashSet<Guid>();
    var message = new Message(Guid.NewGuid(), "resize:photo-failure", DateTimeOffset.UnixEpoch);
    queue.Enqueue(message);

    if (!queue.TryDequeue(out var dequeued) || dequeued != message)
        throw new InvalidOperationException("expected the accepted message");
    Console.WriteLine("accepted=1 taken=1");
    try
    {
        RecordResult(dequeued, results, failBeforeSave: true);
        throw new InvalidOperationException("expected a worker failure");
    }
    catch (IOException)
    {
        Console.WriteLine($"worker failed before saving; ready={queue.ReadyCount} results={results.Count}");
    }
    Check(queue.ReadyCount == 0 && !results.Contains(message.Id), "failed work is absent from both queue and results");
}

static void RecordResult(Message message, HashSet<Guid> results, bool failBeforeSave)
{
    if (failBeforeSave)
        throw new IOException("injected failure before saving");
    results.Add(message.Id);
}

static void Check(bool condition, string message)
{
    if (!condition)
        throw new InvalidOperationException(message);
}
