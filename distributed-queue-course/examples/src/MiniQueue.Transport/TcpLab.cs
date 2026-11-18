using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using MiniQueue.Core;

namespace MiniQueue.Transport;

public sealed record QueueRequest(Guid RequestId, string Command, Guid? MessageId = null, string? Payload = null);
public sealed record QueueResponse(Guid RequestId, string Status, Message? Message = null);

public static class TcpLab
{
    public static async Task ServeAsync(int port, CancellationToken cancellation)
    {
        var listener = new TcpListener(IPAddress.Loopback, port);
        listener.Start();
        Console.WriteLine($"Broker listening on 127.0.0.1:{((IPEndPoint)listener.LocalEndpoint).Port}");
        try { await RunBrokerAsync(listener, cancellation); }
        finally { listener.Stop(); }
    }

    // This chapter deliberately gives one owner the state and one connection at a time.
    // Producer closes its connection before Worker connects. Chapter 7 adds concurrency.
    public static async Task RunBrokerAsync(TcpListener listener, CancellationToken cancellation)
    {
        var queue = new QueueState();
        while (!cancellation.IsCancellationRequested)
        {
            using var client = await listener.AcceptTcpClientAsync(cancellation);
            using var stream = client.GetStream();
            try
            {
                while (await FrameCodec.ReadAsync(stream, cancellation) is { } body)
                {
                    var request = JsonSerializer.Deserialize<QueueRequest>(body)
                        ?? throw new InvalidDataException("JSON request is null");
                    var response = Apply(queue, request);
                    await FrameCodec.WriteAsync(stream, JsonSerializer.SerializeToUtf8Bytes(response), cancellation);
                }
            }
            catch (Exception error) when (error is IOException or JsonException)
            {
                // Invalid/incomplete input closes this connection without acknowledging it.
                Console.Error.WriteLine($"Connection closed: {error.GetType().Name}");
            }
        }
    }

    private static QueueResponse Apply(QueueState queue, QueueRequest request)
    {
        if (request.RequestId == Guid.Empty) return new(request.RequestId, "InvalidRequest");
        if (request.Command == "Publish" && request.MessageId is { } id && id != Guid.Empty
            && request.Payload is { } payload)
        {
            var message = new Message(id, payload, DateTimeOffset.UtcNow);
            queue.Enqueue(message);
            return new(request.RequestId, "Accepted", message);
        }
        if (request.Command == "Pull")
            return queue.TryDequeue(out var message)
                ? new(request.RequestId, "Delivered", message) : new(request.RequestId, "Empty");
        // Ack is introduced only with an actual lease in chapter 4.
        return new(request.RequestId, "UnsupportedOrInvalid");
    }

    public static async Task<QueueResponse> SendAsync(int port, QueueRequest request, CancellationToken cancellation)
    {
        using var client = new TcpClient();
        await client.ConnectAsync(IPAddress.Loopback, port, cancellation);
        using var stream = client.GetStream();
        await FrameCodec.WriteAsync(stream, JsonSerializer.SerializeToUtf8Bytes(request), cancellation);
        var body = await FrameCodec.ReadAsync(stream, cancellation)
            ?? throw new EndOfStreamException("Broker closed before its response");
        var response = JsonSerializer.Deserialize<QueueResponse>(body)
            ?? throw new InvalidDataException("JSON response is null");
        if (response.RequestId != request.RequestId) throw new InvalidDataException("RequestId mismatch");
        return response;
    }

    public static async Task VerifyAsync()
    {
        var a = FrameCodec.Encode("A"u8);
        var b = FrameCodec.Encode("BC"u8);
        // Socket writes need not create read boundaries. This wrapper guarantees short reads.
        await using (var split = new ShortReadStream(a.Concat(b).ToArray(), maximumRead: 1))
        {
            LabCheck.That((await FrameCodec.ReadAsync(split))!.SequenceEqual("A"u8.ToArray()), "split header/body A");
            LabCheck.That((await FrameCodec.ReadAsync(split))!.SequenceEqual("BC"u8.ToArray()), "batched second frame");
            LabCheck.That(await FrameCodec.ReadAsync(split) is null, "clean EOF between frames");
        }
        foreach (var tail in new[] { a[..2], a[..4], b[..^1] })
            await LabCheck.ThrowsAsync<EndOfStreamException>(async () =>
                await FrameCodec.ReadAsync(new MemoryStream(tail)), "partial header/body rejected");
        foreach (var length in new[] { -1, 0, FrameCodec.MaximumBodyLength + 1 })
        {
            var header = new byte[4];
            System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(header, length);
            await LabCheck.ThrowsAsync<InvalidDataException>(async () =>
                await FrameCodec.ReadAsync(new MemoryStream(header)), "invalid length rejected before body");
        }
        using (var cancelled = new CancellationTokenSource())
        {
            cancelled.Cancel();
            await LabCheck.ThrowsAsync<OperationCanceledException>(async () =>
                await FrameCodec.ReadAsync(new MemoryStream(a), cancelled.Token), "read observes cancellation");
        }
        Console.WriteLine("PASS codec: one-byte reads, batched frames, clean/partial EOF, length bounds, cancellation");

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var broker = RunBrokerAsync(listener, timeout.Token);
        try
        {
            var first = new QueueRequest(Guid.NewGuid(), "Publish", Guid.NewGuid(), "resize:photo-A");
            var second = new QueueRequest(Guid.NewGuid(), "Publish", Guid.NewGuid(), "resize:photo-B");
            using (var producer = new TcpClient())
            {
                await producer.ConnectAsync(IPAddress.Loopback, port, timeout.Token);
                using var stream = producer.GetStream();
                var bytes = FrameCodec.Encode(JsonSerializer.SerializeToUtf8Bytes(first))
                    .Concat(FrameCodec.Encode(JsonSerializer.SerializeToUtf8Bytes(second))).ToArray();
                // Split one header across writes, then batch the remaining bytes of two frames.
                for (var i = 0; i < 3; i++) await stream.WriteAsync(bytes.AsMemory(i, 1), timeout.Token);
                await stream.WriteAsync(bytes.AsMemory(3), timeout.Token);
                producer.Client.Shutdown(SocketShutdown.Send); // Half-close output; still read both replies.
                foreach (var expected in new[] { first, second })
                {
                    var body = await FrameCodec.ReadAsync(stream, timeout.Token);
                    var reply = JsonSerializer.Deserialize<QueueResponse>(body!)!;
                    LabCheck.That(reply.RequestId == expected.RequestId && reply.Status == "Accepted", "publish response correlation");
                }
            }
            using (var incomplete = new TcpClient())
            {
                await incomplete.ConnectAsync(IPAddress.Loopback, port, timeout.Token);
                using var stream = incomplete.GetStream();
                await stream.WriteAsync(new byte[] { 0, 0 }, timeout.Token);
                incomplete.Client.Shutdown(SocketShutdown.Send);
                LabCheck.That(await FrameCodec.ReadAsync(stream, timeout.Token) is null, "partial socket header closes without a response");
            }
            foreach (var expected in new[] { first, second })
            {
                var reply = await SendAsync(port, new(Guid.NewGuid(), "Pull"), timeout.Token);
                LabCheck.That(reply.Status == "Delivered" && reply.Message?.Id == expected.MessageId, "TCP FIFO bridge");
            }
            LabCheck.That((await SendAsync(port, new(Guid.NewGuid(), "Pull"), timeout.Token)).Status == "Empty", "TCP empty response");
            Console.WriteLine("PASS loopback TCP: split writes + batched requests, half-close reads replies, partial EOF closes, FIFO and empty");
        }
        finally
        {
            timeout.Cancel();
            listener.Stop();
            try { await broker; }
            catch (OperationCanceledException) when (timeout.IsCancellationRequested) { }
            catch (SocketException) when (timeout.IsCancellationRequested) { }
        }
    }

    private sealed class ShortReadStream(byte[] bytes, int maximumRead) : MemoryStream(bytes)
    {
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
            => base.ReadAsync(buffer[..Math.Min(maximumRead, buffer.Length)], cancellationToken);
    }
}
