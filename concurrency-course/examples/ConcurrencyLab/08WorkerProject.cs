using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Channels;

namespace ConcurrencyLab;

internal static class Week08
{
    private sealed class TransientFailure : Exception { }
    private sealed record Job(int Id, long AcceptedAt);
    private sealed record Result(int Id, int Value);

    public static async Task Run(string? output)
    {
        await Compare();
        await WorkerProject(output);
        await CancellationScenario();
    }

    private static async Task Compare()
    {
        var watch = Stopwatch.StartNew();
        for (var i = 0; i < 6; i++) Thread.Sleep(20);
        Console.WriteLine($"I/O 순차: {watch.Elapsed.TotalMilliseconds:F1} ms");
        watch.Restart();
        Parallel.For(0, 6, new ParallelOptions { MaxDegreeOfParallelism = 3 }, _ => Thread.Sleep(20));
        Console.WriteLine($"I/O 블로킹 스레드 3개: {watch.Elapsed.TotalMilliseconds:F1} ms");
        using var slots = new SemaphoreSlim(3);
        watch.Restart();
        await Task.WhenAll(Enumerable.Range(0, 6).Select(async _ =>
        {
            await slots.WaitAsync();
            try { await Task.Delay(20); }
            finally { slots.Release(); }
        }));
        Console.WriteLine($"I/O 비동기 동시 3개: {watch.Elapsed.TotalMilliseconds:F1} ms");
        static long Cpu(int input)
        {
            long result = 0;
            for (var i = 0; i < input; i++) result += (long)i * i;
            return result;
        }
        watch.Restart();
        var expected = Enumerable.Range(0, 4).Select(_ => Cpu(120_000)).ToArray();
        Console.WriteLine($"CPU 순차: {watch.Elapsed.TotalMilliseconds:F1} ms");
        watch.Restart();
        var actual = new long[4];
        Parallel.For(0, 4, i => actual[i] = Cpu(120_000));
        Console.WriteLine($"CPU Parallel.For: {watch.Elapsed.TotalMilliseconds:F1} ms");
        Check.That(actual.SequenceEqual(expected), "CPU 결과 불일치");
        Console.WriteLine("짧은 작업은 스케줄링 비용이 더 클 수 있습니다. 한 번의 수치를 일반화하지 마세요.");
    }

    private static async Task WorkerProject(string? output)
    {
        var queue = Channel.CreateBounded<Job>(new BoundedChannelOptions(3)
        { FullMode = BoundedChannelFullMode.Wait, SingleWriter = true });
        using var stop = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var successes = new ConcurrentDictionary<int, Result>();
        var failures = new ConcurrentDictionary<int, string>();
        var latencies = new ConcurrentBag<double>();
        var attempts = 0;
        var timeouts = 0;
        var retries = 0;
        var active = 0;
        var peakActive = 0;
        var opened = 0;
        var watch = Stopwatch.StartNew();

        async Task Produce()
        {
            try
            {
                for (var i = 0; i < 12; i++)
                    await queue.Writer.WriteAsync(new Job(i, Stopwatch.GetTimestamp()), stop.Token);
                queue.Writer.TryComplete();
            }
            catch (Exception error)
            {
                queue.Writer.TryComplete(error);
                stop.Cancel();
                throw;
            }
        }
        static async Task<Result> Request(int id, int attempt, CancellationToken token)
        {
            if (id == 7) throw new ArgumentException("영구 입력 오류");
            await Task.Delay(id == 9 ? 250 : 5, token);
            if (id % 5 == 0 && attempt == 1) throw new TransientFailure();
            return new Result(id, id * 2);
        }
        async Task Consume()
        {
            Interlocked.Increment(ref opened);
            try
            {
                await foreach (var job in queue.Reader.ReadAllAsync(stop.Token))
                {
                    var nowActive = Interlocked.Increment(ref active);
                    int observed;
                    do { observed = Volatile.Read(ref peakActive); }
                    while (nowActive > observed && Interlocked.CompareExchange(ref peakActive, nowActive, observed) != observed);
                    try
                    {
                        for (var attempt = 1; attempt <= 2; attempt++)
                        {
                            Interlocked.Increment(ref attempts);
                            using var perAttempt = CancellationTokenSource.CreateLinkedTokenSource(stop.Token);
                            perAttempt.CancelAfter(100);
                            try
                            {
                                var result = await Request(job.Id, attempt, perAttempt.Token);
                                successes.TryAdd(job.Id, result);
                                break;
                            }
                            catch (ArgumentException error)
                            { failures[job.Id] = error.Message; break; }
                            catch (OperationCanceledException) when (!stop.IsCancellationRequested)
                            {
                                Interlocked.Increment(ref timeouts);
                                if (attempt == 2) { failures[job.Id] = "timeout"; break; }
                            }
                            catch (TransientFailure)
                            { if (attempt == 2) { failures[job.Id] = "transient exhausted"; break; } }
                            Interlocked.Increment(ref retries);
                            await Task.Delay(2 * attempt, stop.Token);
                        }
                    }
                    finally
                    {
                        Interlocked.Decrement(ref active);
                        latencies.Add(Stopwatch.GetElapsedTime(job.AcceptedAt).TotalMilliseconds);
                    }
                }
            }
            catch { stop.Cancel(); throw; } // 예상하지 못한 오류는 형제에게 명시적으로 취소를 요청합니다.
            finally { Interlocked.Decrement(ref opened); }
        }
        var producer = Produce();
        var consumers = Enumerable.Range(0, 3).Select(_ => Consume()).ToArray();
        await Task.WhenAll(consumers.Append(producer));
        Check.That(successes.Count == 10 && failures.Keys.Order().SequenceEqual(new[] { 7, 9 }), "처리 결과 오류");
        Check.That(active == 0 && opened == 0 && peakActive <= 3, "동시 실행/정리 오류");
        var report = new
        {
            success = successes.Count, failed = failures.Count, attempts, retries, timeouts,
            peakActive, elapsedMs = watch.Elapsed.TotalMilliseconds,
            meanLatencyMs = latencies.Average(),
            successPerSecond = successes.Count / watch.Elapsed.TotalSeconds,
            failures, results = successes.Values.OrderBy(value => value.Id)
        };
        var json = JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true });
        Console.WriteLine(json);
        if (output is not null)
        {
            await File.WriteAllTextAsync(output, json);
            Console.WriteLine($"결과 저장: {Path.GetFullPath(output)}");
        }
        Console.WriteLine("TryAdd는 메모리 내 중복 커밋 모델입니다. 외부 효과에는 영속 멱등성 계약이 필요합니다.");
    }

    private static async Task CancellationScenario()
    {
        using var stop = new CancellationTokenSource();
        var live = 0;
        var ready = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task Worker()
        {
            if (Interlocked.Increment(ref live) == 2) ready.TrySetResult();
            try { await Task.Delay(Timeout.Infinite, stop.Token); }
            finally { Interlocked.Decrement(ref live); }
        }
        var all = Task.WhenAll(Worker(), Worker());
        await ready.Task;
        stop.Cancel();
        try { await all; }
        catch (OperationCanceledException) when (stop.IsCancellationRequested) { }
        Check.That(live == 0, "취소 후 잔여 worker");
        Console.WriteLine("중단 검증: 모든 worker 정리 완료. 메모리 큐의 미처리 데이터 내구성은 별도 과제입니다.");
    }
}
