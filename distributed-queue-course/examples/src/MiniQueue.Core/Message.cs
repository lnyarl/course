namespace MiniQueue.Core;

public sealed record Message(Guid Id, string Payload, DateTimeOffset EnqueuedAt);
