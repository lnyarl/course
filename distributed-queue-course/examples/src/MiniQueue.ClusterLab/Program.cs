using MiniQueue.ClusterLab;

if (args.Length != 1 || args[0] is not ("partition" or "replication" or "consensus" or "verify"))
{
    Console.Error.WriteLine("Usage: partition | replication | consensus | verify");
    return 2;
}
try
{
    if (args[0] is "partition" or "verify") PartitionLab.Run();
    if (args[0] is "replication" or "verify") ReplicationLab.Run();
    if (args[0] is "consensus" or "verify") ConsensusLab.Run();
    Console.WriteLine($"PASS {args[0]}");
    return 0;
}
catch (Exception error)
{
    Console.Error.WriteLine($"FAIL {error.Message}");
    return 1;
}

namespace MiniQueue.ClusterLab
{
    internal static class Check
    {
        public static void That(bool condition, string message)
        {
            if (!condition) throw new InvalidOperationException(message);
        }
    }
}
