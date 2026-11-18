namespace MiniQueue.ClusterLab;

internal sealed record TermEntry(int Term, string Value);

// Deterministic single-process model of selected Raft rules, not a networked Raft implementation.
internal sealed class ConsensusNode(string id, int term = 0, IEnumerable<TermEntry>? initial = null)
{
    public string Id { get; } = id;
    public int Term { get; private set; } = term;
    public string? VotedFor { get; private set; }
    public bool IsLeader { get; private set; }
    public List<TermEntry> Log { get; } = initial?.ToList() ?? [];
    public int CommitIndex { get; private set; }
    private readonly Dictionary<string, int> match = [];
    public int LastIndex => Log.Count;
    public int LastTerm => LastIndex == 0 ? 0 : Log[^1].Term;

    public void ObserveTerm(int term)
    {
        if (term <= Term) return;
        Term = term;
        VotedFor = null;
        IsLeader = false;
        match.Clear();
    }
    public bool Vote(int term, string candidate, int lastTerm, int lastIndex)
    {
        if (term < Term) return false;
        ObserveTerm(term);
        var upToDate = lastTerm > LastTerm || lastTerm == LastTerm && lastIndex >= LastIndex;
        if (!upToDate || VotedFor is not null && VotedFor != candidate) return false;
        VotedFor = candidate;
        return true;
    }
    public int BeginElection()
    {
        ObserveTerm(Term + 1);
        Check.That(Vote(Term, Id, LastTerm, LastIndex), "candidate votes for itself");
        return Term;
    }
    public void BecomeLeader(int votes, int total)
    {
        Check.That(votes > total / 2 && VotedFor == Id, "leadership requires majority votes");
        IsLeader = true;
        match.Clear();
        match[Id] = LastIndex;
    }
    public int AppendLocal(string value)
    {
        Check.That(IsLeader, "only the model's current leader may append");
        Log.Add(new TermEntry(Term, value));
        match[Id] = LastIndex;
        return LastIndex;
    }
    public bool AppendFrom(int term, int previousIndex, int previousTerm, IReadOnlyList<TermEntry> entries, int leaderCommit)
    {
        if (term < Term) return false;
        ObserveTerm(term);
        IsLeader = false;
        if (previousIndex > LastIndex || (previousIndex == 0 ? 0 : Log[previousIndex - 1].Term) != previousTerm) return false;
        for (var i = 0; i < entries.Count; i++)
        {
            var index = previousIndex + i + 1;
            if (index <= LastIndex && Log[index - 1].Term != entries[i].Term)
            {
                Check.That(index > CommitIndex, "cannot overwrite a committed prefix");
                Log.RemoveRange(index - 1, LastIndex - index + 1);
            }
            if (index > LastIndex) Log.Add(entries[i]);
            else Check.That(Log[index - 1] == entries[i], "same-term/index entries must agree in this model");
        }
        CommitIndex = Math.Max(CommitIndex, Math.Min(leaderCommit, previousIndex + entries.Count));
        return true;
    }
    public bool Replicate(ConsensusNode follower)
    {
        Check.That(IsLeader, "replication must start at leader");
        // Search backward for a shared prefix; no nextIndex optimization or transport is modeled.
        for (var previous = Math.Min(LastIndex, follower.LastIndex); previous >= 0; previous--)
        {
            var previousTerm = previous == 0 ? 0 : Log[previous - 1].Term;
            if (follower.AppendFrom(Term, previous, previousTerm, Log.Skip(previous).ToArray(), CommitIndex))
            {
                // An old extra suffix is not evidence that the follower has our future entries.
                match[follower.Id] = LastIndex;
                return true;
            }
            if (follower.Term > Term) { ObserveTerm(follower.Term); return false; }
        }
        return false;
    }
    public bool TryCommit(int index, int total)
    {
        if (!IsLeader || index <= CommitIndex || index > LastIndex) return false;
        if (Log[index - 1].Term != Term) return false;
        if (match.Values.Count(value => value >= index) <= total / 2) return false;
        CommitIndex = index;
        return true;
    }
}

internal sealed class ConsensusCluster(params ConsensusNode[] nodes)
{
    private readonly HashSet<(string, string)> blocked = [];
    public void Partition(string isolated)
    {
        blocked.Clear();
        foreach (var node in nodes.Where(n => n.Id != isolated))
        {
            blocked.Add((isolated, node.Id)); blocked.Add((node.Id, isolated));
        }
    }
    public void Heal() => blocked.Clear();
    public bool Connected(ConsensusNode a, ConsensusNode b) => !blocked.Contains((a.Id, b.Id));
    public bool Elect(ConsensusNode candidate)
    {
        var term = candidate.BeginElection();
        var votes = 1;
        foreach (var voter in nodes.Where(n => n != candidate && Connected(candidate, n)))
            if (voter.Vote(term, candidate.Id, candidate.LastTerm, candidate.LastIndex)) votes++;
        if (votes <= nodes.Length / 2) return false;
        candidate.BecomeLeader(votes, nodes.Length);
        return true;
    }
    public bool Replicate(ConsensusNode leader, ConsensusNode follower) => Connected(leader, follower) && leader.Replicate(follower);
}

internal static class ConsensusLab
{
    public static void Run()
    {
        var a = new ConsensusNode("A"); var b = new ConsensusNode("B"); var c = new ConsensusNode("C");
        var cluster = new ConsensusCluster(a, b, c);
        Check.That(cluster.Elect(a), "initial leader election");
        a.AppendLocal("base");
        Check.That(cluster.Replicate(a, b) && cluster.Replicate(a, c) && a.TryCommit(1, 3), "initial entry committed");
        Check.That(cluster.Replicate(a, b) && cluster.Replicate(a, c), "commit propagated");
        cluster.Partition("A");
        a.AppendLocal("isolated-unconfirmed");
        Check.That(!cluster.Replicate(a, b) && !a.TryCommit(2, 3), "isolated old leader cannot commit a new entry");
        Check.That(cluster.Elect(b), "B and C can elect term 2 leader");
        b.AppendLocal("majority-value");
        Check.That(cluster.Replicate(b, c) && b.TryCommit(2, 3), "majority current-term entry commits");
        Check.That(a.IsLeader && b.IsLeader, "old leader has not yet learned the newer term");
        Console.WriteLine("partition A|BC: A term1 still thinks leader, cannot commit; B term2 commits index2 with C");
        cluster.Heal();
        Check.That(!cluster.Replicate(a, b) && !a.IsLeader && a.Term == 2, "stale leader is rejected and steps down");
        Check.That(cluster.Replicate(b, a), "new leader repairs the old uncommitted suffix");
        Check.That(a.Log[1].Value == "majority-value" && a.CommitIndex == 2, "repair preserves committed majority value");
        Console.WriteLine("heal: stale term1 append rejected; A learns term2; uncommitted suffix replaced");

        var voter = new ConsensusNode("voter", 2, [new(1, "base"), new(2, "newer")]);
        Check.That(!voter.Vote(3, "stale", 1, 50), "higher index cannot overcome an older last term");
        Check.That(voter.Vote(3, "fresh", 2, 2), "up-to-date candidate may receive vote");
        Check.That(!voter.Vote(3, "another", 2, 2), "only one candidate per term");

        var x = new ConsensusNode("X", 3, [new(1, "base"), new(2, "old-term")]);
        var y = new ConsensusNode("Y", 3, [new(1, "base"), new(2, "old-term")]);
        var z = new ConsensusNode("Z", 3, [new(1, "base")]);
        var boundary = new ConsensusCluster(x, y, z);
        Check.That(boundary.Elect(x) && x.Term == 4, "new leader in term4");
        Check.That(boundary.Replicate(x, y), "old-term index2 exists on a majority");
        Check.That(!x.TryCommit(2, 3) && x.CommitIndex == 0, "cannot directly commit previous-term index2 by counting copies");
        x.AppendLocal("current-term-noop");
        Check.That(!x.TryCommit(3, 3), "a current-term entry still needs majority replication");
        Check.That(boundary.Replicate(x, y) && x.TryCommit(3, 3) && x.CommitIndex == 3, "current-term majority commits its prefix indirectly");
        Console.WriteLine("term4: index2/term2 majority is not direct commit; index3/term4 majority commits prefix through3");
        var heartbeat = new ConsensusNode("H", 4, [new(1, "base"), new(2, "extra")]);
        Check.That(heartbeat.AppendFrom(4, 1, 1, [], 2) && heartbeat.CommitIndex == 1,
            "empty heartbeat may commit only the prefix matched by this RPC, not a follower's extra suffix");

        var shortLeader = new ConsensusNode("S", 2, [new(2, "shared")]);
        var extraSuffix = new ConsensusNode("E", 2, [new(2, "shared"), new(2, "uncommitted")]);
        var peer = new ConsensusNode("P", 2, [new(2, "shared")]);
        var suffix = new ConsensusCluster(shortLeader, extraSuffix, peer);
        Check.That(suffix.Elect(shortLeader), "short candidate wins with equally fresh peer, without the longer follower's vote");
        Check.That(suffix.Replicate(shortLeader, extraSuffix), "heartbeat matches only index1 despite extra follower suffix");
        shortLeader.AppendLocal("new-index2");
        Check.That(!shortLeader.TryCommit(2, 3), "follower's extra old index2 cannot count for the new index2");
        Check.That(suffix.Replicate(shortLeader, extraSuffix) && shortLeader.TryCommit(2, 3), "new entry must actually replicate before commit");
        Console.WriteLine("PASS majority, partition, stale leader, log freshness, one vote, suffix repair, previous-term commit boundary, match prefix");
    }
}
