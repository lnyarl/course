using System.Text.Json;
using MiniQueue.Core;
using MiniQueue.Transport;

if (args.Length == 0) return Usage();
try
{
    switch (args[0])
    {
        case "verify":
            await TcpLab.VerifyAsync();
            WalLab.Verify();
            LeaseLab.Verify();
            Console.WriteLine("PASS chapters 02, 03, 04");
            return 0;
        case "tcp-verify":
            await TcpLab.VerifyAsync();
            return 0;
        case "wal-verify":
            WalLab.Verify();
            return 0;
        case "lease-verify":
            LeaseLab.Verify();
            return 0;
        case "serve" when args.Length is 1 or 2:
        {
            var port = args.Length == 2 ? ParsePort(args[1]) : 5055;
            using var stop = new CancellationTokenSource();
            ConsoleCancelEventHandler handler = (_, e) => { e.Cancel = true; stop.Cancel(); };
            Console.CancelKeyPress += handler;
            try { await TcpLab.ServeAsync(port, stop.Token); }
            catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
            finally { Console.CancelKeyPress -= handler; }
            return 0;
        }
        case "producer" when args.Length is 3 or 4:
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            var id = args.Length == 4 ? Guid.Parse(args[3]) : Guid.NewGuid();
            var request = new QueueRequest(Guid.NewGuid(), "Publish", id, args[2]);
            var response = await TcpLab.SendAsync(ParsePort(args[1]), request, timeout.Token);
            Console.WriteLine(JsonSerializer.Serialize(response));
            return response.Status == "Accepted" ? 0 : 1;
        }
        case "worker" when args.Length == 2:
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            var response = await TcpLab.SendAsync(ParsePort(args[1]), new(Guid.NewGuid(), "Pull"), timeout.Token);
            Console.WriteLine(JsonSerializer.Serialize(response));
            return 0;
        }
        case "wal-write" when args.Length == 3:
        {
            using var journal = new Journal(args[1]);
            if (journal.Entries.Any(e => e.Kind != "enqueue")) throw new InvalidOperationException("Use a chapter-3 enqueue-only WAL");
            var message = new Message(Guid.NewGuid(), args[2], DateTimeOffset.UtcNow);
            journal.Append(new("enqueue", message.Id, message));
            Console.WriteLine($"Accepted after Flush(true): {message.Id} {message.Payload}; records={journal.Entries.Count}");
            return 0;
        }
        case "wal-recover" when args.Length == 2:
        {
            using var journal = new Journal(args[1]);
            if (journal.Entries.Any(e => e.Kind != "enqueue")) throw new InvalidOperationException("Use lease-recover for a lease WAL");
            var ready = new QueueState();
            foreach (var record in journal.Entries)
                ready.Enqueue(record.Message ?? throw new InvalidDataException("Enqueue has no message"));
            Console.WriteLine($"Recovered ready={ready.ReadyCount}; repairedTailBytes={journal.RepairedTailBytes}");
            while (ready.TryDequeue(out var message)) Console.WriteLine($"{message.Id} {message.Payload}");
            return 0;
        }
        case "lease-seed" when args.Length == 2:
        {
            using var journal = new Journal(args[1]);
            if (journal.Entries.Count != 0) throw new InvalidOperationException("lease-seed needs a new, empty WAL path");
            var queue = new LeasedQueue(journal);
            queue.Publish(new(Guid.NewGuid(), "resize:completed-A", DateTimeOffset.UtcNow));
            var completed = queue.Pull(TimeSpan.FromMinutes(1))!;
            LabCheck.That(queue.Ack(completed.Message.Id, completed.Token), "seed ACK");
            queue.Publish(new(Guid.NewGuid(), "resize:unfinished-B", DateTimeOffset.UtcNow));
            var unfinished = queue.Pull(TimeSpan.FromMinutes(1))!;
            Console.WriteLine($"Before exit: ready={queue.ReadyCount} inFlight={queue.InFlightCount} done={queue.DoneCount}");
            Console.WriteLine($"Unacknowledged {unfinished.Message.Id} token={unfinished.Token}");
            return 0;
        }
        case "lease-recover" when args.Length == 2:
        {
            using var journal = new Journal(args[1]);
            var queue = new LeasedQueue(journal);
            Console.WriteLine($"After recovery: ready={queue.ReadyCount} inFlight={queue.InFlightCount} done={queue.DoneCount}");
            while (queue.Pull(TimeSpan.FromMinutes(1)) is { } delivery)
            {
                Console.WriteLine($"Redelivered {delivery.Message.Payload} attempt={delivery.Attempt} token={delivery.Token}");
                LabCheck.That(queue.Ack(delivery.Message.Id, delivery.Token), "recovered ACK");
            }
            Console.WriteLine($"After ACK: ready={queue.ReadyCount} inFlight={queue.InFlightCount} done={queue.DoneCount}");
            return 0;
        }
        default:
            return Usage();
    }
}
catch (Exception error) when (error is IOException or InvalidDataException or InvalidOperationException
    or ArgumentException or OverflowException or OperationCanceledException or System.Net.Sockets.SocketException)
{
    Console.Error.WriteLine($"{error.GetType().Name}: {error.Message}");
    return 1;
}

static int ParsePort(string text)
{
    if (!int.TryParse(text, out var port) || port is < 1 or > 65535)
        throw new ArgumentException("Port must be 1..65535");
    return port;
}

static int Usage()
{
    Console.Error.WriteLine("verify | tcp-verify | wal-verify | lease-verify | serve [port] | producer <port> <payload> [message-id] | worker <port> | wal-write <path> <payload> | wal-recover <path> | lease-seed <new-path> | lease-recover <path>");
    return 2;
}
