window.ASPNET_ENGINEERING = [
  {
    id: 10, title: '변경에 강한 경계 설계', kicker: 'ARCHITECTURE · 경계와 책임',
    lead: '외부 처리 업체를 바꾸려는데 Controller, DB 모델, 테스트가 모두 깨진다면 무엇이 잘못 연결되어 있을까? 파일 개수보다 변경이 전파되는 방향을 살펴본다.',
    objectives: ['HTTP 계약과 업무 규칙의 경계를 구분한다.', '트랜잭션 경계와 외부 호출 실패를 함께 설계한다.', '추상화를 추가할 근거를 실제 변경 사례로 설명한다.'],
    sections: [
      {title: 'HTTP의 문법과 업무의 규칙을 분리한다', body: ['요청의 JSON을 읽고 400 또는 202를 반환하는 일은 HTTP 경계의 책임이다. 처리 요청이 취소 가능한 상태인지, 같은 파일을 중복 처리할 수 있는지는 업무 규칙이다. 업무 객체가 HttpContext와 상태 코드를 알면 동일한 규칙을 메시지 소비자에서 실행할 때 웹 환경까지 가져와야 한다.', '먼저 endpoint가 입력을 유스케이스에 전달하고 결과를 HTTP 응답으로 바꾸도록 만든다. 작은 CRUD라면 별도 프로젝트를 여러 개 만들 필요는 없다. 같은 파일 안에서도 전달할 데이터와 책임을 구분할 수 있다. 경계를 나누는 이유는 미래의 모든 가능성이 아니라 현재 확인된 변경과 테스트 요구다.']},
      {title: '의존성의 방향과 실행 순서는 다르다', body: ['실행 시 유스케이스는 저장소를 호출한다. 그러나 컴파일 의존성까지 특정 DB 구현을 향해야 하는 것은 아니다. 업무 쪽에서 필요한 포트를 정의하고 인프라가 구현하면 실행은 바깥으로 진행되어도 소스 의존성은 안정적인 계약을 향하게 할 수 있다.', '이 접근에는 인터페이스와 매핑 코드의 비용이 있다. 구현이 하나라는 이유만으로 인터페이스가 불필요한 것도, 모든 클래스에 인터페이스가 필요한 것도 아니다. 외부 호출 대체, 여러 진입점의 규칙 공유, 데이터 모델 변경 차단처럼 실질적인 목적을 먼저 적는다.']},
      {title: 'DB 트랜잭션은 외부 HTTP까지 되돌리지 않는다', body: ['처리 요청을 DB에 저장한 뒤 외부 업체에 작업을 요청한다고 하자. 외부 요청이 성공한 직후 프로세스가 종료되면 로컬 상태는 아직 갱신되지 않았을 수 있다. DB 트랜잭션 안에 HTTP 호출을 넣어도 외부 업체의 상태가 함께 롤백되지는 않는다. 긴 트랜잭션은 잠금과 연결 점유도 늘린다.', '저장과 발행 사이의 유실을 막아야 한다면 요청 상태와 Outbox 레코드를 같은 DB 트랜잭션으로 기록한 뒤 별도 발행기가 전송한다. 이 방식도 중복 발행을 없애지는 않으므로 처리 키와 수신 측 멱등성이 필요하다. 복잡한 패턴을 도입하기 전에 요구되는 유실·중복 허용 범위를 정한다.']},
      {title: '계층형과 기능별 구성은 선택의 축이 다르다', body: ['Controller/Service/Repository 폴더로 나누면 기술 역할을 찾기 쉽다. Upload/Create, Upload/Cancel처럼 기능으로 묶으면 변경 하나와 관련된 코드를 모아 읽기 쉽다. 기능별 구성 안에 업무·인프라 경계를 둘 수도 있으므로 둘은 완전히 배타적인 선택이 아니다.', 'Rails의 관례는 공통 구조를 빠르게 공유하게 해 주고, Spring이나 ASP.NET Core의 DI는 구현 교체 경계를 표현하는 데 유용하다. 하지만 프레임워크를 선택했다고 적절한 업무 경계가 자동으로 생기지는 않는다. CQRS나 MediatR도 별도 판단 대상이다. 단순한 메서드 호출보다 얻는 이익을 구체적으로 설명하지 못하면 우선 단순하게 유지한다.']}
    ],
    flow: ['HTTP 입력', '유스케이스', '업무 규칙', '저장 포트', 'DB 구현'],
    code: {lang: 'csharp', caption: '구조를 설명하는 C# 조각. JobStore 구현과 endpoint 등록은 생략했다.', text: `public interface IJobStore
{
    Task AddAsync(Job job, CancellationToken ct);
}

public sealed class SubmitJob(IJobStore store)
{
    public async Task<Guid> ExecuteAsync(string fileKey, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(fileKey))
            throw new ArgumentException("파일 키가 필요합니다.", nameof(fileKey));
        var job = new Job(Guid.NewGuid(), fileKey);
        await store.AddAsync(job, ct);
        return job.Id;
    }
}
public sealed record Job(Guid Id, string FileKey);`},
    lab: {kind: 'architecture', title: '변경은 어디까지 전파되는가?', predict: '외부 서비스 구현을 교체할 때 의존 방향에 따라 수정 범위가 어떻게 달라질까?', steps: ['의존 방향에서 업무 로직이 HTTP에 의존하는 구성을 선택하고 마지막 단계까지 진행한다.', '업무 경계를 인터페이스로 분리한 구성으로 바꾸고 처음부터 흐름을 확인한다.', '외부 서비스 교체가 업무 모델까지 전파되는 경우와 adapter에 집중되는 경우를 비교한다.'], explain: '노드와 단계 설명은 두 가지 의존성 구조의 교육용 예다. 실제 수정 범위는 코드와 테스트로 확인해야 하며, 인터페이스가 잘못된 경계를 감싸면 변경 전파는 여전히 크다.'},
    practice: ['처리 요청 생성 유스케이스에서 HttpContext 의존을 제거한다. HTTP 없이 호출 가능한지 확인한다.', '외부 처리 업체를 가짜 구현으로 교체하고 업무 테스트가 유지되는지 확인한다.', 'DB 저장 직후 실패를 넣고 유실·중복 가능성을 표로 기록한다.', '현재 필요한 추상화 하나와 도입하지 않을 추상화 하나의 이유를 작성한다.'],
    quiz: {q: 'DB 트랜잭션 안에서 외부 HTTP 요청을 보내면 무엇이 보장되는가?', options: ['외부 시스템 변경도 자동 롤백된다.', 'DB 트랜잭션만으로 외부 변경의 원자성은 보장되지 않는다.', '재시도가 항상 중복 실행을 방지한다.'], answer: 1, why: 'DB 트랜잭션의 범위는 해당 데이터베이스다. 외부 효과와 상태 기록 사이의 실패는 멱등성, Outbox, 보상 처리 같은 별도 계약으로 다룬다.'},
    sources: [{label: 'Microsoft · 일반적인 웹 애플리케이션 아키텍처', url: 'https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures'}, {label: 'Microsoft · Transactional Outbox 패턴', url: 'https://learn.microsoft.com/en-us/azure/architecture/databases/guide/transactional-outbox-cosmos'}]
  },
  {
    id: 11, title: '인증보다 한 단계 더: 리소스 권한', kicker: 'SECURITY · 신원과 권한',
    lead: '로그인한 사용자가 URL의 작업 ID만 바꿔 다른 사람의 파일을 읽을 수 있다면 인증은 성공했어도 보안 설계는 실패한 것이다.',
    objectives: ['인증과 인가, 리소스 소유권을 구분한다.', '쿠키·토큰·CORS·CSRF의 역할을 설명한다.', '권한 실패를 실제 API 경로에서 검증한다.'],
    sections: [
      {title: '인증은 신원, 인가는 작업의 허용 여부다', body: ['인증 미들웨어는 요청의 자격 증명을 검증하여 사용자 신원을 구성한다. 인가는 그 사용자가 지정된 작업을 수행할 수 있는지 정책으로 판단한다. 토큰 안에 사용자 ID가 있다고 해서 모든 작업 조회 권한이 생기는 것은 아니다.', '로그인 여부만 검사하면 다른 사용자의 작업 ID를 입력하는 공격을 막을 수 없다. 조회 대상의 소유자·조직·공유 상태를 함께 확인한다. 리소스를 읽은 뒤 IAuthorizationService로 판단하거나 쿼리 자체를 허용된 조직 범위로 제한한다. 복잡한 정책에서는 두 방법을 조합할 수 있다.']},
      {title: '토큰과 쿠키는 다른 전달 경로를 가진다', body: ['쿠키는 브라우저가 조건에 맞는 요청에 자동으로 붙인다. 이 편리함 때문에 상태를 바꾸는 요청에는 CSRF 대응이 필요하다. SameSite와 Secure 설정, antiforgery token의 역할을 함께 이해해야 한다. GET이 상태를 바꾸지 않도록 설계하는 것도 중요하다.', 'Authorization 헤더의 bearer token은 그것을 가진 주체가 사용할 수 있다. 서명 검증 외에도 발급자, 대상, 만료를 검증해야 한다. OAuth는 위임된 접근, OIDC는 그 위에서 신원을 전달하는 역할을 다룬다. JWT라는 데이터 형식만 채택한다고 로그인·갱신·폐기 정책이 완성되는 것은 아니다.']},
      {title: 'CORS는 서버의 접근 권한 검사가 아니다', body: ['CORS는 브라우저가 다른 출처의 응답을 스크립트에 노출할 수 있는지 제어하는 규칙이다. curl, 서버 간 호출, 악의적인 클라이언트에 대한 인증을 대신하지 않는다. CORS를 껐는데 요청이 도착한다는 사실 자체는 오류가 아니다.', 'XSS는 신뢰하지 않는 값이 실행 가능한 문맥에 들어가는 문제다. 출력 문맥에 맞게 인코딩하고 HTML 문자열 조립을 피한다. 쿠키·토큰 저장 방식만 바꿔 모든 XSS 피해를 없앨 수는 없다. 로그에는 토큰과 원본 파일의 민감정보를 남기지 않는다.']},
      {title: '실패 경로를 사용자 조합으로 검증한다', body: ['사용자 A의 작업을 A, B, 미인증 사용자, 조직 관리자가 각각 조회하는 표를 만든다. 읽기와 취소는 다른 정책일 수 있다. 없는 리소스와 권한 없는 리소스를 404로 동일하게 처리할지는 정보 노출 정책과 API 계약에 맞게 정한다.', 'API에서 일반적으로 미인증은 challenge, 인증됐지만 권한이 없으면 forbid로 표현한다. 실제 응답은 사용 중인 인증 scheme과 API 설정에 따라 달라질 수 있으므로 401·403·리다이렉트를 테스트한다. ASP.NET Core, Django, Rails의 인증 기능이 제공하는 기본값을 곧 업무 권한으로 간주하지 않는다.']}
    ],
    flow: ['자격 증명', '신원 확인', '리소스 로드', '소유권·정책', '허용 또는 거절'],
    code: {lang: 'csharp', caption: '리소스 기반 인가 흐름 조각. 인증 scheme, ReadJob 정책과 DB 모델 등록이 필요하다.', text: `app.MapGet("/jobs/{id:guid}", async (
    Guid id, HttpContext context, JobDb db,
    IAuthorizationService authorization, CancellationToken ct) =>
{
    var job = await db.Jobs.FindAsync(new object[] { id }, ct);
    if (job is null) return Results.NotFound();

    var result = await authorization.AuthorizeAsync(
        context.User, job, "ReadJob");
    if (!result.Succeeded) return Results.Forbid();

    return Results.Ok(new { job.Id, job.Status });
}).RequireAuthorization();`},
    lab: {kind: 'security', title: '로그인하면 모두 읽을 수 있을까?', predict: '사용자 B가 A의 작업을 요청하면 인증 단계와 소유권 단계에서 각각 무슨 일이 일어날까?', steps: ['요청 사용자를 바꾼다.', '리소스 소유자와 인증 상태를 확인한다.', '허용·거절 결과를 설명하고 다른 조합과 비교한다.'], explain: '이 실험은 인증과 소유권 판단의 개념 모델이다. 실제 토큰 암호 검증이나 브라우저 쿠키 정책을 실행하지 않는다.'},
    practice: ['미인증·본인·타인 요청을 같은 endpoint에 보내 응답을 비교한다.', '읽기 권한은 있지만 취소 권한이 없는 사용자를 만든다.', 'CORS 설정과 무관하게 서버에서 권한 검사가 적용되는지 확인한다.', '로그에 Authorization 헤더, 쿠키, 개인 식별 정보가 기록되지 않는지 점검한다.'],
    quiz: {q: 'CORS로 허용한 출처만 지정하면 서버 API의 인증을 생략해도 될까?', options: ['그렇다. 다른 클라이언트는 서버에 연결할 수 없다.', '아니다. CORS는 브라우저 응답 접근 정책이며 서버 권한 검사가 별도로 필요하다.', 'GET 요청에만 인증이 필요하다.'], answer: 1, why: '브라우저의 출처 정책은 서버 간 호출을 차단하는 인증 장치가 아니다. 리소스 접근 여부는 서버가 요청마다 판단해야 한다.'},
    sources: [{label: 'Microsoft · 리소스 기반 인가', url: 'https://learn.microsoft.com/en-us/aspnet/core/security/authorization/resource-based?view=aspnetcore-10.0'}, {label: 'Microsoft · CORS', url: 'https://learn.microsoft.com/en-us/aspnet/core/security/cors?view=aspnetcore-10.0'}, {label: 'Microsoft · CSRF 방어', url: 'https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0'}]
  },
  {
    id: 12, title: 'await 중에는 누가 기다리는가?', kicker: 'CONCURRENCY · 비동기와 취소',
    lead: '외부 호출이 1초 걸릴 때 요청 100개는 스레드 100개를 필요로 할까? 대기와 실행을 분리하면 확장성 문제를 정확히 볼 수 있다.',
    objectives: ['비동기 I/O와 병렬 CPU 실행을 구분한다.', '동기 대기가 ThreadPool에 주는 영향을 설명한다.', 'timeout과 실제 작업 취소를 구분한다.'],
    sections: [
      {title: 'Task는 전용 스레드 한 개를 뜻하지 않는다', body: ['비동기 I/O가 완료되지 않았을 때 await는 이후 실행을 이어 갈 정보를 남기고 현재 호출 흐름을 반환한다. 네트워크가 응답할 때까지 스레드를 붙잡아 두지 않을 수 있다. 완료 후의 코드는 실행 가능한 스레드에서 이어진다. 요청 하나가 처음부터 끝까지 같은 스레드를 독점한다는 가정을 버린다.', 'CPU에서 실제 계산을 하는 동안에는 실행 자원이 필요하다. async를 붙인다고 이미지 압축 계산량이 줄지 않는다. 동시성은 여러 작업의 진행을 겹치는 개념이고, 병렬성은 여러 실행 자원으로 동시에 계산하는 개념이다. Node.js의 event loop, Go의 goroutine, .NET의 Task는 같은 이름의 동작 단위가 아니다.']},
      {title: '동기 대기를 섞으면 처리 가능한 요청이 줄어든다', body: ['.Result와 .Wait()는 호출 스레드를 막는다. 여러 요청이 이렇게 대기하면 ThreadPool 작업이 큐에 쌓이고 뒤늦은 응답이 늘어난다. CPU 사용률이 낮은데 지연이 커질 수도 있다. 스레드 수 증가만 보는 대신 큐·완료율·외부 I/O 시간을 함께 확인한다.', 'ASP.NET Core 요청 안에서 동기 I/O를 Task.Run으로 감싼 뒤 await해도 다른 ThreadPool 스레드가 대신 막힌다. 본질적인 자원 점유를 없애지 못한다. 실제 비동기 API를 호출하고 경로 전체를 비동기로 연결한다. CPU 작업은 부하와 격리 요구에 따라 동시성을 제한하거나 별도 worker로 옮긴다.']},
      {title: '기다리기를 중단하는 것과 작업을 중단하는 것은 다르다', body: ['Task.WaitAsync에 timeout을 지정하면 그 기다림이 끝난다. 이미 실행 중인 원본 작업까지 자동으로 취소되지는 않는다. 취소하려면 해당 API에 CancellationToken을 전달하고, 구현이 토큰을 관찰해야 한다. 취소는 협력적인 요청이지 실행 중인 코드를 강제로 제거하는 기능이 아니다.', '요청 중단 토큰과 자체 timeout 토큰을 연결하면 클라이언트 연결 종료와 서비스 시간 제한을 같은 작업에 전달할 수 있다. 그러나 DB commit처럼 이미 완료된 효과는 취소로 되돌아가지 않는다. 어느 시점 이후에는 취소보다 완료 기록과 복구가 우선인지 업무 경계를 정한다.']},
      {title: '병렬화를 적용할 때 공유 객체를 확인한다', body: ['독립된 외부 호출을 Task.WhenAll로 겹치면 전체 대기를 줄일 수 있지만 연결 수와 상대 서비스 부하가 증가한다. 모든 요청을 무제한으로 시작하면 대기열이 외부 시스템으로 이동할 뿐이다. 세마포어나 작업 큐로 허용 동시성을 제한하고 초과 요청의 처리 정책을 정한다.', 'EF Core DbContext는 병렬 작업에서 공유하는 객체가 아니다. 같은 context로 여러 DB 쿼리를 동시에 시작하지 않는다. 또한 HttpContext는 요청 수명 밖에서 사용하지 않는다. 백그라운드 작업에는 사용자 ID와 파일 키처럼 필요한 값을 명시적으로 복사해 전달한다.']}
    ],
    flow: ['요청 실행', '비동기 I/O 시작', '실행 스레드 반환', 'I/O 완료', '계속 실행'],
    code: {lang: 'csharp', caption: '비동기 HTTP 호출과 취소 연결 조각. DI에서 HttpClient를 구성하고 주입받는 환경을 전제로 한다.', text: `app.MapGet("/remote", async (
    HttpClient client, CancellationToken requestAborted) =>
{
    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(
        requestAborted);
    timeout.CancelAfter(TimeSpan.FromSeconds(2));
    using var response = await client.GetAsync(
        "https://example.com/", timeout.Token);
    response.EnsureSuccessStatusCode();
    var body = await response.Content.ReadAsStringAsync(timeout.Token);
    return Results.Text(body);
});`},
    lab: {kind: 'async', title: '동기 대기와 비동기 대기를 나란히 보기', predict: 'I/O 대기가 길어질 때 어느 모델에서 실행 슬롯이 더 오래 점유될까?', steps: ['동기·비동기 실행 모드를 바꾼다.', '요청 수와 대기 시간을 조절한다.', '실행·대기·완료 상태와 슬롯 점유를 비교한다.'], explain: '고정 슬롯으로 설명하는 개념 모델이며 실제 ThreadPool의 자동 조정, 커널 I/O, 프레임워크 성능 순위를 재현하지 않는다.'},
    practice: ['Task.Delay를 await한 endpoint와 동기적으로 기다리는 endpoint에 같은 부하를 준다.', '클라이언트 요청을 끊고 downstream API에 취소가 전달되는지 로그로 확인한다.', 'WaitAsync timeout만 적용한 작업이 계속 실행되는 사례를 재현한다.', '기존 C# 동시성 코스의 취소·자원 정리 실험과 함께 비교한다.'],
    quiz: {q: '원본 Task에 취소 토큰을 전달하지 않고 WaitAsync timeout만 설정했다. timeout 이후 원본 작업은?', options: ['반드시 종료된다.', '계속 실행될 수 있다.', '항상 롤백된다.'], answer: 1, why: 'WaitAsync는 기다림에 시간 제한을 준다. 원본 작업을 멈추려면 토큰 전달과 작업의 협력적인 취소 처리가 필요하다.'},
    sources: [{label: 'Microsoft · ASP.NET Core Best Practices', url: 'https://learn.microsoft.com/en-us/aspnet/core/fundamentals/best-practices?view=aspnetcore-10.0'}, {label: 'Microsoft · Task.WaitAsync', url: 'https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.task.waitasync?view=net-10.0'}, {label: 'Microsoft · DbContext의 스레딩 문제 방지', url: 'https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/#avoiding-dbcontext-threading-issues'}, {label: '연결 학습 · C# 동시성과 비동기', url: '../concurrency-course/index.html'}]
  },
  {
    id: 13, title: '백그라운드 작업과 유한한 대기열', kicker: 'RELIABILITY · 큐와 복구',
    lead: '202 Accepted를 반환한 뒤 서버가 재시작되면 작업은 어디에 남아 있을까? 빨리 응답하는 것과 작업을 안전하게 맡는 것은 다른 계약이다.',
    objectives: ['프로세스 내부 큐와 영속 큐의 차이를 설명한다.', '유한한 용량과 역압력의 필요성을 이해한다.', '재시도·중복·종료 시나리오를 설계한다.'],
    sections: [
      {title: '요청 수명과 작업 수명을 분리한다', body: ['긴 처리를 HTTP 요청에 묶으면 연결과 timeout 관리가 어려워진다. 요청 API는 유효성을 검증하고 작업 ID를 발급한 뒤 상태 조회 경로를 제공할 수 있다. 이때 202는 완료가 아니라 접수 상태를 뜻한다. 접수했다고 말하려면 어떤 저장 단계까지 성공했는지 정의해야 한다.', '요청 안에서 실행한 fire-and-forget Task는 종료·예외·DI scope를 관리하기 어렵다. 프로세스 내부 작업이라면 Hosted Service를 사용해 시작과 종료를 호스트 수명에 연결한다. scoped 서비스를 쓰는 worker는 작업별 scope를 만들고 그 안에서 DbContext 등을 해결한다.']},
      {title: '큐의 용량은 장애 시 메모리 사용량을 결정한다', body: ['도착 속도가 처리 속도보다 빠르면 대기열이 증가한다. 무한 큐는 과부하를 없애지 않고 메모리와 지연으로 보관한다. bounded Channel은 용량을 정하고 가득 찼을 때 생산자가 기다리거나 거절하는 정책을 적용할 수 있다.', '대기를 선택하면 요청 timeout과 upstream의 재시도도 함께 고려한다. 거절을 선택하면 429·503 같은 계약과 재시도 안내가 필요하다. Drop 정책은 어떤 작업이 사라져도 되는지 요구가 명확할 때만 사용한다. 요청 개수뿐 아니라 작업당 파일 크기도 자원 용량에 영향을 준다.']},
      {title: 'Channel은 프로세스 종료 뒤 작업을 복구하지 않는다', body: ['Channel은 메모리에 존재하는 생산자·소비자 도구다. 서버가 죽으면 아직 처리하지 않은 작업도 사라질 수 있다. 작업 접수 후 유실이 허용되지 않는다면 DB의 작업 테이블이나 영속 메시지 브로커가 필요하다. 같은 코드를 여러 서버에 띄우면 각 메모리 큐가 서로 독립적이라는 점도 확인한다.', '메시지가 처리된 직후 ack 전에 worker가 죽으면 같은 메시지가 다시 도착할 수 있다. 따라서 최소 한 번 전달을 전제로 멱등 처리와 완료 기록을 설계한다. 중복 키 저장과 업무 변경이 별도 트랜잭션이면 그 사이에도 실패 구간이 생긴다. exactly once라는 표현만으로 이 경계를 덮지 않는다.']},
      {title: '재시도와 정상 종료에도 예산이 있다', body: ['일시적인 네트워크 실패는 제한된 재시도로 복구할 수 있지만 잘못된 입력은 반복해도 해결되지 않는다. 지수 backoff와 jitter, 최대 시도·총시간 제한을 두고 영구 실패를 격리한다. 모든 계층이 독립적으로 재시도하면 요청 수가 곱해져 장애를 키울 수 있다.', '종료 시 새 작업 수신을 멈추고 진행 중 작업을 완료하거나 안전하게 반환한다. 호스트의 종료 제한보다 컨테이너 종료 유예가 짧으면 drain 계획이 실행되지 못한다. graceful shutdown 성공 로그뿐 아니라 강제 종료에서의 재전달과 복구도 검증한다.']}
    ],
    flow: ['접수·영속화', '유한 대기열', 'worker scope', '멱등 처리', '완료 기록·ack'],
    code: {lang: 'csharp', caption: 'bounded Channel 학습용 조각. 프로세스 내 큐이며 영속성·재전달을 제공하지 않는다.', text: `var queue = Channel.CreateBounded<Guid>(new BoundedChannelOptions(32)
{
    FullMode = BoundedChannelFullMode.Wait,
    SingleReader = true,
    SingleWriter = false
});

// 생산자: 가득 차면 공간이 날 때까지 기다린다.
await queue.Writer.WriteAsync(jobId, requestAborted);

// Hosted Service 내부 소비 루프의 일부
await foreach (var id in queue.Reader.ReadAllAsync(stoppingToken))
{
    await using var scope = scopeFactory.CreateAsyncScope();
    var processor = scope.ServiceProvider.GetRequiredService<JobProcessor>();
    await processor.ProcessAsync(id, stoppingToken);
}`},
    lab: {kind: 'queue', title: '처리보다 빠른 유입을 감당할 수 있을까?', predict: '용량 10인 큐에서 유입이 처리보다 빠를 때 어떤 작업이 남고, 프로세스 종료 후에는 어떻게 될까?', steps: ['메모리 Channel을 선택하고 틱당 유입을 처리보다 높인 뒤 종료 직전 단계까지 진행한다.', '마지막 단계의 프로세스 종료에서 대기 작업 유실을 확인한다.', '큐 보관 방식을 영속 큐로 바꾸면 초기 상태로 돌아간다. 같은 조건으로 마지막 단계까지 진행해 남은 작업을 비교한다.', '유입 또는 처리 값을 바꾸면 초기화된다. 각 조건을 처음부터 실행하여 적체와 즉시 수용 못한 작업 수를 비교한다.'], explain: '용량은 10으로 고정된 개념 모델이다. 입력 변경은 진행 중 큐를 조절하지 않고 새 시나리오를 시작한다. 즉시 수용 못한 작업은 자동 재투입하지 않으며 실제 Channel의 대기·거절 정책, 메시지 크기, 영속화 지연과 브로커 전달 보장은 별도 검증이 필요하다.'},
    practice: ['큐가 가득 찼을 때 생산자가 기다리는지 거절되는지 명시한다.', '접수 직후와 처리 완료 직후에 프로세스를 각각 종료해 복구 결과를 확인한다.', '같은 작업 키를 두 번 전달해 업무 효과가 한 번만 반영되는지 검증한다.', '일시 실패와 입력 오류의 재시도 정책을 분리한다.'],
    quiz: {q: 'Channel에 작업을 넣고 202를 반환했다. 프로세스가 강제 종료되면?', options: ['Channel이 디스크에서 자동 복구한다.', '메모리에 있던 작업은 유실될 수 있다.', '모든 작업이 완료될 때까지 프로세스 종료가 불가능하다.'], answer: 1, why: 'Channel 자체는 영속 저장소가 아니다. 유실을 허용하지 않는 접수 계약에는 영속 기록과 복구 소비 경로가 필요하다.'},
    sources: [{label: 'Microsoft · Hosted Services', url: 'https://learn.microsoft.com/en-us/aspnet/core/fundamentals/host/hosted-services?view=aspnetcore-10.0'}, {label: 'Microsoft · Channels', url: 'https://learn.microsoft.com/en-us/dotnet/core/extensions/channels'}, {label: 'Microsoft · 재시도 패턴', url: 'https://learn.microsoft.com/en-us/azure/architecture/patterns/retry'}]
  },
  {
    id: 14, title: '테스트가 실제로 증명하는 범위', kicker: 'TESTING · 증거의 경계',
    lead: 'Controller의 단위 테스트가 통과했는데 운영에서는 401이 나온다. 테스트가 지나간 경로와 실제 요청 경로를 나란히 그려 보자.',
    objectives: ['단위·통합·E2E 테스트가 증명하는 범위를 구분한다.', '실제 DB의 제약과 쿼리 동작을 검증한다.', '실패·동시성·권한 경로를 테스트에 포함한다.'],
    sections: [
      {title: '테스트 더블은 원하는 경계를 고립시킨다', body: ['업무 규칙 테스트는 HTTP 서버 없이 취소 가능한 상태를 검사할 수 있다. 외부 서비스의 성공·실패 응답을 가짜 구현으로 고정하면 네트워크 변동 없이 분기를 검증한다. 이때 통과한 것은 규칙과 가짜 응답에 대한 처리이지 실제 외부 서비스 연동이 아니다.', '모든 의존성을 mock으로 바꾼 테스트는 등록 누락, JSON binding, 인증 미들웨어 순서, SQL 변환을 검증하지 못한다. 테스트 개수보다 확인하려는 위험에 맞는 경로를 선택한다. 구현 내부 메서드 호출 횟수보다 사용자에게 보이는 결과와 데이터 불변식을 우선 검증한다.']},
      {title: 'WebApplicationFactory로 요청 파이프라인을 통과한다', body: ['WebApplicationFactory는 앱의 호스트를 테스트 환경에서 구성하고 HTTP 클라이언트로 요청을 보낼 수 있게 한다. endpoint 선택, 직렬화, 필터·미들웨어, DI 구성까지 통과시키는 통합 테스트를 작성할 수 있다. 필요한 외부 의존성만 테스트용으로 교체한다.', '기본적인 in-memory TestServer 테스트는 실제 소켓·TLS·프록시·Kestrel 제한을 모두 재현하지 않는다. 이를 검증하려면 해당 서버를 띄운 별도 smoke/E2E 테스트가 필요하다. 브라우저에서 실행되는 CORS·쿠키 동작도 HTTP 클라이언트 테스트만으로 증명되지 않는다.']},
      {title: '관계형 DB의 의미는 가짜 저장소와 다르다', body: ['InMemory provider나 단순 리스트는 운영 DB의 unique constraint, 격리 수준, provider별 SQL을 동일하게 재현하지 않는다. 저장 성공을 반환하는 mock으로 중복 접수 방지를 검증했다면 핵심 제약을 테스트하지 않은 셈이다.', '중요한 저장 경로는 운영과 같은 종류의 DB에서 확인한다. 테스트 간 데이터 격리와 초기화 전략을 정하고 마이그레이션도 적용한다. SQLite도 유용한 테스트 도구지만 운영 DB와의 차이를 기록한다. 테스트 컨테이너 실행은 환경이 지원할 때 사용하며 존재하지 않는 런타임을 성공으로 간주하지 않는다.']},
      {title: '실패를 재현할 수 있어야 복구를 검증한다', body: ['외부 응답 지연, DB 제약 위반, 중복 요청, 취소, 작업 중 종료를 테스트 케이스로 만든다. 동시에 두 요청을 보내는 테스트에서는 우연한 sleep보다 barrier 같은 동기화 수단으로 경합 지점을 맞춘다. 그렇지 않으면 테스트가 통과해도 실제 경쟁 조건을 지나갔는지 알 수 없다.', '좋은 테스트 보고서는 입력, 실행 경로, 관찰한 결과, 검증하지 않은 경계를 함께 적는다. 예를 들어 API→실제 DB 통합 테스트 통과와 컨테이너 배포·운영 로그 확인은 별도 증거다. Spring의 테스트 slice나 Rails의 request test도 같은 관점으로 범위를 확인한다.']}
    ],
    flow: ['위험 선택', '검증 경계 선택', '실패 조건 재현', '결과·불변식 확인', '남은 범위 기록'],
    code: {lang: 'csharp', caption: 'xUnit 통합 테스트 조각. 테스트 프로젝트에 Mvc.Testing 참조와 접근 가능한 Program 타입이 필요하다.', text: `public sealed class JobApiTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Unauthenticated_request_is_rejected()
    {
        using var client = factory.CreateClient(
            new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false
            });
        var response = await client.GetAsync("/jobs/11111111-1111-1111-1111-111111111111");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}`},
    lab: {kind: 'testing', title: '이 테스트는 어디까지 통과하는가?', predict: '서비스를 직접 호출하는 테스트에서 인증 미들웨어 오류를 찾을 수 있을까?', steps: ['테스트 종류를 선택한다.', '포함되는 경로와 빠지는 경로를 확인한다.', 'TLS·DB 제약·업무 규칙에 적합한 검증을 각각 고른다.'], explain: '도식은 대표적인 테스트 구성의 경계를 설명한다. 통합 테스트라는 이름만으로 실제 DB나 네트워크를 사용한다고 단정할 수 없다.'},
    practice: ['같은 업무 규칙을 단위 테스트와 API 통합 테스트에서 각각 검증한다.', 'unique constraint가 적용된 실제 DB에서 동시 중복 요청을 보낸다.', '테스트용 인증을 사용한 경우 실제 토큰 검증은 빠졌다고 보고서에 적는다.', '별도 Kestrel smoke test로 프록시 설정과 요청 크기 제한을 확인한다.'],
    quiz: {q: '기본 in-memory TestServer 통합 테스트가 통과했다. 바로 입증할 수 있는 것은?', options: ['운영 TLS 인증서와 프록시가 정상이다.', '테스트에 구성한 요청 파이프라인이 기대한 결과를 냈다.', '모든 브라우저에서 쿠키가 같은 방식으로 동작한다.'], answer: 1, why: '증거는 실행한 환경과 경로에 한정된다. 소켓·TLS·브라우저 정책·운영 프록시는 각각 실제 경로의 검증이 필요하다.'},
    sources: [{label: 'Microsoft · ASP.NET Core 통합 테스트', url: 'https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0'}, {label: 'Microsoft · EF Core 테스트 전략', url: 'https://learn.microsoft.com/en-us/ef/core/testing/choosing-a-testing-strategy'}]
  },
  {
    id: 15, title: '관측 가능한 서비스와 안전한 배포', kicker: 'OPERATIONS · 관측과 종료',
    lead: '배포는 성공했지만 사용자는 느리다고 말한다. 로그, 지표, trace가 각각 어떤 질문에 답하는지 연결한다.',
    objectives: ['로그·metric·trace를 같은 요청과 연결한다.', 'liveness와 readiness를 목적에 맞게 구분한다.', '종료·마이그레이션·롤백의 조건을 설명한다.'],
    sections: [
      {title: '로그는 사건, 지표는 추세, trace는 연결을 보여 준다', body: ['구조화 로그는 작업 ID, 상태, 오류 코드처럼 검색 가능한 필드로 사건을 기록한다. 메시지 문자열에 모든 정보를 끼워 넣으면 같은 종류의 실패를 묶기 어렵다. 로그 레벨과 개인정보 처리 기준을 정하고 정상 경로의 과도한 로그도 비용으로 취급한다.', 'metric은 요청 수·오류율·지연 분포·큐 길이를 시간에 따라 관찰한다. 사용자 ID나 작업 ID를 metric label로 쓰면 시계열 수가 폭증할 수 있다. 개별 요청의 DB·외부 HTTP 시간을 연결하려면 trace를 사용한다. trace ID를 로그에 포함하면 지표에서 발견한 이상을 구체적인 사건으로 좁힐 수 있다.']},
      {title: '관측도 비용과 누락을 가진다', body: ['OpenTelemetry의 instrument와 exporter를 구성하면 공통 형식으로 데이터를 수집할 수 있다. 수집했다고 모든 요청이 저장되는 것은 아니다. sampling과 보존 기간, exporter 실패를 이해해야 한다. trace가 없다는 사실만으로 요청이 없었다고 결론 내리지 않는다.', '오류 응답률만 보면 오래 대기하다 연결을 끊은 사용자 경험을 놓칠 수 있다. 서버 지연, 클라이언트 timeout, 취소 수, 큐 대기를 함께 본다. 배포 버전과 환경을 관측 데이터에 남겨 변화 시점과 원인을 비교한다.']},
      {title: '살아 있음과 요청을 받을 준비는 다르다', body: ['liveness는 프로세스를 재시작해야 하는지 판단하는 신호이고, readiness는 현재 트래픽을 받아도 되는지 판단하는 신호다. 외부 DB의 일시 장애를 liveness 실패로 연결하면 정상 프로세스를 계속 재시작하는 악순환이 생길 수 있다.', 'readiness에서 어떤 의존성을 검사할지는 서비스 기능과 장애 격리 정책에 달려 있다. 검사 자체가 DB에 부하를 주지 않도록 빈도와 timeout도 제한한다. 헬스 endpoint가 200이라는 사실이 모든 업무 기능의 정상 동작을 보장하지는 않는다.']},
      {title: '배포 중에는 신구 버전이 함께 존재한다', body: ['컬럼을 즉시 이름 변경하면 이전 버전이 아직 실행 중일 때 오류가 발생할 수 있다. 먼저 호환 가능한 스키마를 추가하고 신구 코드가 함께 동작하게 한 뒤 오래된 필드를 제거하는 단계적 변경을 고려한다. 앱 롤백만으로 데이터 변환을 되돌릴 수 있는지도 따로 확인한다.', '종료 신호를 받으면 신규 요청 유입을 줄이고 진행 중 작업을 drain한다. 플랫폼의 종료 유예 시간과 앱 timeout을 맞춘다. 프록시 뒤에서는 forwarded header를 신뢰할 프록시 범위와 함께 구성해야 원래 scheme·주소를 안전하게 해석할 수 있다. 배포 완료와 실제 요청 성공은 별도로 확인한다.']}
    ],
    flow: ['요청·trace ID', '앱 span', 'DB·HTTP span', '지표 이상 탐지', '로그로 사건 확인'],
    code: {lang: 'csharp', caption: '구조화 로그와 사용자 정의 Activity 조각. ActivitySource를 수집하도록 OpenTelemetry 설정이 필요하다.', text: `private static readonly ActivitySource Source = new("Course.Jobs");

public async Task ProcessAsync(Guid jobId, CancellationToken ct)
{
    using var activity = Source.StartActivity("job.process");
    activity?.SetTag("job.id", jobId.ToString());
    logger.LogInformation("작업 {JobId} 처리 시작", jobId);
    await processor.ExecuteAsync(jobId, ct);
    logger.LogInformation("작업 {JobId} 처리 완료", jobId);
}
// job.id 같은 고유 값은 metric label로 사용하지 않는다.`},
    lab: {kind: 'operations', title: '준비와 종료는 다른 상태다', predict: '프로세스가 살아 있다는 사실만으로 트래픽을 보내도 될까? 종료 신호를 받은 뒤 진행 중 작업은 어떻게 해야 할까?', steps: ['배포 중 상황에서 준비 전 트래픽 유입을 선택한다.', '다음 단계로 진행하며 프로세스 생존, readiness, 트래픽 허용을 구분한다.', '종료 신호 후 작업 중으로 바꾸고 처음부터 진행한다. 새 트래픽 제한, 종료 유예, 복구 정책을 확인한다.'], explain: '시작 준비와 종료 절차를 비교하는 개념 도식이다. 실제 health probe, 컨테이너, OpenTelemetry 수집기에 연결하지 않으며 graceful shutdown만으로 작업 영속성이 생기지는 않는다.'},
    practice: ['작업 ID 하나로 접수·처리·완료 로그와 trace를 연결한다.', '외부 호출만 느리게 만들어 서버 CPU와 지연의 관계를 관찰한다.', 'readiness 실패가 트래픽에, liveness 실패가 재시작에 주는 영향을 별도로 검증한다.', '신구 앱 버전이 같은 스키마를 사용하는 구간과 롤백 절차를 문서화한다.'],
    quiz: {q: '사용자 ID를 요청 수 metric의 label로 넣을 때 주요 문제는?', options: ['모든 로그가 자동 암호화된다.', '사용자 수에 따라 시계열 수와 수집 비용이 커질 수 있다.', 'trace가 반드시 비활성화된다.'], answer: 1, why: '고유 값이 많은 label은 cardinality를 크게 만든다. 개별 사건의 식별자는 로그·trace에 두고 지표에는 집계 가능한 차원을 사용한다.'},
    sources: [{label: 'Microsoft · OpenTelemetry 관측', url: 'https://learn.microsoft.com/en-us/dotnet/core/diagnostics/observability-with-otel'}, {label: 'Microsoft · Health checks', url: 'https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks?view=aspnetcore-10.0'}, {label: 'Microsoft · 프록시와 로드밸런서 구성', url: 'https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0'}]
  },
  {
    id: 16, title: '느리다는 말을 숫자로 바꾸기', kicker: 'MEASUREMENT · 부하와 병목',
    lead: '평균 20ms인 API도 일부 사용자는 2초를 기다릴 수 있다. 처리량·지연·오류율을 함께 측정해 시스템의 한계를 찾는다.',
    objectives: ['처리량과 지연 백분위의 의미를 설명한다.', '부하 모델과 측정 조건을 고정한다.', 'CPU·DB·스레드·큐 병목을 관측으로 구분한다.'],
    sections: [
      {title: '평균 하나로 사용자 경험을 설명하지 않는다', body: ['처리량은 단위 시간에 완료한 작업 수이고 지연은 요청 하나가 걸린 시간이다. p95는 측정한 요청 중 약 95%가 그 값 이하였다는 뜻이다. 평균이 낮아도 긴 꼬리 지연이 클 수 있으므로 p50·p95·p99와 오류율, timeout 수를 함께 기록한다.', '성공 응답만 모으면 빠르게 실패하거나 timeout한 요청이 통계에서 빠져 좋은 수치처럼 보일 수 있다. 시작·완료·실패의 수를 맞추고 측정 구간, 요청 종류, 응답 크기를 기록한다. 백분위는 분포에서 계산해야 하며 여러 서버의 p95를 단순 평균해 전체 p95로 쓰지 않는다.']},
      {title: '부하 발생 방식도 결과를 바꾼다', body: ['고정된 클라이언트 수가 응답 후 다음 요청을 보내는 폐쇄형 부하는 서버가 느려지면 유입도 줄어든다. 일정 도착률을 유지하는 개방형 부하는 적체를 더 분명하게 보여 줄 수 있다. 어느 것이 실제 사용 패턴에 가까운지 정하고 결과에 명시한다.', '부하 발생기의 CPU·네트워크가 먼저 포화되면 서버 한계로 오해할 수 있다. 작은 응답의 로컬 테스트와 TLS·프록시·원격 DB를 포함한 테스트는 다른 실험이다. warm-up 후 안정 구간을 측정하고 같은 데이터 크기와 연결 재사용 조건으로 반복한다.']},
      {title: '대기열을 보면 처리량의 한계를 이해할 수 있다', body: ['유입률이 지속 가능한 처리율에 가까워질수록 변동을 흡수할 여유가 줄어들고 대기 시간이 커진다. 처리율보다 유입률이 높은 상태가 계속되면 큐가 증가하거나 거절·timeout이 발생한다. worker 수를 늘려도 DB 연결이나 CPU가 이미 포화라면 개선되지 않을 수 있다.', '안정 상태에서 평균 시스템 내 작업 수 L, 평균 도착률 λ, 평균 체류 시간 W는 Little 법칙 L = λW로 연결된다. 단위와 측정 경계를 맞춰야 하며 계속 적체되는 비정상 상태에 무조건 적용하지 않는다. 실험의 큐 모델은 이 관계의 직관을 설명한다.']},
      {title: '병목 가설은 서로 다른 지표로 교차 확인한다', body: ['CPU가 높으면 trace나 profiler로 계산이 집중된 경로를 본다. CPU는 낮고 ThreadPool 큐가 커지면 동기 대기나 스레드 고갈을 의심한다. DB 연결 대기가 길면 연결 누수·긴 트랜잭션·쿼리 지연을 구분한다. GC 시간이 늘면 할당량과 살아남는 객체를 확인한다.', 'dotnet-counters로 추세를 보고 dotnet-trace나 profiler로 경로를 좁힌다. 도구 자체의 오버헤드도 있으므로 최종 성능 수치는 진단 도구 사용 조건을 명시한다. 한 가지 가설을 바꾼 뒤 동일 부하로 다시 측정해야 인과관계를 판단하기 쉽다. 측정 중 배포나 자동 확장이 발생했다면 자원 조건이 달라졌으므로 해당 구간을 분리해 기록한다.']}
    ],
    flow: ['워크로드 고정', '기준 측정', '병목 가설', '한 가지 변경', '동일 조건 재측정'],
    code: {lang: 'shell', caption: '진단 도구가 이미 설치된 환경에서 실행하는 명령 예시. 실제 process ID와 런타임별 지원 counter를 확인한다.', text: `# 실행 중인 .NET 프로세스 확인
dotnet-counters ps

# <PID>를 대상 프로세스 번호로 바꾼다.
dotnet-counters monitor --process-id <PID> --counters System.Runtime

# 짧은 구간을 수집하고 종료한다.
dotnet-trace collect --process-id <PID> --duration 00:00:30

# 기록할 조건: 버전 / CPU·메모리 제한 / 데이터 크기 /
# 동시성·도착률 / warm-up / 측정 시간 / 성공·실패 수`},
    lab: {kind: 'load', title: '처리량보다 유입이 많아지면?', predict: '처리 한계를 넘은 요청은 사라질까, 대기하거나 거절될까?', steps: ['유입률을 낮은 값에서 점진적으로 올린다.', '처리 용량과 대기량의 변화를 비교한다.', '용량을 늘린 경우와 유입을 제한한 경우를 비교한다.'], explain: '화면 수치는 가정한 서비스 시간으로 계산한 개념 모델이다. 실제 ASP.NET Core 처리량·p95 예측이나 프레임워크 벤치마크로 사용하지 않는다.'},
    practice: ['부하 조건과 성공·오류·timeout을 포함하는 결과 양식을 작성한다.', '평균과 p95를 함께 기록하고 꼬리 지연이 달라지는 조건을 찾는다.', '느린 DB와 CPU 계산을 각각 넣고 지표 차이를 관찰한다.', '개선 전후 같은 조건으로 반복 측정하고 분산까지 기록한다.'],
    quiz: {q: '오류율이 0%에서 30%로 늘었지만 성공 요청의 p95가 줄었다. 성능 개선인가?', options: ['p95가 줄었으니 항상 개선이다.', '실패한 요청까지 포함해 처리량·오류·지연을 함께 평가해야 한다.', '평균만 보면 충분하다.'], answer: 1, why: '빠른 거절이나 timeout 제외로 성공 요청 지연만 좋아 보일 수 있다. 수행한 유효 작업과 사용자의 실패 경험까지 함께 봐야 한다.'},
    sources: [{label: 'Microsoft · ASP.NET Core 성능 개요', url: 'https://learn.microsoft.com/en-us/aspnet/core/performance/overview?view=aspnetcore-10.0'}, {label: 'Microsoft · .NET 진단 도구', url: 'https://learn.microsoft.com/en-us/dotnet/core/diagnostics/'}, {label: 'Microsoft · ThreadPool starvation 진단', url: 'https://learn.microsoft.com/en-us/dotnet/core/diagnostics/debug-threadpool-starvation'}]
  },
  {
    id: 17, title: '먼저 일을 줄이고, 그다음 재사용한다', kicker: 'OPTIMIZATION · SQL와 캐시',
    lead: 'API가 느리다고 곧바로 캐시부터 붙이면 오래된 데이터와 무효화 문제가 추가된다. 불필요한 쿼리·전송·계산부터 줄인다.',
    objectives: ['쿼리 수·행 수·열 수를 구분해 최적화한다.', '캐시 hit와 miss, 무효화 비용을 함께 계산한다.', '정확성·메모리·지연의 절충을 설명한다.'],
    sections: [
      {title: 'SQL을 확인하기 전에는 ORM을 탓하지 않는다', body: ['목록을 조회한 뒤 각 항목의 연관 데이터를 한 번씩 읽으면 N+1 왕복이 생길 수 있다. Include로 합치더라도 여러 collection을 한 번에 join하면 행이 크게 늘어날 수 있다. 단일 쿼리와 split query의 왕복·전송량·일관성 절충을 실제 SQL과 데이터 크기로 판단한다.', '화면에 필요한 열만 projection하고 결과 개수를 제한한다. 읽기 전용 엔티티에는 tracking이 필요한지 검토한다. 인덱스는 조회를 빠르게 할 수 있지만 저장 비용과 공간을 늘린다. 실행 계획에서 실제로 쓰이는지 확인해야 하며 LINQ 문장이 짧다고 효율적인 쿼리는 아니다.']},
      {title: '페이지와 스트리밍은 작업량의 상한을 만든다', body: ['큰 목록을 모두 메모리에 올린 뒤 JSON으로 만들면 할당량·응답 크기·GC 부담이 증가한다. 페이지 크기에 상한을 두고 안정적인 정렬을 사용한다. 큰 offset에서 비용이 커지면 keyset pagination을 검토하되 임의 페이지 이동 같은 요구와 비교한다.', '스트리밍은 첫 데이터 도착과 메모리 사용을 개선할 수 있지만 느린 소비자가 연결과 DB reader를 오래 유지할 수 있다. 중간에 오류가 나면 이미 시작된 응답을 일반 오류 JSON으로 바꾸기 어렵다. 압축도 전송량과 CPU를 교환하므로 실제 응답 크기와 클라이언트 조건에서 측정한다.']},
      {title: '캐시 키는 정확성의 일부다', body: ['작업 목록을 캐시하면서 사용자·조직·필터를 키에서 빠뜨리면 잘못된 결과나 데이터 노출이 생길 수 있다. 캐시할 데이터의 공유 범위, 유효 기간, 갱신 이후 오래된 값을 허용할 시간을 먼저 정한다. 메모리 캐시는 인스턴스별로 다르며 서버를 늘리면 같은 상태를 보지 않을 수 있다.', 'TTL이 끝난 순간 많은 요청이 동시에 원본을 읽으면 stampede가 발생한다. 키별 요청 병합, 만료 분산, 조건에 맞는 stale 응답 같은 전략을 검토한다. 분산 캐시는 직렬화와 네트워크 비용을 추가한다. hit율이 높아도 miss 비용과 동시 만료 상황이 목표 지연을 깨뜨릴 수 있다.']},
      {title: '최적화 결과는 회귀와 함께 제출한다', body: ['기준 쿼리 수, 반환 행·바이트 수, 지연, CPU·메모리를 기록하고 변경 한 가지씩 비교한다. 예를 들어 필요한 열만 조회한 뒤 감소한 전송량과 p95를 확인한다. 그다음 캐시를 추가해야 어떤 변경이 효과를 냈는지 구분할 수 있다.', '캐시 적용 후 갱신 직후 조회, 권한 변경, 동시 miss, 서버 재시작을 검증한다. 최적화 때문에 잘못된 데이터를 더 빠르게 반환한다면 성공이 아니다. 화면의 가상 캐시 계산은 평균 비용의 직관만 설명하며 실제 tail latency나 stampede를 대신 측정하지 않는다.']}
    ],
    flow: ['SQL·전송 관찰', '불필요한 일 제거', '결과 크기 제한', '필요한 캐시', '정확성·성능 재검증'],
    code: {lang: 'csharp', caption: 'EF Core 조회 조각. Id 정렬을 이용하는 페이지 예이며 db와 조직 권한 검증이 준비되어 있어야 한다.', text: `var items = await db.Jobs
    .AsNoTracking()
    .Where(x => x.OrganizationId == organizationId && x.Id > afterId)
    .OrderBy(x => x.Id)
    .Select(x => new { x.Id, x.Status, x.CreatedAt })
    .Take(Math.Clamp(pageSize, 1, 100))
    .ToListAsync(ct);

// 확인: 생성 SQL, 사용 인덱스, 반환 행 수, 전송 바이트.
// 이 예는 비교 가능한 정수 Id를 가정한다.
// GUID나 복합 정렬 키를 쓰면 페이지 조건을 별도로 설계한다.`},
    lab: {kind: 'cache', title: '캐시 hit율과 원본 비용의 관계', predict: 'hit율이 90%여도 miss 요청의 지연은 자동으로 줄어들까?', steps: ['hit율과 원본 조회 비용을 조절한다.', 'hit·miss 경로와 평균 비용을 비교한다.', '높은 hit율만으로 최악 지연을 설명할 수 없는 이유를 적는다.'], explain: '평균 비용은 hit율 × hit 비용 + miss율 × miss 비용으로 단순화한 개념 계산이다. 실제 대기열, 분산 캐시 네트워크, stampede와 p95는 포함하지 않는다.'},
    practice: ['N+1 사례를 만들고 요청 한 번의 SQL 수를 센다.', 'projection과 페이지 크기 제한 후 전송량과 할당량을 비교한다.', '캐시 키에 조직·사용자·필터가 필요한지 데이터 공유 범위로 판단한다.', '갱신·동시 만료·권한 변경 후 정확성을 검증한다.'],
    quiz: {q: '캐시 키가 작업 목록 URL만 포함하고 사용자·조직을 포함하지 않는다. 가장 먼저 확인할 것은?', options: ['캐시 서버의 CPU 모델', '응답이 사용자·조직별로 달라져 데이터가 섞일 가능성', '색상 테마'], answer: 1, why: '캐시는 성능 기능이면서 데이터 공유 계약이다. 권한 범위가 다른 결과를 같은 키로 재사용하면 데이터 노출이 발생할 수 있다.'},
    sources: [{label: 'Microsoft · EF Core 효율적인 쿼리', url: 'https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying'}, {label: 'Microsoft · 캐시 개요', url: 'https://learn.microsoft.com/en-us/aspnet/core/performance/caching/overview?view=aspnetcore-10.0'}, {label: 'Microsoft · HybridCache', url: 'https://learn.microsoft.com/en-us/aspnet/core/performance/caching/hybrid?view=aspnetcore-10.0'}]
  },
  {
    id: 18, title: '저수준 최적화와 최종 설계 판단', kicker: 'CAPSTONE · 측정으로 선택하기',
    lead: '작은 함수가 2배 빨라졌는데 API 응답은 그대로라면 최적화는 실패했을까? 개선한 비용이 전체에서 차지하는 비중을 먼저 확인한다.',
    objectives: ['할당과 GC 비용을 관측하고 소유권을 지킨다.', 'pooling·Span·ValueTask·AOT의 적용 조건을 설명한다.', '기능·장애·성능 증거를 묶어 설계 결정을 제출한다.'],
    sections: [
      {title: '전체 지연에서 차지하는 비중을 먼저 계산한다', body: ['100ms 요청 중 특정 문자열 처리가 1ms라면 그 부분을 없애도 최대 절감은 1ms다. 반대로 초당 수만 번 실행되는 짧은 할당 경로는 전체 CPU와 GC에 영향을 줄 수 있다. 단일 호출 시간과 전체 호출 빈도를 함께 본다.', 'BenchmarkDotNet 같은 미세 벤치마크는 작은 후보를 비교하는 데 도움이 된다. 그러나 네트워크·DB·큐·경합을 포함한 API 결과까지 자동으로 증명하지는 않는다. warm-up, JIT, 최적화 설정, 입력 분포를 맞추고 마지막에는 실제 요청 부하에서 검증한다.']},
      {title: '객체를 덜 만들면 수명 관리도 달라진다', body: ['불필요한 문자열·배열·boxing은 할당량을 늘린다. 큰 객체와 오래 살아남는 객체는 GC 비용의 양상을 바꿀 수 있다. 먼저 allocation profile로 많은 할당이 어디서 발생하는지 확인한다. 메모리 사용량이 크다는 사실만으로 누수라고 결론 내리지 않는다.', 'ArrayPool은 배열을 재사용하지만 필요한 길이보다 큰 배열을 반환할 수 있고 이전 내용이 남아 있을 수 있다. 사용 범위를 정확히 제한하고 finally에서 반환한다. 반환한 뒤 참조를 사용하면 다른 요청과 데이터가 섞일 수 있다. 민감정보가 있다면 정리 정책과 비용도 검토한다.']},
      {title: 'Span과 ValueTask는 적용 조건이 있는 도구다', body: ['Span<T>는 연속된 메모리를 복사 없이 다루는 뷰다. 소유권과 수명을 늘려 주는 저장소가 아니다. async 경계에서 메모리를 유지해야 한다면 지원되는 사용 범위와 Memory<T> 같은 대안을 고려한다. 작은 복사를 없애려다 코드의 수명 제약을 복잡하게 만들지 않는다.', 'ValueTask는 동기 완료가 흔한 일부 경로에서 할당을 줄일 수 있지만 사용 규칙과 소비 비용을 가진다. Task를 일괄 교체하지 않는다. 같은 ValueTask를 반복 await하거나 여러 소비자가 공유하는 코드를 피하고 필요한 경우 명시적인 Task 전환을 검토한다. 실제 이익이 없는 곳에서는 단순한 Task가 읽기 쉽다.']},
      {title: 'AOT는 배포 특성과 호환성을 함께 바꾼다', body: ['Native AOT는 배포 전에 기계어를 생성하고 사용하지 않는 코드를 제거하는 방향으로 시작 시간과 메모리 사용량을 줄일 수 있다. 모든 애플리케이션에서 steady-state 처리량이 더 높다는 뜻은 아니다. JIT의 실행 중 최적화와 다른 절충을 가진다.', '동적 코드 생성·reflection에 의존하는 라이브러리는 trimming과 AOT 호환성을 확인해야 한다. ASP.NET Core 기능별 지원 범위도 버전에 따라 다르다. publish 경고를 무시하지 말고 실제 배포 산출물로 직렬화·인증·데이터 접근을 검증한다. Go의 배포 방식과 비교할 때도 런타임·GC·진단 도구를 포함한 조건을 맞춘다.']},
      {title: '최종 과제: 선택의 이유를 증거로 설명한다', body: ['파일 업로드·비동기 처리 API에 접수·상태 조회·권한·취소·재시도·관측을 연결한다. 먼저 단순 구현으로 정확성을 확보하고 장애 지점을 넣는다. 그다음 가장 큰 병목을 하나씩 고친다. 개념 실험 화면의 수치를 실제 서버 측정 결과로 제출하지 않는다.', '최종 문서에는 요구사항, 선택한 경계, ASP.NET Core를 택한 이유, Spring Boot·Rails 등 다른 선택이 적합해지는 조건을 담는다. API→DB 테스트, 프로세스 종료 복구, 동일 조건 부하 결과를 별도로 적는다. 코드 실행이나 배포 검증을 못했다면 미검증으로 남긴다. 완성 기준은 패턴을 많이 넣은 코드가 아니라 실패와 비용을 설명할 수 있는 시스템이다.']}
    ],
    flow: ['hot path 확인', '할당·CPU 측정', '소유권 유지', '후보 최적화', 'API 전체 재측정'],
    code: {lang: 'csharp', caption: 'ArrayPool 소유권을 보여 주는 조각. 실제 최적화 효과는 입력 크기와 부하에서 측정해야 한다.', text: `byte[] buffer = ArrayPool<byte>.Shared.Rent(4096);
try
{
    int read = await input.ReadAsync(buffer.AsMemory(0, 4096), ct);
    await output.WriteAsync(buffer.AsMemory(0, read), ct);
}
finally
{
    ArrayPool<byte>.Shared.Return(buffer, clearArray: true);
}
// 반환 뒤 buffer를 사용하거나 다른 비동기 작업에 넘기지 않는다.
// 이것은 한 청크 복사 예시이며 전체 스트림 복사 루프는 아니다.`},
    lab: {kind: 'allocation', title: '동시에 사용하는 버퍼는 얼마나 필요한가?', predict: '같은 크기의 버퍼를 여러 작업이 동시에 사용한다면 pool을 써도 동시 사용량이 줄어들까?', steps: ['동시 작업 수와 작업당 버퍼 크기를 바꾼다.', '매번 할당과 pool 재사용을 비교한다. 동시 사용 버퍼 합, 다음 동일 batch의 신규 할당, 반납 이후 상태를 확인한다.', 'pool이 반복 할당을 줄여도 보유 메모리가 남는 이유와 이 값만으로 GC pause 시간을 알 수 없는 이유를 설명한다.'], explain: '동시 작업 수 × 작업당 버퍼 KB로 계산한 동시 사용량의 개념 모델이며 초당 할당률을 계산하지 않는다. pool은 워밍업 뒤 충분한 버퍼를 재사용할 수 있다고 가정한다. 실제 배열 header·정렬·pool bucket 크기·보유량·GC 세대와 pause 시간은 재현하지 않는다.'},
    practice: ['프로파일에서 확인한 hot path 하나만 후보로 선택한다.', '최적화 전후의 코드 복잡성·할당량·CPU·API p95를 기록한다.', 'pool 사용 시 예외와 취소에서도 반환되는지, 반환 뒤 사용이 없는지 검토한다.', '최종 프로젝트에 중복 요청·프로세스 종료·타인 리소스 접근 테스트를 포함한다.', '설계 결정 문서에 대안·근거·남은 미검증 항목을 작성한다.'],
    quiz: {q: '100ms API에서 1ms를 쓰는 함수가 2배 빨라졌다. 다른 조건이 같다면 예상 절감은?', options: ['약 50ms', '약 0.5ms', '항상 0ms'], answer: 1, why: '개선 대상의 비중이 전체 이익을 제한한다. 1ms가 0.5ms가 되면 전체는 약 99.5ms다. 실제 부하에서는 GC·경합 영향도 추가로 측정한다.'},
    sources: [{label: 'Microsoft · ASP.NET Core Native AOT', url: 'https://learn.microsoft.com/en-us/aspnet/core/fundamentals/native-aot?view=aspnetcore-10.0'}, {label: 'Microsoft · ArrayPool', url: 'https://learn.microsoft.com/en-us/dotnet/api/system.buffers.arraypool-1?view=net-10.0'}, {label: 'Microsoft · ValueTask 사용 규칙', url: 'https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.valuetask?view=net-10.0'}, {label: 'Microsoft · 메모리와 Span 사용 지침', url: 'https://learn.microsoft.com/en-us/dotnet/standard/memory-and-spans/memory-t-usage-guidelines'}]
  }
];
