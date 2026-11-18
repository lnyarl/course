namespace MiniQueue.WorkerLab;

public enum RetryStage { Waiting, Done, DeadLetter }
public enum FailureKind { Transient, Permanent }
public sealed record RetryState(Guid MessageId, string Payload, int Attempts, RetryStage Stage,
    long DueMilliseconds, string? LastError);

public sealed class RetryStore : IDisposable
{
    public const int MaximumAttempts = 5; // Includes the first execution.
    private readonly RecordLog<RetryState> log;
    private readonly Dictionary<Guid, RetryState> states = [];

    public RetryStore(string directory)
    {
        Directory.CreateDirectory(directory);
        log = new RecordLog<RetryState>(Path.Combine(directory, "retry.log"));
        foreach (var row in log.Records) states[row.MessageId] = row;
    }

    public RetryState Get(Guid id) => states[id];
    public RetryState Accept(Guid id, string payload, long now)
    {
        if (states.TryGetValue(id, out var old))
        {
            if (old.Payload != payload) throw new InvalidOperationException("MessageId payload conflict");
            return old;
        }
        return Save(new RetryState(id, payload, 0, RetryStage.Waiting, now, null));
    }

    public RetryState Fail(Guid id, long now, FailureKind kind, string error, Func<double> random)
    {
        var old = Due(id, now);
        int attempts = old.Attempts + 1;
        if (kind == FailureKind.Permanent || attempts >= MaximumAttempts)
            return Save(old with { Attempts = attempts, Stage = RetryStage.DeadLetter, LastError = error });
        long delay = FullJitter(attempts, random);
        return Save(old with { Attempts = attempts, DueMilliseconds = checked(now + delay), LastError = error });
    }

    public RetryState Succeed(Guid id, long now)
    {
        var old = Due(id, now);
        return Save(old with { Attempts = old.Attempts + 1, Stage = RetryStage.Done, LastError = null });
    }

    private RetryState Due(Guid id, long now)
    {
        var state = states[id];
        if (state.Stage != RetryStage.Waiting) throw new InvalidOperationException("Terminal work is not scheduled");
        if (now < state.DueMilliseconds) throw new InvalidOperationException("Retry is not due yet");
        return state;
    }

    public static long FullJitter(int failedAttempt, Func<double> random)
    {
        if (failedAttempt < 1) throw new ArgumentOutOfRangeException(nameof(failedAttempt));
        long cap = (long)Math.Min(30_000, 500 * Math.Pow(2, Math.Min(failedAttempt - 1, 20)));
        double sample = random();
        if (!double.IsFinite(sample) || sample is < 0 or >= 1)
            throw new ArgumentOutOfRangeException(nameof(random));
        return (long)(sample * (cap + 1)); // Uniform integer in [0, cap].
    }

    private RetryState Save(RetryState row)
    {
        log.Append(row); // Schedule/DLQ transition is durable before it becomes visible.
        states[row.MessageId] = row;
        return row;
    }

    public void Dispose() => log.Dispose();
}
