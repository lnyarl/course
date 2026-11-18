namespace MiniQueue.WorkerLab;

public sealed record ResultCommit(Guid MessageId, string Payload, string Result);
public sealed record ApplyResult(bool Applied, string Result);

// Local output and the deduplication identity are the SAME durable record.
// The calculation callback must be pure; external HTTP/DB effects are outside this boundary.
public sealed class ResultStore : IDisposable
{
    private readonly RecordLog<ResultCommit> log;
    private readonly Dictionary<Guid, ResultCommit> committed = [];
    public int Count => committed.Count;

    public ResultStore(string directory)
    {
        Directory.CreateDirectory(directory);
        log = new RecordLog<ResultCommit>(Path.Combine(directory, "results.log"));
        try
        {
            foreach (var row in log.Records)
                if (!committed.TryAdd(row.MessageId, row))
                    throw new InvalidDataException("Repeated commit ID in result log");
        }
        catch { log.Dispose(); throw; }
    }

    public ApplyResult Apply(Guid id, string payload, Func<string> calculate)
    {
        if (committed.TryGetValue(id, out var old))
        {
            if (old.Payload != payload) throw new InvalidOperationException("MessageId reused with different payload");
            return new ApplyResult(false, old.Result);
        }
        string result = calculate(); // Failure here leaves neither a result nor a dedup marker.
        var commit = new ResultCommit(id, payload, result);
        log.Append(commit); // Commit both local output and dedup ID, then publish in memory.
        committed.Add(id, commit);
        return new ApplyResult(true, result);
    }

    public void Dispose() => log.Dispose();
}

public sealed class DeliveryAttempt(Guid messageId, Guid token)
{
    public Guid MessageId { get; } = messageId;
    public bool Done { get; private set; }
    public bool Ack(Guid id, Guid candidate)
    {
        if (id != MessageId || candidate != token || Done) return false;
        Done = true;
        return true;
    }
}
