using System.Text;
using System.Text.Json;

namespace MiniQueue.ClusterLab;

internal sealed record LogEntry(int Index, int Term, string Kind, string MessageId);
internal sealed record AppendBatch(int PreviousIndex, int PreviousTerm, LogEntry[] Entries);

// Fixed leader, no elections. A memory-received batch is separate from a flushed WAL prefix.
internal sealed class WalReplica(string path)
{
    public List<LogEntry> Durable { get; } = [];
    public int LastIndex => Durable.Count;
    public int TermAt(int index) => index == 0 ? 0 : Durable[index - 1].Term;
    public bool AppendAndFlush(AppendBatch batch)
    {
        if (batch.PreviousIndex != LastIndex || batch.PreviousTerm != TermAt(LastIndex)) return false;
        if (batch.Entries.Where((entry, i) => entry.Index != LastIndex + i + 1).Any()) return false;
        using var file = new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.Read);
        foreach (var entry in batch.Entries)
            file.Write(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(entry) + "\n"));
        file.Flush(flushToDisk: true);
        Durable.AddRange(batch.Entries);
        return true;
    }
    public void Reload()
    {
        Durable.Clear();
        if (File.Exists(path))
            Durable.AddRange(File.ReadLines(path).Select(line => JsonSerializer.Deserialize<LogEntry>(line)!));
    }
    public void LoseDisk()
    {
        File.Delete(path);
        Durable.Clear();
    }
}

internal sealed class StaticReplication(string directory)
{
    public WalReplica[] Nodes { get; } = Enumerable.Range(0, 3)
        .Select(i => new WalReplica(Path.Combine(directory, $"node-{i}.jsonl"))).ToArray();
    private readonly Dictionary<int, AppendBatch> received = [];
    public bool Connected { get; set; } = true;
    public bool LeaderAlive { get; private set; } = true;
    public int Append(string kind, string id)
    {
        Check.That(LeaderAlive, "leader unavailable");
        var leader = Nodes[0];
        var entry = new LogEntry(leader.LastIndex + 1, 1, kind, id);
        Check.That(leader.AppendAndFlush(new AppendBatch(leader.LastIndex, leader.TermAt(leader.LastIndex), [entry])), "local append");
        return entry.Index;
    }
    public bool CanConfirm(int index, int requiredCopies)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(requiredCopies, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(requiredCopies, 3);
        return LeaderAlive && index > 0 && Nodes.Count(n => n.LastIndex >= index) >= requiredCopies;
    }
    public bool Receive(int follower)
    {
        if (!Connected || !LeaderAlive) return false;
        var target = Nodes[follower];
        received[follower] = new AppendBatch(target.LastIndex, target.TermAt(target.LastIndex),
            Nodes[0].Durable.Skip(target.LastIndex).ToArray());
        return true;
    }
    public bool Flush(int follower)
    {
        if (!received.Remove(follower, out var batch)) return false;
        // A queued delivery may be flushed after a link closes; its receipt already happened.
        return Nodes[follower].AppendAndFlush(batch);
    }
    public void LoseLeaderDisk()
    {
        Nodes[0].LoseDisk();
        LeaderAlive = false;
    }
    public static Dictionary<string, string> Replay(IEnumerable<LogEntry> entries)
    {
        var state = new Dictionary<string, string>();
        foreach (var entry in entries) state[entry.MessageId] = entry.Kind == "Ack" ? "Done" : "Ready";
        return state;
    }
}

internal static class ReplicationLab
{
    public static void Run()
    {
        var directory = Path.Combine(Path.GetTempPath(), "miniqueue-cluster-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        try
        {
            var localDir = Path.Combine(directory, "local"); Directory.CreateDirectory(localDir);
            var local = new StaticReplication(localDir);
            var localIndex = local.Append("Enqueue", "local-M1");
            Check.That(local.CanConfirm(localIndex, 1), "local flush permits local confirmation");
            Check.That(!local.CanConfirm(localIndex, 2), "local-only is not quorum");
            local.LoseLeaderDisk();
            Check.That(local.Nodes.All(n => n.LastIndex == 0), "local-confirmed data is lost with leader disk");
            Console.WriteLine("local ACK=true -> leader disk loss -> survivingCopies=0");

            var quorumDir = Path.Combine(directory, "quorum"); Directory.CreateDirectory(quorumDir);
            var cluster = new StaticReplication(quorumDir);
            var index = cluster.Append("Enqueue", "M1");
            Check.That(cluster.Receive(1), "receive follower 1");
            Check.That(!cluster.CanConfirm(index, 2), "memory receipt is not durable confirmation");
            Check.That(cluster.Flush(1) && cluster.CanConfirm(index, 2), "follower flush makes two durable copies");
            Console.WriteLine("quorum after receive=false; after follower Flush(true)=true");
            cluster.Connected = false;
            var pending = cluster.Append("Enqueue", "M2");
            Check.That(!cluster.Receive(2) && !cluster.CanConfirm(pending, 2), "isolated leader cannot quorum-confirm new data");
            cluster.Connected = true;
            var ack = cluster.Append("Ack", "M1");
            Check.That(cluster.Receive(2) && cluster.Flush(2), "lagging follower catches up whole prefix");
            Check.That(cluster.Nodes[2].Durable.Select(e => e.Index).SequenceEqual(new[] { 1, 2, 3 }), "catch-up has contiguous indices");
            Check.That(cluster.CanConfirm(ack, 2), "ACK transition is quorum-replicated too");
            Check.That(!cluster.Nodes[2].AppendAndFlush(new AppendBatch(3, 99, [])), "wrong previous term must be rejected");
            cluster.Nodes[2].Reload();
            Check.That(StaticReplication.Replay(cluster.Nodes[2].Durable)["M1"] == "Done", "reloaded ACK must prevent resurrection");
            Check.That(StaticReplication.Replay(cluster.Nodes[2].Durable)["M2"] == "Ready", "other message remains ready");
            cluster.LoseLeaderDisk();
            Check.That(cluster.Nodes[2].LastIndex == 3, "quorum-confirmed prefix survives one disk loss");
            Console.WriteLine("catch-up follower2 indices=1,2,3; replay M1=Done M2=Ready; leader disk loss leaves prefix");
            Console.WriteLine("PASS local/quorum ACK, receive/flush boundary, partition, catch-up, previous-term mismatch, ACK replay");
        }
        finally { Directory.Delete(directory, recursive: true); }
    }
}
