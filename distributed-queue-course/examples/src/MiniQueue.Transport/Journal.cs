using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text.Json;
using MiniQueue.Core;

namespace MiniQueue.Transport;

public sealed record LogEntry(string Kind, Guid MessageId, Message? Message = null, Guid? Token = null, int Attempt = 0);

// Educational WAL: [4-byte BE length][SHA256(length):32][SHA256(body):32][UTF-8 JSON].
// The digest detects changed bytes; it is not authentication or a proof of power-loss safety.
public sealed class Journal : IDisposable
{
    public const int HeaderSize = 68;
    private readonly FileStream file;
    private readonly List<LogEntry> entries = new();
    private bool faulted;
    public IReadOnlyList<LogEntry> Entries => entries;
    public long RepairedTailBytes { get; private set; }

    public Journal(string path)
    {
        file = new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        try { Recover(); }
        catch { file.Dispose(); throw; }
    }

    public static byte[] Encode(LogEntry entry)
    {
        var body = JsonSerializer.SerializeToUtf8Bytes(entry);
        if (body.Length is < 1 or > FrameCodec.MaximumBodyLength) throw new InvalidDataException("WAL record too large");
        var record = new byte[HeaderSize + body.Length];
        BinaryPrimitives.WriteInt32BigEndian(record, body.Length);
        SHA256.HashData(record.AsSpan(0, 4)).CopyTo(record.AsSpan(4, 32));
        SHA256.HashData(body).CopyTo(record.AsSpan(36, 32));
        body.CopyTo(record.AsSpan(HeaderSize));
        return record;
    }

    public void Append(LogEntry entry)
    {
        if (faulted) throw new InvalidOperationException("Journal failed; stop this owner and recover before using it again");
        var record = Encode(entry);
        try
        {
            file.Write(record);
            file.Flush(flushToDisk: true);
            entries.Add(entry);
        }
        catch
        {
            faulted = true;
            throw; // No success response or further state changes after a write/flush failure.
        }
    }

    private void Recover()
    {
        long lastGood = 0;
        var header = new byte[HeaderSize];
        while (file.Position < file.Length)
        {
            if (file.Length - file.Position < HeaderSize) { RepairTail(lastGood); break; }
            file.ReadExactly(header);
            // Check the length bytes before deciding whether an EOF tail is incomplete.
            if (!CryptographicOperations.FixedTimeEquals(header.AsSpan(4, 32), SHA256.HashData(header.AsSpan(0, 4))))
                throw new InvalidDataException($"WAL length checksum mismatch at offset {lastGood}; file is unchanged");
            var length = BinaryPrimitives.ReadInt32BigEndian(header);
            if (length is < 1 or > FrameCodec.MaximumBodyLength)
                throw new InvalidDataException($"Invalid WAL length at offset {lastGood}");
            if (file.Length - file.Position < length) { RepairTail(lastGood); break; }
            var body = new byte[length];
            file.ReadExactly(body);
            if (!CryptographicOperations.FixedTimeEquals(header.AsSpan(36, 32), SHA256.HashData(body)))
                throw new InvalidDataException($"WAL checksum mismatch at offset {lastGood}; file is unchanged");
            LogEntry entry;
            try { entry = JsonSerializer.Deserialize<LogEntry>(body) ?? throw new InvalidDataException("Null WAL record"); }
            catch (JsonException error) { throw new InvalidDataException($"Invalid WAL JSON at offset {lastGood}", error); }
            if (entry.MessageId == Guid.Empty || entry.Kind is not ("enqueue" or "lease" or "ack"))
                throw new InvalidDataException($"Unknown/invalid WAL record at offset {lastGood}");
            entries.Add(entry);
            lastGood = file.Position;
        }
        file.Position = file.Length;
    }

    private void RepairTail(long lastGood)
    {
        RepairedTailBytes = file.Length - lastGood;
        file.SetLength(lastGood);
        file.Flush(flushToDisk: true);
    }

    public void Dispose() => file.Dispose();
}

public static class WalLab
{
    public static void Verify()
    {
        var directory = Directory.CreateTempSubdirectory("miniqueue-wal-").FullName;
        try
        {
            var path = Path.Combine(directory, "queue.wal");
            var a = new Message(Guid.NewGuid(), "resize:photo-A", DateTimeOffset.UnixEpoch);
            var b = new Message(Guid.NewGuid(), "resize:photo-B", DateTimeOffset.UnixEpoch);
            using (var journal = new Journal(path))
            {
                journal.Append(new("enqueue", a.Id, a));
                journal.Append(new("enqueue", b.Id, b));
            }
            var persisted = File.ReadAllBytes(path);
            var firstLength = Journal.Encode(new("enqueue", a.Id, a)).Length;
            using (var recovered = new Journal(path))
                LabCheck.That(recovered.Entries.Select(e => e.MessageId).SequenceEqual(new[] { a.Id, b.Id }), "persisted WAL replay order");
            Console.WriteLine("PASS WAL: close and reopen persisted enqueue records in order");

            foreach (var cut in new[] { firstLength + 2, firstLength + 40, firstLength + Journal.HeaderSize + 2, persisted.Length - 1 })
            {
                File.WriteAllBytes(path, persisted[..cut]);
                using var repaired = new Journal(path);
                LabCheck.That(repaired.Entries.Count == 1 && repaired.Entries[0].MessageId == a.Id, "recover complete prefix only");
                LabCheck.That(repaired.RepairedTailBytes == cut - firstLength, "report partial tail size");
                repaired.Append(new("enqueue", b.Id, b));
            }
            using (var reopened = new Journal(path))
                LabCheck.That(reopened.Entries.Count == 2, "append follows repaired boundary");
            Console.WriteLine("PASS WAL: partial header/body/checksum tail truncated; append and second replay succeed");

            var damaged = persisted.ToArray();
            damaged[Journal.HeaderSize] ^= 1; // Complete first record is damaged; a later complete record still follows.
            File.WriteAllBytes(path, damaged);
            LabCheck.Throws<InvalidDataException>(() => { using var bad = new Journal(path); }, "checksum corruption must stop recovery");
            LabCheck.That(File.ReadAllBytes(path).SequenceEqual(damaged), "do not silently skip or truncate complete corruption");
            Console.WriteLine("PASS WAL: complete-record checksum corruption stops recovery without changing file");

            var badLength = persisted.ToArray();
            BinaryPrimitives.WriteInt32BigEndian(badLength, FrameCodec.MaximumBodyLength);
            File.WriteAllBytes(path, badLength);
            LabCheck.Throws<InvalidDataException>(() => { using var bad = new Journal(path); }, "in-range corrupted length must not masquerade as partial tail");
            LabCheck.That(File.ReadAllBytes(path).SequenceEqual(badLength), "length damage preserves complete log for inspection");
            Console.WriteLine("PASS WAL: changed in-range length is rejected before tail repair; complete file preserved");
        }
        finally { Directory.Delete(directory, recursive: true); }
    }
}
