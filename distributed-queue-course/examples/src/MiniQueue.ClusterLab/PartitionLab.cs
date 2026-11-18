using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace MiniQueue.ClusterLab;

internal static class PartitionLab
{
    public static int Partition(string key, int count)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(count);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(key));
        return (int)(BinaryPrimitives.ReadUInt32BigEndian(bytes) % (uint)count);
    }

    public static void Run()
    {
        var keys = Enumerable.Range(1, 12).Select(i => $"photo-{i}").ToArray();
        var first = keys.Select(key => Partition(key, 4)).ToArray();
        Check.That(first.SequenceEqual(keys.Select(key => Partition(key, 4))), "routing must be repeatable");
        // Fixed known answers also catch an encoding or byte-order change.
        Check.That(first.SequenceEqual(new[] { 2, 0, 1, 0, 1, 2, 0, 2, 3, 2, 1, 3 }), "SHA-256 routing contract changed");
        var moved = keys.Where((key, i) => Partition(key, 5) != first[i]).ToArray();
        Check.That(moved.Length is > 0 and < 12, "expected a partial remap for this key set");
        foreach (var key in keys)
            Console.WriteLine($"route {key} P{Partition(key, 4)} -> P{Partition(key, 5)}");
        Console.WriteLine($"remap 4->5 moved={moved.Length}/12; old WALs have not moved");

        var a = keys[0];
        var other = keys.First(key => Partition(key, 4) != Partition(a, 4));
        var dispatcher = new PartitionDispatcher(4);
        dispatcher.Enqueue(new Work(a, 1));
        dispatcher.Enqueue(new Work(a, 2));
        dispatcher.Enqueue(new Work(other, 1));
        var owner = Partition(a, 4);
        var peer = Partition(other, 4);
        Check.That(dispatcher.TryStart(owner, out var a1) && a1 == new Work(a, 1), "A1 must start first");
        Check.That(!dispatcher.TryStart(owner, out _), "same-partition A2 must wait for A1");
        Check.That(dispatcher.TryStart(peer, out var b1), "another partition should make progress");
        Check.That(!dispatcher.Complete(owner, new Work(a, 2)), "a non-owner completion cannot release the lane");
        Check.That(dispatcher.Complete(peer, b1!), "peer completion");
        Check.That(dispatcher.Complete(owner, a1!), "A1 completion");
        Check.That(dispatcher.TryStart(owner, out var a2) && a2 == new Work(a, 2), "A2 starts after A1 completion");
        Check.That(dispatcher.Complete(owner, a2!), "A2 completion");
        Check.That(dispatcher.Completed.Where(w => w.Key == a).Select(w => w.Sequence).SequenceEqual(new[] { 1, 2 }), "key completion order");
        Console.WriteLine("ordering A1 start -> peer start/complete -> A1 complete -> A2 start/complete");
        Console.WriteLine("PASS stable routing, remap, same-key gate, independent partition, completion owner");
    }
}

internal sealed record Work(string Key, int Sequence);

// One active task per partition: stricter than per-key locking, with deliberate head-of-line blocking.
internal sealed class PartitionDispatcher(int count)
{
    private readonly Queue<Work>[] ready = Enumerable.Range(0, count).Select(_ => new Queue<Work>()).ToArray();
    private readonly Work?[] active = new Work?[count];
    public List<Work> Completed { get; } = [];
    public void Enqueue(Work work) => ready[PartitionLab.Partition(work.Key, count)].Enqueue(work);
    public bool TryStart(int partition, out Work? work)
    {
        work = null;
        if (active[partition] is not null || !ready[partition].TryDequeue(out work)) return false;
        active[partition] = work;
        return true;
    }
    public bool Complete(int partition, Work work)
    {
        if (active[partition] != work) return false;
        active[partition] = null;
        Completed.Add(work);
        return true;
    }
}
