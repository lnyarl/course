using System.Diagnostics;
using System.Runtime.CompilerServices;

namespace ConcurrencyLab;

internal static class Week01
{
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static int Double(int value)
    {
        Console.WriteLine("호출 스택 (위쪽이 현재 함수):");
        Console.WriteLine(new StackTrace());
        return value * 2;
    }

    public static void Run()
    {
        var numbers = new[] { 1, 2, 3 };
        Console.WriteLine($"Double(numbers[1]) = {Double(numbers[1])}");
        using var process = Process.GetCurrentProcess();
        var cpuStart = process.TotalProcessorTime;
        var wall = Stopwatch.StartNew();
        Thread.Sleep(100);
        process.Refresh();
        Console.WriteLine($"대기: 경과 {wall.Elapsed.TotalMilliseconds:F1} ms / " +
            $"프로세스 CPU {(process.TotalProcessorTime - cpuStart).TotalMilliseconds:F1} ms");
        Console.WriteLine("경과 시간은 흐르지만 잠든 스레드는 계속 CPU를 사용하지 않습니다.");
        Console.WriteLine("StackTrace는 관리 코드 호출 관찰입니다. 실제 기계 명령어 추적은 아닙니다.");
    }
}
