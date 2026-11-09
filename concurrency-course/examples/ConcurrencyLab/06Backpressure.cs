using System.Diagnostics;
using System.Threading.Channels;

namespace ConcurrencyLab;

internal static class Week06
{
    public static async Task Run()
    {
        var queue = Channel.CreateBounded<int>(new BoundedChannelOptions(2)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleWriter = true
        });
        var completed = 0;
        var maximumWait = 0.0;
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        async Task Produce()
        {
            try
            {
                for (var i = 0; i < 8; i++)
                {
                    var watch = Stopwatch.StartNew();
                    await queue.Writer.WriteAsync(i, deadline.Token);
                    maximumWait = Math.Max(maximumWait, watch.Elapsed.TotalMilliseconds);
                    Console.WriteLine($"접수 {i}, WriteAsync 대기={watch.Elapsed.TotalMilliseconds:F1} ms");
                }
                queue.Writer.TryComplete();
            }
            catch (Exception error) { queue.Writer.TryComplete(error); throw; }
        }
        async Task Consume(string name)
        {
            await foreach (var job in queue.Reader.ReadAllAsync(deadline.Token))
            {
                await Task.Delay(40, deadline.Token);
                Interlocked.Increment(ref completed);
                Console.WriteLine($"{name}: {job} 완료");
            }
        }
        await Task.WhenAll(Produce(), Consume("A"), Consume("B"));
        Check.That(completed == 8, "작업 누락");
        Console.WriteLine($"완료 {completed}, 생산자 최대 대기 {maximumWait:F1} ms");
        Console.WriteLine("capacity=2는 대기열 상한입니다. 실행 중 2개와 합치면 최대 4개가 내부에 있을 수 있습니다.");
        Console.WriteLine("FullMode.Wait에서 WriteAsync를 await해야 생산자에게 역압력이 전달됩니다.");
    }
}
