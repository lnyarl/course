using System.Diagnostics;
using System.Reflection;

namespace ConcurrencyLab;

internal static class Week02
{
    public static async Task Run()
    {
        var shared = new List<string>();
        var gate = new object();
        void Work(string name)
        {
            var local = $"{name}의 지역 값";
            lock (gate)
            {
                shared.Add(name);
                Console.WriteLine($"Thread {name}: PID={Environment.ProcessId}, " +
                    $"thread={Environment.CurrentManagedThreadId}, local={local}");
            }
        }
        var a = new Thread(() => Work("A"));
        var b = new Thread(() => Work("B"));
        a.Start(); b.Start(); a.Join(); b.Join();
        Check.That(shared.Count == 2, "스레드 공유 리스트 검증 실패");
        Console.WriteLine($"부모에서 본 공유 리스트: [{string.Join(", ", shared)}]");

        var executable = Environment.ProcessPath ?? throw new InvalidOperationException("실행 경로 없음");
        var start = new ProcessStartInfo(executable)
        {
            UseShellExecute = false,
            RedirectStandardOutput = true
        };
        // dotnet DLL 실행과 apphost 직접 실행 모두 지원합니다.
        if (Path.GetFileNameWithoutExtension(executable).Equals("dotnet", StringComparison.OrdinalIgnoreCase))
            start.ArgumentList.Add(Assembly.GetExecutingAssembly().Location);
        start.ArgumentList.Add("--child");
        foreach (var value in shared) start.ArgumentList.Add(value);
        using var child = Process.Start(start) ?? throw new InvalidOperationException("자식 실행 실패");
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        try
        {
            var output = await child.StandardOutput.ReadToEndAsync(deadline.Token);
            await child.WaitForExitAsync(deadline.Token);
            Console.Write(output);
        }
        catch (OperationCanceledException)
        {
            if (!child.HasExited) child.Kill(entireProcessTree: true);
            await child.WaitForExitAsync();
            throw;
        }
        Check.That(child.ExitCode == 0 && shared.Count == 2, "프로세스 분리 검증 실패");
        Console.WriteLine($"부모 PID={Environment.ProcessId}, 리스트 원소 수={shared.Count}");
        Console.WriteLine("자식은 명령행으로 받은 값의 새 리스트를 변경했습니다. 일반 힙은 공유되지 않습니다.");
    }
}
