namespace ConcurrencyLab;

internal static class Week05
{
    public static async Task Run()
    {
        var log = new List<string>();
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async Task Work()
        {
            log.Add("A: 호출 즉시 시작");
            await Task.CompletedTask;
            log.Add("A: 완료 await 통과");
            await release.Task;
            log.Add("A: 미완료 await 이후 재개");
        }
        var task = Work();
        log.Add("호출자: Work가 Task를 반환함");
        Check.That(log.Count == 3 && !task.IsCompleted, "첫 미완료 await 경계 확인 실패");
        release.SetResult();
        await task;
        Console.WriteLine(string.Join(Environment.NewLine, log));
        Console.WriteLine("async 메서드 호출은 첫 미완료 await까지 동기 실행됩니다.");

        Console.WriteLine("\n일반 Console 앱의 await 전후 스레드:");
        Console.WriteLine($"전: {Environment.CurrentManagedThreadId}, context={SynchronizationContext.Current?.GetType().Name ?? "없음"}");
        await Task.Delay(20);
        Console.WriteLine($"후: {Environment.CurrentManagedThreadId}, context={SynchronizationContext.Current?.GetType().Name ?? "없음"}");
        Console.WriteLine("스레드 번호가 달라질 수도, 같을 수도 있습니다. Task는 전용 스레드를 뜻하지 않습니다.");
        Console.WriteLine("일반 Console의 continuation은 보통 ThreadPool에서 실행됩니다.");
        Console.WriteLine("브라우저의 단일 실행기 도식은 캡처된 UI 컨텍스트를 이해하는 개념 모델입니다.");
    }
}
