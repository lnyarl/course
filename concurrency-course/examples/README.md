# C# 동시성 실습

.NET 10 SDK가 설치된 터미널에서 실행합니다. 외부 NuGet 패키지는 없습니다.

```sh
cd concurrency-course
dotnet run --project examples/ConcurrencyLab -- 01
dotnet run --project examples/ConcurrencyLab -- 02
dotnet run --project examples/ConcurrencyLab -- 03
dotnet run --project examples/ConcurrencyLab -- 04
dotnet run --project examples/ConcurrencyLab -- 05
dotnet run --project examples/ConcurrencyLab -- 06
dotnet run --project examples/ConcurrencyLab -- 07
dotnet run --project examples/ConcurrencyLab -- 08 /tmp/concurrency-results.json
```

| 명령 | 관찰 | 예상 결과 |
|---|---|---|
| 01 | 호출 스택, CPU 시간과 경과 시간 | Sleep 중 경과 시간은 증가하고 프로세스 CPU 증가는 작음 |
| 02 | 스레드 공유 리스트와 자식 프로세스 | 스레드 둘의 값은 부모에 반영, 자식의 추가 값은 부모에 미반영 |
| 03 | 루프백 HTTP 서버의 80 ms 지연 | 순차 6개는 대략 480 ms 이상, 동시 6개는 대기를 겹침. 환경별 수치는 변동 |
| 04 | 제어된 읽기/쓰기 순서와 lock | 락 없이 1, 락 사용 시 2 |
| 05 | 첫 미완료 await와 continuation | 호출 즉시 A 시작, 완료 await 통과, 호출자로 반환, 신호 후 재개 |
| 06 | 용량 2 Channel, 소비자 2개 | 총 8개 완료, 채널이 가득 찰 때 WriteAsync 대기 |
| 07 | WaitAsync, 협력 취소, WhenAll | 기다리기 timeout 뒤 원작업 완료, finally 정리, 형제는 자동 취소되지 않음 |
| 08 | 처리 방식 비교와 유한 작업 처리기 | 성공 10, 실패 2, 실행 중 최대 3, 취소 후 worker 정리 |

03만 127.0.0.1의 임시 포트에서 HTTP 통신합니다. 외부 서비스에 접속하지 않습니다. 08의 I/O는 Task.Delay로 모델링합니다. 08의 JSON 저장 경로를 생략하면 화면에만 출력합니다. ThreadPool 스케줄링과 JIT, CPU 코어 수, 시스템 부하에 따라 시간과 스레드 번호가 달라집니다. 성능 비교는 단발성 학습 실험이며 벤치마크 결론이 아닙니다.

02는 현재 실행 파일의 자식 프로세스를 만듭니다. 프로세스 생성이 제한된 환경에서는 이 예제만 실행할 수 없을 수 있습니다. 04는 Barrier와 이벤트를 사용해 경쟁 상태를 의도적으로 재현합니다. 일반 실행에서 특정 경합 순서가 항상 발생한다는 뜻은 아닙니다.

브라우저 실험은 개념 모델입니다. 특히 05의 단일 실행기 도식은 UI SynchronizationContext 같은 직렬 실행 환경을 가정합니다. 일반 Console 앱은 보통 SynchronizationContext가 없으며, await 이후 continuation이 ThreadPool에서 실행될 수 있습니다. Task를 전용 스레드와 같은 것으로 해석하지 마세요.

## 코드 확인 자료

- [Task 기반 비동기 프로그래밍](https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/task-asynchronous-programming-model)
- [System.Threading.Channels](https://learn.microsoft.com/en-us/dotnet/core/extensions/channels)
- [협력적 취소](https://learn.microsoft.com/en-us/dotnet/standard/threading/cancellation-in-managed-threads)
- [Task.WaitAsync](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.task.waitasync?view=net-10.0)
- [Task.WhenAll](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.task.whenall?view=net-10.0)

## 제작 환경 검증 범위

이 자료를 만든 환경에는 .NET SDK가 없어 C# 컴파일과 실행을 수행하지 못했습니다. 예제의 실제 실행 결과는 아직 확인되지 않았습니다. 위 표는 코드로 의도한 관찰이며, 실행 기록이 아닙니다. SDK가 있는 환경에서 먼저 `dotnet build examples/ConcurrencyLab`을 실행하고 01~08을 확인하세요. 예제에는 결과·정리 상태를 검사하는 assertion이 포함되어 있어 조건이 깨지면 예외로 종료합니다.
