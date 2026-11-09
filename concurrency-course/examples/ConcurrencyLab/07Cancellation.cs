namespace ConcurrencyLab;

internal static class Week07
{
    public static async Task Run()
    {
        var active = 0;
        async Task Operation(string name, int delay, CancellationToken token, bool fail = false)
        {
            Interlocked.Increment(ref active);
            Console.WriteLine($"자원 열기: {name}");
            try
            {
                await Task.Delay(delay, token);
                if (fail) throw new InvalidOperationException("주입한 실패");
                Console.WriteLine($"작업 완료: {name}");
            }
            finally
            {
                Interlocked.Decrement(ref active);
                Console.WriteLine($"자원 정리: {name}");
            }
        }
        // WaitAsync의 timeout은 원래 Task를 취소하지 않습니다.
        var original = Operation("원작업", 80, CancellationToken.None);
        try { await original.WaitAsync(TimeSpan.FromMilliseconds(10)); }
        catch (TimeoutException) { Console.WriteLine($"기다리기 타임아웃, 원작업 완료={original.IsCompleted}"); }
        await original;

        using (var stop = new CancellationTokenSource())
        {
            var cooperative = Operation("협력 취소", 200, stop.Token);
            stop.CancelAfter(10);
            try { await cooperative; }
            catch (OperationCanceledException) when (stop.IsCancellationRequested)
            { Console.WriteLine("취소 수신 후 정리를 기다렸습니다."); }
        }
        var sibling = Operation("WhenAll 형제", 60, CancellationToken.None);
        var failed = Operation("실패 작업", 10, CancellationToken.None, fail: true);
        try { await Task.WhenAll(sibling, failed); }
        catch (InvalidOperationException) { Console.WriteLine($"WhenAll 오류 보고, 형제 상태={sibling.Status}"); }
        Check.That(sibling.IsCompletedSuccessfully && active == 0, "자원 정리/형제 동작 검증 실패");
        Console.WriteLine("WhenAll은 형제를 자동 취소하지 않습니다. 필요하면 공유 CTS를 명시적으로 취소합니다.");
        Console.WriteLine("원격 서버의 작업 중단은 별도 프로토콜과 확인이 필요합니다.");
    }
}
