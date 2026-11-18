using System.Diagnostics;
using System.Reflection;
using System.Threading.Channels;
using MiniQueue.WorkerLab;

internal static class Program
{
    private static readonly Guid MessageId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public static async Task<int> Main(string[] args)
    {
        try
        {
            if (args.Length == 2 && args[0] == "commit-before-ack")
            {
                using var store = new ResultStore(args[1]);
                store.Apply(MessageId, "resize:photo-1", () => "photo-1:640x480");
                Console.WriteLine("durable result committed; exit before ACK");
                Environment.Exit(73); // A real child process ends after Flush(true), without sending an ACK.
            }
            if (args.Length is < 1 or > 2 || args[0] is not ("verify" or "idempotency" or "retry" or "drain"))
            {
                Console.Error.WriteLine("Usage: verify|idempotency|retry|drain [state-root]");
                return 2;
            }
            string root = Path.Combine(args.Length == 2 ? Path.GetFullPath(args[1]) : Path.GetTempPath(),
                "miniqueue-worker-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(root);
            Console.WriteLine("State directory: " + root);
            if (args[0] is "verify" or "idempotency") await Idempotency(Path.Combine(root, "results"));
            if (args[0] is "verify" or "retry") Retry(Path.Combine(root, "retry"));
            if (args[0] is "verify" or "drain") await Drain();
            Console.WriteLine("PASS " + args[0]);
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("FAIL " + error);
            return 1;
        }
    }

    private static async Task Idempotency(string directory)
    {
        var childStart = new ProcessStartInfo(Environment.ProcessPath ?? throw new InvalidOperationException("Missing host path"))
        { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
        if (Path.GetFileNameWithoutExtension(Environment.ProcessPath).Equals("dotnet", StringComparison.OrdinalIgnoreCase))
            childStart.ArgumentList.Add(Assembly.GetExecutingAssembly().Location);
        childStart.ArgumentList.Add("commit-before-ack");
        childStart.ArgumentList.Add(directory);
        using var child = Process.Start(childStart) ?? throw new InvalidOperationException("Child did not start");
        Task<string> stdout = child.StandardOutput.ReadToEndAsync(), stderr = child.StandardError.ReadToEndAsync();
        await child.WaitForExitAsync();
        Check(child.ExitCode == 73, "worker must end after commit and before ACK: " + await stderr);
        Console.Write(await stdout);

        Guid staleToken = Guid.NewGuid(), currentToken = Guid.NewGuid();
        var redelivery = new DeliveryAttempt(MessageId, currentToken);
        int calculations = 0;
        using (var store = new ResultStore(directory))
        {
            Throws<IOException>(() => { using var competing = new ResultStore(directory); });
            for (int i = 0; i < 10; i++)
            {
                var duplicate = store.Apply(MessageId, "resize:photo-1", () => { calculations++; return "unexpected"; });
                Check(!duplicate.Applied && duplicate.Result == "photo-1:640x480", "replay must return the committed result");
            }
            Check(store.Count == 1 && calculations == 0, "10 redeliveries must not repeat the local effect");
            Throws<InvalidOperationException>(() => store.Apply(MessageId, "different-payload", () => "bad"));
            Throws<IOException>(() => store.Apply(Guid.NewGuid(), "failing", () => throw new IOException("result calculation failed")));
            Check(store.Count == 1, "failed calculation must not leave a dedup marker");
        }
        Check(!redelivery.Ack(MessageId, staleToken) && !redelivery.Done, "stale delivery ACK must fail");
        Check(redelivery.Ack(MessageId, currentToken) && redelivery.Done, "ACK only the current delivery after local commit");
        using (var reopened = new ResultStore(directory)) Check(reopened.Count == 1, "result survives reopen");
        Console.WriteLine("PASS worker exit -> reopen -> 10 redeliveries: result=1; old ACK rejected, current ACK accepted");

        // Cut a second record in its body. Only the first complete commit may replay.
        string torn = directory + "-torn";
        using (var store = new ResultStore(torn))
        {
            store.Apply(MessageId, "first", () => "first-result");
            store.Apply(Guid.NewGuid(), "second", () => "second-result");
        }
        using (var file = new FileStream(Path.Combine(torn, "results.log"), FileMode.Open, FileAccess.Write))
            file.SetLength(file.Length - 3);
        using (var recovered = new ResultStore(torn)) Check(recovered.Count == 1, "incomplete final result cannot mark the ID processed");
        string corrupt = directory + "-corrupt";
        Directory.CreateDirectory(corrupt);
        byte[] damaged = File.ReadAllBytes(Path.Combine(directory, "results.log"));
        damaged[68] ^= 1; // Complete record, damaged body: never silently skip it.
        File.WriteAllBytes(Path.Combine(corrupt, "results.log"), damaged);
        Throws<InvalidDataException>(() => { using var invalid = new ResultStore(corrupt); });
        Console.WriteLine("PASS incomplete tail discarded; complete checksum corruption rejected; failed result leaves no marker");
    }

    private static void Retry(string directory)
    {
        Guid transient = MessageId, permanent = Guid.Parse("00000000-0000-0000-0000-000000000002");
        var random = new Random(7);
        long now = 0;
        using (var store = new RetryStore(directory))
        {
            store.Accept(transient, "transient-work", now);
            store.Accept(permanent, "bad-input", now);
            var dead = store.Fail(permanent, now, FailureKind.Permanent, "invalid payload", () => throw new InvalidOperationException("must not jitter a permanent failure"));
            Check(dead.Stage == RetryStage.DeadLetter && dead.Attempts == 1, "permanent failure moves directly to DLQ");
            Throws<InvalidOperationException>(() => store.Fail(permanent, now, FailureKind.Transient, "again", random.NextDouble));
            for (int attempt = 1; attempt <= RetryStore.MaximumAttempts; attempt++)
            {
                var state = store.Fail(transient, now, FailureKind.Transient, "dependency unavailable", random.NextDouble);
                Check(state.Attempts == attempt, "first execution counts as attempt one");
                if (attempt == RetryStore.MaximumAttempts)
                    Check(state.Stage == RetryStage.DeadLetter, "fifth failure must enter DLQ");
                else
                {
                    long cap = Math.Min(30_000, 500L << (attempt - 1));
                    Check(state.DueMilliseconds - now >= 0 && state.DueMilliseconds - now <= cap, "jitter outside cap");
                    Throws<InvalidOperationException>(() => store.Fail(transient, state.DueMilliseconds - 1, FailureKind.Transient, "too early", random.NextDouble));
                    Console.WriteLine($"virtual t={now} attempt={attempt} delay={state.DueMilliseconds - now}ms cap={cap}ms");
                    now = state.DueMilliseconds;
                }
            }
        }
        using (var resumed = new RetryStore(directory))
        {
            Check(resumed.Get(transient).Attempts == 5 && resumed.Get(transient).Stage == RetryStage.DeadLetter, "DLQ must survive reopen");
            Check(resumed.Get(permanent).LastError == "invalid payload", "DLQ reason must survive reopen");
            Throws<InvalidOperationException>(() => resumed.Succeed(transient, now));
            var success = Guid.NewGuid();
            resumed.Accept(success, "succeeds", now);
            Check(resumed.Succeed(success, now).Stage == RetryStage.Done, "successful attempt must stop scheduling");
        }
        string pending = directory + "-pending";
        using (var store = new RetryStore(pending))
        {
            store.Accept(transient, "wait", 0);
            Check(store.Fail(transient, 0, FailureKind.Transient, "wait", () => 0.5).DueMilliseconds == 250, "fixed sample is reproducible");
        }
        using (var resumed = new RetryStore(pending))
        {
            Throws<InvalidOperationException>(() => resumed.Succeed(transient, 249));
            Check(resumed.Succeed(transient, 250).Attempts == 2, "pending schedule must survive reopen");
        }
        var a = new Random(7); var b = new Random(7);
        for (int i = 1; i <= 20; i++)
            Check(RetryStore.FullJitter(i, a.NextDouble) == RetryStore.FullJitter(i, b.NextDouble), "same seed must repeat delays");
        Check(RetryStore.FullJitter(1, () => 0) == 0, "full jitter includes zero");
        Check(RetryStore.FullJitter(20, () => 0.999999) == 30_000, "jitter cap stays at 30 seconds");
        Throws<ArgumentOutOfRangeException>(() => RetryStore.FullJitter(1, () => 1));
        Console.WriteLine("PASS full jitter; maxAttempts=5 including first; permanent=DLQ after 1; durable pending/DLQ replay; terminal work not rescheduled");
    }

    private static async Task Drain()
    {
        var channel = Channel.CreateBounded<int>(new BoundedChannelOptions(2)
        { FullMode = BoundedChannelFullMode.Wait, SingleReader = true, SingleWriter = false });
        await channel.Writer.WriteAsync(1);
        await channel.Writer.WriteAsync(2);
        Task third = channel.Writer.WriteAsync(3).AsTask();
        Check(!third.IsCompleted && channel.Reader.Count == 2, "full queue must keep the third producer waiting");
        using var cancel = new CancellationTokenSource();
        Task canceled = channel.Writer.WriteAsync(4, cancel.Token).AsTask();
        cancel.Cancel();
        await ThrowsAsync<OperationCanceledException>(async () => await canceled);
        Console.WriteLine("capacity=2 ready=2 pending=1 canceled-before-accept=1");

        var processed = new List<int>();
        Task worker = Task.Run(async () =>
        {
            await foreach (int item in channel.Reader.ReadAllAsync())
            {
                await Task.Yield(); // An asynchronous handler; one owner updates processed.
                processed.Add(item);
            }
        });
        await third; // Accepted means enqueued. It does not mean the handler completed.
        channel.Writer.TryComplete(); // Stop admission, then let accepted work drain.
        await worker.WaitAsync(TimeSpan.FromSeconds(10));
        Check(processed.SequenceEqual([1, 2, 3]), "drain must finish exactly the three accepted items in FIFO order");
        Check(!processed.Contains(4), "canceled waiting write must not be accepted");
        await ThrowsAsync<ChannelClosedException>(async () => await channel.Writer.WriteAsync(5));
        await channel.Reader.Completion;
        Console.WriteLine("PASS stopped admission -> drained 3 accepted items -> worker ended; write after completion rejected");
    }

    private static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
    private static void Throws<T>(Action action) where T : Exception
    {
        try { action(); }
        catch (T) { return; }
        throw new InvalidOperationException("Expected " + typeof(T).Name);
    }
    private static async Task ThrowsAsync<T>(Func<Task> action) where T : Exception
    {
        try { await action(); }
        catch (T) { return; }
        throw new InvalidOperationException("Expected " + typeof(T).Name);
    }
}
