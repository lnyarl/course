using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text.Json;

namespace MiniQueue.WorkerLab;

// One cooperating .NET writer. Each record contains one complete state transition.
// Flush(true) is an OS/device durability request, not proof of power-loss survival.
public sealed class RecordLog<T> : IDisposable where T : class
{
    private const int HeaderSize = 68; // length + SHA256(length) + SHA256(body)
    private const int MaximumBody = 1_048_576;
    private readonly FileStream file;
    private bool poisoned;
    public List<T> Records { get; } = [];

    public RecordLog(string path)
    {
        file = new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        try { Recover(); }
        catch { file.Dispose(); throw; }
    }

    private void Recover()
    {
        long goodEnd = 0;
        while (file.Position < file.Length)
        {
            if (file.Length - file.Position < HeaderSize) break;
            var header = new byte[HeaderSize];
            file.ReadExactly(header);
            if (!SHA256.HashData(header.AsSpan(0, 4)).AsSpan().SequenceEqual(header.AsSpan(4, 32)))
                throw new InvalidDataException("Corrupt length checksum; preserve the log for investigation");
            int length = BinaryPrimitives.ReadInt32LittleEndian(header);
            if (length is < 1 or > MaximumBody)
                throw new InvalidDataException("Invalid record size");
            if (file.Length - file.Position < length) break; // Only an incomplete EOF tail is discarded.
            var body = new byte[length];
            file.ReadExactly(body);
            if (!SHA256.HashData(body).AsSpan().SequenceEqual(header.AsSpan(36, 32)))
                throw new InvalidDataException("Corrupt complete record; recovery stopped");
            Records.Add(JsonSerializer.Deserialize<T>(body) ?? throw new InvalidDataException("Null record"));
            goodEnd = file.Position;
        }
        if (goodEnd != file.Length) { file.SetLength(goodEnd); file.Flush(flushToDisk: true); }
        file.Position = file.Length;
    }

    public void Append(T value)
    {
        if (poisoned) throw new InvalidOperationException("Reopen the log after an uncertain write");
        byte[] body = JsonSerializer.SerializeToUtf8Bytes(value);
        if (body.Length is < 1 or > MaximumBody) throw new ArgumentOutOfRangeException(nameof(value));
        byte[] record = new byte[HeaderSize + body.Length];
        BinaryPrimitives.WriteInt32LittleEndian(record, body.Length);
        SHA256.HashData(record.AsSpan(0, 4)).CopyTo(record, 4);
        SHA256.HashData(body).CopyTo(record, 36);
        body.CopyTo(record, HeaderSize);
        try
        {
            file.Write(record);
            file.Flush(flushToDisk: true);
            Records.Add(value);
        }
        catch { poisoned = true; throw; } // No ACK; failure may still have left a complete record.
    }

    public void Dispose() => file.Dispose();
}
