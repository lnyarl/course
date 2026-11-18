using System.Diagnostics.CodeAnalysis;

namespace MiniQueue.Core;

// The broker must serialize calls to this state. The demo has one execution flow.
public sealed class QueueState
{
    private readonly Queue<Message> ready = new();

    public int ReadyCount => ready.Count;

    public void Enqueue(Message message) => ready.Enqueue(message);

    public bool TryDequeue([NotNullWhen(true)] out Message? message)
        => ready.TryDequeue(out message);
}
