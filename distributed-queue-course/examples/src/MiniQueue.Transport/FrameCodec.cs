using System.Buffers.Binary;

namespace MiniQueue.Transport;

// One reader and one serialized writer per connection. No concurrent writes.
public static class FrameCodec
{
    public const int MaximumBodyLength = 1_048_576;

    public static byte[] Encode(ReadOnlySpan<byte> body)
    {
        ValidateLength(body.Length);
        var frame = new byte[4 + body.Length];
        BinaryPrimitives.WriteInt32BigEndian(frame, body.Length);
        body.CopyTo(frame.AsSpan(4));
        return frame;
    }

    public static async ValueTask<byte[]?> ReadAsync(Stream stream, CancellationToken cancellation = default)
    {
        var header = new byte[4];
        // EOF before the next header is an orderly end, not a truncated frame.
        var first = await stream.ReadAsync(header.AsMemory(0, 1), cancellation);
        if (first == 0) return null;
        await stream.ReadExactlyAsync(header.AsMemory(1), cancellation);
        var length = BinaryPrimitives.ReadInt32BigEndian(header);
        ValidateLength(length); // Before allocating the body.
        var body = new byte[length];
        await stream.ReadExactlyAsync(body, cancellation);
        return body;
    }

    public static async ValueTask WriteAsync(Stream stream, byte[] body, CancellationToken cancellation = default)
        => await stream.WriteAsync(Encode(body), cancellation);

    private static void ValidateLength(int length)
    {
        if (length is < 1 or > MaximumBodyLength)
            throw new InvalidDataException($"Frame body length must be 1..{MaximumBodyLength}: {length}");
    }
}
