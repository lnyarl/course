namespace MiniQueue.Transport;

internal static class LabCheck
{
    public static void That(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }

    public static void Throws<T>(Action operation, string message) where T : Exception
    {
        try { operation(); }
        catch (T) { return; }
        throw new InvalidOperationException(message);
    }

    public static async Task ThrowsAsync<T>(Func<Task> operation, string message) where T : Exception
    {
        try { await operation(); }
        catch (T) { return; }
        throw new InvalidOperationException(message);
    }
}
