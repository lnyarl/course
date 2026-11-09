namespace ConcurrencyLab;

internal static class Week04
{
    public static void Run()
    {
        var counter = 0;
        using var bothRead = new Barrier(2);
        using var aWritten = new ManualResetEventSlim(false);
        void Racy(string name)
        {
            var snapshot = counter;
            bothRead.SignalAndWait();
            if (name == "B") aWritten.Wait();
            counter = snapshot + 1;
            Console.WriteLine($"{name}: 읽은 값={snapshot}, 쓴 값={counter}");
            if (name == "A") aWritten.Set();
        }
        var a = new Thread(() => Racy("A"));
        var b = new Thread(() => Racy("B"));
        a.Start(); b.Start(); a.Join(); b.Join();
        Check.That(counter == 1, "의도한 lost update 재현 실패");
        Console.WriteLine($"락 없음: 기대 2, 실제 {counter}");
        counter = 0;
        var gate = new object();
        void Safe() { lock (gate) { counter++; } }
        a = new Thread(Safe); b = new Thread(Safe);
        a.Start(); b.Start(); a.Join(); b.Join();
        Check.That(counter == 2, "락 보호 실패");
        Console.WriteLine($"락 사용: 기대 2, 실제 {counter}");
        Console.WriteLine("단일 카운터 증가에는 Interlocked.Increment도 적합합니다.");
        Console.WriteLine("복수 락은 모든 경로에서 같은 순서로 획득해야 순환 대기를 예방할 수 있습니다.");
    }
}
