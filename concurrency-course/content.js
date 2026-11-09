// All text is plain text. C# / .NET 10 course content.
window.COURSE = [
  {
    "id": 1,
    "title": "프로그램은 어떻게 실행될까?",
    "kicker": "01 / EXECUTION",
    "lead": "CPU가 명령을 실행하는 순간과 프로그램이 기다리는 순간을 분리해 봅니다. 동시성을 이해하는 첫 단위는 함수가 아니라 실행 흐름입니다.",
    "objectives": [
      "CPU·메모리·운영체제의 역할을 구분한다.",
      "함수 호출을 코드 위치와 호출 스택으로 설명한다.",
      "경과 시간과 CPU 사용 시간을 구분한다."
    ],
    "sections": [
      {
        "title": "CPU는 실행 위치를 따라 명령을 처리합니다",
        "body": "C# 소스는 컴파일되어 IL이 되고, 보통 런타임의 JIT 컴파일을 거쳐 기계 코드로 실행됩니다. CPU는 현재 실행할 명령의 위치와 레지스터 값을 가지고 계산을 진행합니다. 변수 이름을 직접 읽는 기계는 아닙니다.\n\n이 장의 도식은 소스 한 줄을 한 단계로 묶은 모델입니다. 실제 소스 한 줄은 여러 명령으로 나뉘고, 최적화로 합쳐지거나 없어질 수 있습니다."
      },
      {
        "title": "호출 스택은 돌아갈 위치를 기억합니다",
        "body": "Main이 Double을 호출하면 Double의 실행에 필요한 프레임이 현재 호출 흐름 위에 놓입니다. 함수가 끝나면 호출자에게 돌아갑니다. 일반적인 동기 함수 호출은 새 스레드를 만들지 않습니다.\n\n메모리 그림에서 스택에는 호출 프레임과 지역 상태를, 관리 힙에는 배열 같은 객체를 배치합니다. 이는 이해를 위한 분류입니다. 값 형식과 참조 형식을 각각 무조건 스택과 힙에 대응시키면 안 됩니다. JIT 최적화와 객체를 포함한 위치에 따라 실제 배치가 달라집니다."
      },
      {
        "title": "파일과 네트워크는 운영체제를 거칩니다",
        "body": "프로그램은 운영체제 API와 시스템 호출을 통해 파일 읽기, 소켓 통신, 대기 같은 서비스를 요청합니다. 커널은 장치와 자원을 관리하고, 실행 가능한 스레드를 CPU에 배정합니다.\n\n파일을 요청했다고 CPU가 디스크 내부에서 데이터를 찾는 것은 아닙니다. 장치가 일하는 동안 호출 스레드는 잠들거나, 요청을 등록한 뒤 다른 일을 할 수 있습니다. 그 차이가 이후의 블로킹·비동기 처리로 이어집니다."
      },
      {
        "title": "100 ms가 지났다고 100 ms 계산한 것은 아닙니다",
        "body": "경과 시간은 시작부터 끝까지 시계로 잰 시간입니다. CPU 시간은 실제 CPU에서 실행한 시간을 셉니다. Thread.Sleep(100)은 호출 스레드를 재우므로 경과 시간은 늘지만 그 스레드가 계속 CPU를 사용하지는 않습니다.\n\nProcess.TotalProcessorTime은 프로세스 전체의 CPU 시간입니다. 런타임의 다른 스레드도 포함되므로 정확히 0이 나올 필요는 없습니다. 반대로 여러 코어가 병렬로 계산하면 프로세스 CPU 시간이 경과 시간보다 클 수도 있습니다."
      }
    ],
    "trap": {
      "myth": "함수를 호출하면 별도 실행 흐름이 만들어진다.",
      "truth": "동기 함수 호출은 보통 같은 스레드의 호출 스택을 이어 사용합니다. 스레드 생성이나 Task 스케줄링은 별도의 동작입니다."
    },
    "exercise": {
      "file": "examples/ConcurrencyLab/01Execution.cs",
      "steps": [
        "concurrency-course 폴더에서 dotnet run --project examples/ConcurrencyLab -- 01 실행",
        "호출 스택에서 Double → Run → 진입점의 연결을 찾는다.",
        "Sleep 전후 경과 시간과 프로세스 CPU 시간을 비교한다.",
        "Sleep을 간단한 반복 계산으로 바꿨을 때 두 시간이 어떻게 바뀔지 먼저 예상한다."
      ],
      "expected": "Double의 결과는 4입니다. Sleep 대기에서 경과 시간은 약 100 ms 이상 증가하고 CPU 시간 증가는 상대적으로 작습니다. 시간 값은 환경에 따라 달라집니다."
    },
    "quiz": [
      {
        "question": "Thread.Sleep 동안 호출 스레드는 무엇을 하나요?",
        "options": [
          "CPU를 계속 계산에 사용한다",
          "대기하며 CPU를 다른 스레드에 넘길 수 있다",
          "새 스레드를 만들어 대기를 대신시킨다"
        ],
        "correct": 1,
        "explanation": "Sleep은 호출 스레드를 대기시킵니다. 기다림 자체가 새 전용 스레드를 요구하지는 않습니다."
      },
      {
        "question": "동기 함수 Double을 한 번 호출하면 반드시 생기는 것은?",
        "options": [
          "새 프로세스",
          "새 OS 스레드",
          "호출 후 돌아갈 흐름"
        ],
        "correct": 2,
        "explanation": "함수 호출과 스레드 생성은 다릅니다. 호출 스택은 호출자에게 돌아갈 흐름을 관리합니다."
      }
    ],
    "takeaway": "먼저 계산과 기다림을 구분하세요. CPU를 쓰는 시간과 완료를 기다리는 시간은 다릅니다.",
    "code": "var watch = Stopwatch.StartNew();\nThread.Sleep(100); // 현재 스레드 대기\nConsole.WriteLine(watch.Elapsed.TotalMilliseconds);\n// 경과 시간과 Process.TotalProcessorTime을 비교합니다."
  },
  {
    "id": 2,
    "title": "프로세스와 스레드, CPU의 시간 나누기",
    "kicker": "02 / SCHEDULING",
    "lead": "코어 하나에서도 여러 작업의 진행은 겹칠 수 있습니다. 스케줄러가 실행 대상을 바꾸는 과정을 타임라인으로 확인합니다.",
    "objectives": [
      "동시성과 병렬성을 구분한다.",
      "프로세스의 주소 공간과 스레드의 공유 메모리를 설명한다.",
      "컨텍스트 스위칭과 시간 할당량의 영향을 예측한다."
    ],
    "sections": [
      {
        "title": "프로세스는 자원과 주소 공간의 경계입니다",
        "body": "프로세스는 프로그램 실행에 필요한 주소 공간과 자원을 가진 운영체제 단위입니다. 다른 프로세스의 일반 메모리를 자기 변수처럼 바로 읽고 쓰지는 못합니다. 데이터를 주고받으려면 파이프·소켓·공유 메모리 같은 명시적인 통로가 필요합니다.\n\n예제의 자식 프로세스에는 명령행으로 문자열을 전달합니다. 자식이 만든 리스트가 부모의 리스트와 내용이 비슷해도 같은 객체는 아닙니다."
      },
      {
        "title": "스레드는 실행 흐름이며 메모리를 공유합니다",
        "body": "한 프로세스의 스레드는 같은 관리 힙과 자원을 공유합니다. 각 스레드는 자기 실행 위치, 레지스터 상태, 호출 스택을 가집니다. 스레드 A가 공유 리스트를 바꾸면 B도 그 변경을 볼 수 있지만, 안전한 순서와 가시성을 확보하려면 동기화가 필요합니다.\n\n스택이 따로 있다는 사실만으로 지역 변수가 항상 안전해지는 것은 아닙니다. 두 지역 변수가 같은 힙 객체를 참조하거나 클로저가 상태를 공유하면 경쟁이 가능합니다."
      },
      {
        "title": "동시성은 진행이 겹치고, 병렬성은 실행이 겹칩니다",
        "body": "코어 하나가 A를 잠깐 실행하고 B를 실행한 뒤 A로 돌아가도 두 작업의 진행 구간은 겹칩니다. 이것이 동시성입니다. 두 코어가 같은 순간에 A와 B를 실행하면 병렬성도 있습니다.\n\n스케줄러는 실행 가능한 스레드 중에서 CPU를 사용할 대상을 정합니다. 대기 중인 스레드가 항상 CPU 차례를 차지하는 것은 아닙니다. I/O를 기다리는 동안 다른 스레드를 실행할 수 있습니다."
      },
      {
        "title": "실행 대상을 바꾸는 일에도 비용이 듭니다",
        "body": "컨텍스트 스위칭은 현재 실행 상태를 보존하고 다른 스레드의 상태를 복원하는 작업입니다. 캐시와 CPU 내부 상태에도 영향을 줍니다. 시간 할당량을 줄이면 한 작업이 오래 독점하는 것을 줄일 수 있지만 전환 횟수가 늘어납니다.\n\n이 장의 모델은 전환 비용을 생략합니다. 실제 OS 스케줄러에는 우선순위, 코어별 큐, 깨우기 정책과 공정성 같은 요소가 더 있습니다."
      }
    ],
    "trap": {
      "myth": "스레드를 100개 만들면 CPU 계산도 100배 빨라진다.",
      "truth": "실제로 같은 순간 계산할 수 있는 양은 가용 코어와 다른 병목에 제한됩니다. 스레드를 지나치게 늘리면 전환 비용과 메모리 사용량이 커집니다."
    },
    "exercise": {
      "file": "examples/ConcurrencyLab/02ProcessThread.cs",
      "steps": [
        "concurrency-course 폴더에서 dotnet run --project examples/ConcurrencyLab -- 02 실행",
        "스레드 A와 B의 PID가 같고 공유 리스트에 두 값이 쌓이는지 확인한다.",
        "자식 프로세스의 PID와 부모 PID를 비교한다.",
        "자식의 child 원소가 부모 리스트에는 생기지 않는 이유를 설명한다."
      ],
      "expected": "부모의 공유 리스트 원소 수는 2입니다. 자식 리스트에는 child가 추가되지만 부모 원소 수는 그대로 2입니다. A와 B의 출력 순서는 달라질 수 있습니다."
    },
    "quiz": [
      {
        "question": "코어 하나가 A와 B를 번갈아 실행한다면?",
        "options": [
          "동시성은 있지만 두 작업의 CPU 병렬 실행은 없다",
          "반드시 병렬 실행이다",
          "동시성도 없다"
        ],
        "correct": 0,
        "explanation": "진행 구간이 겹치는 동시성은 코어 하나에서도 가능합니다. CPU에서 같은 순간 실행하려면 둘 이상의 실행 자원이 필요합니다."
      },
      {
        "question": "같은 프로세스의 스레드 둘이 일반적으로 공유하는 것은?",
        "options": [
          "현재 호출 스택 전체",
          "항상 같은 실행 위치",
          "관리 힙의 객체"
        ],
        "correct": 2,
        "explanation": "스레드는 같은 프로세스의 관리 힙을 공유합니다. 각 스레드의 호출 스택과 실행 위치는 별도로 관리합니다."
      }
    ],
    "takeaway": "동시에 진행하는 작업 수와 실제로 병렬 계산하는 작업 수를 따로 세세요.",
    "code": "var shared = new List<string>();\nvar gate = new object();\nvar thread = new Thread(() => {\n    lock (gate) shared.Add(\"A\");\n});\nthread.Start();\nthread.Join();"
  },
  {
    "id": 3,
    "title": "I/O: 기다리는 동안 무엇을 할까?",
    "kicker": "03 / WAITING",
    "lead": "응답에 80 ms 걸리는 서버에 요청 여섯 개를 보냅니다. 한 요청을 빠르게 만드는 대신, 서로의 대기를 겹쳐 봅니다.",
    "objectives": [
      "블로킹과 논블로킹을 호출 스레드 관점에서 구분한다.",
      "동기·비동기 API의 완료 전달 방식을 구분한다.",
      "I/O 대기 겹치기가 전체 시간에 미치는 영향을 설명한다."
    ],
    "sections": [
      {
        "title": "블로킹은 호출 스레드가 기다리는 방식입니다",
        "body": "블로킹 읽기는 결과가 준비될 때까지 호출 스레드를 기다리게 할 수 있습니다. 논블로킹 읽기는 당장 처리할 수 없으면 즉시 그 사실을 알려줍니다. 논블로킹 API를 반복 호출하며 계속 확인하면 바쁜 대기가 되어 CPU를 낭비할 수도 있습니다.\n\n즉시 반환만 한다고 좋은 비동기 설계가 되는 것은 아닙니다. 운영체제의 준비 상태 알림이나 완료 통지와 연결해, 필요할 때만 다시 실행해야 합니다."
      },
      {
        "title": "비동기는 완료를 나중에 전달하는 계약입니다",
        "body": "동기 API는 호출의 반환과 결과를 받는 흐름을 연결합니다. 비동기 API는 작업의 완료를 Task 같은 별도 수단으로 전달합니다. 호출자는 완료될 때까지 다른 작업을 진행할 수 있습니다.\n\n블로킹·논블로킹은 호출 스레드의 대기 방식, 동기·비동기는 API의 완료 전달 계약이라는 서로 다른 관점입니다. 운영체제의 준비 상태 통지는 지금 읽을 가능성이 있다는 뜻이고, 완료 통지는 요청한 동작이 끝났다는 뜻입니다. 프레임워크는 이 차이를 감춰 공통 Task API로 제공할 수 있습니다."
      },
      {
        "title": "await는 비동기 I/O를 순서 있게 표현합니다",
        "body": "await client.GetStringAsync(url)은 응답 결과가 필요하다는 뜻입니다. Task가 미완료면 현재 async 메서드는 상태를 저장하고 호출자에게 제어를 돌려줄 수 있습니다. 응답이 오면 이어서 실행합니다.\n\nforeach에서 요청마다 await하면 요청 여섯 개는 여전히 순차 처리됩니다. 여러 요청의 Task를 먼저 시작하고 Task.WhenAll로 기다리면 각 요청의 대기 시간이 겹칩니다. async라는 단어만 붙여도 자동으로 작업이 겹치지는 않습니다."
      },
      {
        "title": "서버와 클라이언트의 용량이 함께 필요합니다",
        "body": "각 요청이 80 ms를 기다릴 때 순차 6개는 대기만 약 480 ms입니다. 서버가 여러 요청을 수용하고 클라이언트에도 연결 여유가 있으면 동시 요청은 대기를 겹쳐 전체 시간을 줄일 수 있습니다. 요청 하나의 서버 대기 80 ms는 그대로입니다.\n\n실제 네트워크에는 연결 수 제한, DNS·TLS 비용, 서버 처리 용량과 오류가 있습니다. 이 장은 루프백 서버와 짧은 고정 지연만 사용하므로 인터넷 서비스의 성능을 예측하는 벤치마크는 아닙니다."
      }
    ],
    "trap": {
      "myth": "async/await를 붙이면 서버의 작업 자체가 더 빨라진다.",
      "truth": "비동기는 대기 중 실행 자원을 다른 일에 쓰도록 합니다. 장치나 서버가 작업 하나를 처리하는 시간은 별도의 문제입니다."
    },
    "exercise": {
      "file": "examples/ConcurrencyLab/03IO.cs",
      "steps": [
        "concurrency-course 폴더에서 dotnet run --project examples/ConcurrencyLab -- 03 실행",
        "순차 요청 6개와 동시 요청 6개의 전체 시간을 비교한다.",
        "서버의 Task.Delay(80)은 두 방식에서 동일함을 확인한다.",
        "동시 요청 개수를 1·3·6으로 바꿔 결과를 기록한다."
      ],
      "expected": "서버는 127.0.0.1의 임시 포트만 사용합니다. 순차는 대략 480 ms 이상의 대기가 필요하며 동시는 대기를 겹칩니다. 구체적인 시간은 시스템 부하에 따라 변동합니다."
    },
    "quiz": [
      {
        "question": "async 메서드에서 foreach 안의 요청을 하나씩 await하면?",
        "options": [
          "항상 모든 요청이 동시에 시작된다",
          "그 반복문은 요청별 완료를 기다린 뒤 다음 요청을 시작한다",
          "OS 스레드가 요청마다 하나씩 생긴다"
        ],
        "correct": 1,
        "explanation": "await는 의존 순서를 표현합니다. 작업을 겹치려면 미완료 Task 여러 개가 함께 존재하도록 시작해야 합니다."
      },
      {
        "question": "비동기 I/O가 전체 시간을 줄일 수 있는 주된 이유는?",
        "options": [
          "네트워크 물리 속도를 높인다",
          "응답 데이터 크기를 자동으로 줄인다",
          "서로 다른 요청의 대기를 겹친다"
        ],
        "correct": 2,
        "explanation": "작업별 지연은 그대로여도 독립적인 대기를 겹치면 전체 완료 시간을 줄일 수 있습니다. 서버 수용량 등 조건이 필요합니다."
      }
    ],
    "takeaway": "요청 하나의 지연과 요청 묶음의 전체 완료 시간을 따로 측정하세요.",
    "code": "using var client = new HttpClient();\nvar tasks = urls.Select(url => client.GetStringAsync(url));\nstring[] bodies = await Task.WhenAll(tasks);\n// 많은 URL에서는 반드시 동시 실행 수를 제한하세요."
  },
  {
    "id": 4,
    "title": "공유 상태: 경쟁과 락",
    "kicker": "04 / SHARED STATE",
    "lead": "카운터를 두 번 올렸는데 결과는 1입니다. 읽기·수정·쓰기를 나눠 순서를 직접 섞고, 락이 보호해야 할 범위를 찾습니다.",
    "objectives": [
      "lost update를 실행 순서로 재현한다.",
      "원자성과 임계 구역의 범위를 설명한다.",
      "데드락과 async 논리 경쟁을 구분한다."
    ],
    "sections": [
      {
        "title": "counter++도 하나의 불가분한 동작은 아닙니다",
        "body": "공유 카운터 증가를 읽기 → 더하기 → 쓰기로 나누어 봅니다. A와 B가 모두 0을 읽고 각각 1을 쓰면 두 번 증가를 요청했지만 최종 값은 1입니다. 이처럼 결과가 실행 순서에 의존하는 문제가 경쟁 상태입니다.\n\n실습은 Barrier와 이벤트로 그 순서를 의도적으로 만듭니다. 일반 실행에서 운 좋게 2가 나온다고 안전한 코드가 증명되지는 않습니다. 재현 실패와 버그 부재는 다릅니다."
      },
      {
        "title": "락은 공유 규칙 전체를 보호해야 합니다",
        "body": "lock은 같은 동기화 객체를 사용하는 경로에서 임계 구역을 한 번에 한 스레드만 실행하도록 합니다. 쓰기 한 줄만 감싸고 읽기를 밖에 두면 오래된 값을 읽는 문제가 남을 수 있습니다. 읽기·검사·수정이 함께 지켜야 할 규칙을 먼저 정하세요.\n\n한 카운터 증가에는 Interlocked.Increment가 적합할 수 있습니다. 여러 필드의 관계를 유지해야 한다면 각 필드를 따로 원자적으로 바꿔도 전체 규칙이 보장되지는 않습니다. lock은 예외 시 데이터 변경을 자동 롤백하는 트랜잭션도 아닙니다."
      },
      {
        "title": "기다리는 순서가 원을 만들면 멈출 수 있습니다",
        "body": "A가 락 X를 잡고 Y를 기다리며, B가 Y를 잡고 X를 기다리면 서로 진행할 수 없습니다. 여러 락을 잡는 경로에서 획득 순서를 일관되게 정하는 방법이 이런 순환 대기를 예방합니다.\n\nC#의 lock 블록 안에서는 await를 사용할 수 없습니다. 비동기 상호 배제가 필요하면 SemaphoreSlim.WaitAsync를 사용하고 finally에서 Release합니다. 다만 락 대신 세마포어를 쓴다고 잘못된 의존 순서가 저절로 해결되지는 않습니다."
      },
      {
        "title": "한 번에 한 Task만 실행해도 논리 경쟁은 가능합니다",
        "body": "두 async 작업이 잔액을 확인한 뒤 미완료 await에서 멈추고, 재개 후 둘 다 같은 잔액을 기준으로 차감하면 순서 문제가 생길 수 있습니다. 서로의 확인과 변경 사이에 다른 작업이 끼어들었기 때문입니다.\n\n공유 상태를 줄이거나, 하나의 소유자가 메시지를 순서대로 처리하거나, 검사와 갱신을 같은 트랜잭션에 묶는 설계도 검토하세요. ThreadPool의 물리적 병렬 실행 여부만 보고 데이터 규칙의 안전성을 판단하면 안 됩니다."
      }
    ],
    "trap": {
      "myth": "스레드가 하나인 실행 환경에서는 경쟁 상태가 없다.",
      "truth": "await 사이로 작업 흐름이 섞이면 단일 실행기에서도 논리적인 검사·갱신 경쟁이 가능합니다. 공유 규칙과 작업 경계를 확인해야 합니다."
    },
    "exercise": {
      "file": "examples/ConcurrencyLab/04RaceLock.cs",
      "steps": [
        "concurrency-course 폴더에서 dotnet run --project examples/ConcurrencyLab -- 04 실행",
        "A와 B가 둘 다 0을 읽도록 강제한 로그를 따라간다.",
        "lock을 사용한 두 번째 실험의 결과 2를 비교한다.",
        "쓰기만 lock으로 보호하면 왜 충분하지 않을지 설명한다."
      ],
      "expected": "락 없는 실험의 최종 값은 1, 락으로 증가 전체를 보호한 실험은 2입니다. 출력 순서는 제어된 재현 모델입니다."
    },
    "quiz": [
      {
        "question": "두 작업이 모두 0을 읽은 뒤 각각 1을 쓰면 최종 값은?",
        "options": [
          "1",
          "2",
          "항상 예외가 발생한다"
        ],
        "correct": 0,
        "explanation": "각 작업이 읽은 값의 복사본에 1을 더해 쓰므로 나중 쓰기가 앞선 쓰기를 덮습니다."
      },
      {
        "question": "락 X와 Y가 모두 필요한 모든 경로에서 권장되는 방식은?",
        "options": [
          "경로마다 무작위 순서로 획득",
          "항상 동일한 순서로 획득",
          "락을 잡은 채 무한 재시도"
        ],
        "correct": 1,
        "explanation": "일관된 획득 순서는 락 사이의 순환 대기를 예방하는 방법입니다. 모든 관련 경로가 같은 규칙을 따라야 합니다."
      }
    ],
    "takeaway": "락을 추가하기 전에, 함께 지켜야 할 데이터 규칙과 그 규칙을 깨는 실행 순서를 먼저 적으세요.",
    "code": "var gate = new object();\nlock (gate)\n{\n    int old = counter;\n    counter = old + 1; // 읽기-수정-쓰기 전체 보호\n}\n// 단일 카운터에는 Interlocked.Increment(ref counter)도 가능"
  },
  {
    "id": 5,
    "title": "Task와 비동기 상태 머신",
    "kicker": "05 / ASYNC STATE MACHINE",
    "lead": "await는 스레드를 생성하는 명령이 아닙니다. 완료되지 않은 작업을 만나 상태를 저장하고, 완료 통지 후 이어 실행하는 경계를 살펴봅니다.",
    "objectives": [
      "C# async 메서드의 첫 미완료 await 경계를 찾는다.",
      "Task·Thread·continuation의 역할을 구분한다.",
      "단일 UI 실행기와 일반 Console ThreadPool의 차이를 설명한다."
    ],
    "sections": [
      {
        "title": "C# async 메서드는 호출 즉시 실행을 시작합니다",
        "body": "async Task 메서드를 호출하면 보통 첫 미완료 await에 도달할 때까지 호출 스레드에서 동기 실행합니다. 이미 완료된 Task를 await하면 그 자리에서 계속 진행할 수 있습니다. await가 언제나 다른 작업에게 실행 기회를 주는 것은 아닙니다.\n\n미완료 Task를 만나면 메서드는 이후에 필요한 상태를 보존하고 호출자에게 Task를 돌려줍니다. 컴파일러는 이런 중단·재개를 상태 머신으로 변환합니다. 소스의 순서는 유지되지만 같은 OS 스레드가 처음부터 끝까지 실행한다는 뜻은 아닙니다."
      },
      {
        "title": "Task는 작업 완료를 나타내는 객체입니다",
        "body": "Task는 성공·실패·취소를 포함한 작업의 완료를 나타냅니다. Task 하나가 전용 스레드 하나라는 대응은 없습니다. 비동기 I/O의 대기 동안 그 요청만을 위해 관리 스레드가 계속 잠들어 있을 필요는 없습니다.\n\nTaskCompletionSource는 외부 사건이 완료되었음을 Task로 전달하는 도구입니다. continuation은 미완료 await 뒤에 이어 실행할 코드입니다. Task.Run은 CPU 작업 등을 ThreadPool에 예약하는 별도 동작이며, I/O API 호출에 항상 덧씌울 필요가 없습니다."
      },
      {
        "title": "어디서 재개할지는 실행 환경에 따라 다릅니다",
        "body": "UI 앱에는 UI 스레드로 continuation을 돌려주는 SynchronizationContext가 있을 수 있습니다. 기본 await는 적절한 현재 컨텍스트를 캡처해 복귀를 시도합니다. Console 앱에는 보통 이런 컨텍스트가 없고 continuation이 ThreadPool에서 실행될 수 있습니다.\n\n이 장의 브라우저 도식은 단일 실행기로 제한한 개념 모델입니다. 모든 .NET async 코드를 JavaScript 이벤트 루프처럼 이해하면 안 됩니다. ConfigureAwait(false)는 캡처한 컨텍스트 복귀를 요구하지 않도록 하지만 새 스레드 생성이나 병렬 실행을 보장하지 않습니다."
      },
      {
        "title": "동기 대기는 실행 자원을 붙잡습니다",
        "body": "UI 스레드에서 미완료 Task.Result나 Wait()로 동기 대기하고, 그 Task의 continuation이 같은 UI 컨텍스트를 필요로 하면 서로 진행할 수 없는 상황이 생길 수 있습니다. await로 상위 호출까지 비동기 흐름을 이어가는 이유입니다.\n\nConsole 서버에서는 같은 코드가 항상 데드락이 되지는 않아도, 많은 ThreadPool 스레드가 동기 대기에 묶이면 실행할 스레드가 부족해지는 ThreadPool starvation을 유발할 수 있습니다. async 메서드 안에서 긴 CPU 계산이나 Thread.Sleep을 수행하면 그 부분은 현재 실행 스레드를 계속 붙잡습니다."
      }
    ],
    "trap": {
      "myth": "await 한 번마다 새 스레드로 전환되고 다른 작업도 반드시 실행된다.",
      "truth": "완료된 Task의 await는 동기 통과할 수 있습니다. 미완료 Task 이후 continuation의 실행 위치는 컨텍스트와 스케줄러에 달려 있습니다."
    },
    "exercise": {
      "file": "examples/ConcurrencyLab/05TaskAwait.cs",
      "steps": [
        "concurrency-course 폴더에서 dotnet run --project examples/ConcurrencyLab -- 05 실행",
        "TaskCompletionSource의 신호 전후 로그 순서를 비교한다.",
        "완료된 Task.CompletedTask의 await에서 호출자에게 반환하지 않는 이유를 설명한다.",
        "Console의 SynchronizationContext 출력과 await 전후 스레드 번호를 확인한다."
      ],
      "expected": "A 시작 → 완료 await 통과 → 호출자에게 Task 반환 → 신호 후 A 재개 순서입니다. Console의 context는 보통 없음이며, 스레드 번호의 변경 여부는 보장되지 않습니다."
    },
    "quiz": [
      {
        "question": "C# async Task 메서드는 언제 실행을 시작하나요?",
        "options": [
          "반드시 Task.Run을 호출한 뒤",
          "메서드를 호출할 때 첫 미완료 await까지 동기 실행할 수 있다",
          "모든 Task를 WhenAll에 넣은 뒤"
        ],
        "correct": 1,
        "explanation": "일반적인 C# async 메서드는 호출 시 실행합니다. 첫 미완료 await에서 비동기 중단이 가능하며 완료 await는 통과할 수 있습니다."
      },
      {
        "question": "Task 하나는 무엇을 뜻하나요?",
        "options": [
          "항상 OS 스레드 하나",
          "항상 새 CPU 코어 하나",
          "성공·실패·취소 등 작업의 완료를 나타내는 객체"
        ],
        "correct": 2,
        "explanation": "Task는 완료 추상화입니다. I/O 대기를 나타내는 Task가 전용 스레드를 요구하지는 않습니다."
      }
    ],
    "takeaway": "await가 미완료 작업을 만나는 지점과, continuation이 돌아갈 실행 환경을 따로 확인하세요.",
    "code": "async Task WorkAsync(Task signal)\n{\n    Console.WriteLine(\"호출 즉시 실행\");\n    await Task.CompletedTask; // 완료: 동기 통과 가능\n    await signal;             // 미완료라면 중단\n    Console.WriteLine(\"완료 통지 후 이어 실행\");\n}"
  },
  {
    "id": 6,
    "title": "처리량, 큐, 역압력",
    "kicker": "06 / CAPACITY",
    "lead": "작업이 들어오는 속도가 처리 속도보다 빠르면 대기열이 자랍니다. 실행 수와 큐 크기를 함께 제한하고, 생산자에게 기다림을 돌려줍니다.",
    "objectives": [
      "지연 시간과 처리량을 각각 측정한다.",
      "실행 중 작업과 대기 중 작업의 상한을 구분한다.",
      "bounded Channel의 대기가 역압력을 만드는 조건을 설명한다."
    ],
    "sections": [
      {
        "title": "빠르다는 말에는 서로 다른 지표가 있습니다",
        "body": "지연 시간은 작업 하나가 들어와 완료될 때까지 걸린 시간입니다. 처리량은 단위 시간에 완료한 작업 수입니다. 동시 실행 수를 늘리면 처리량은 개선될 수 있지만 대기열과 자원 경합 때문에 개별 지연은 나빠질 수 있습니다.\n\n작업 1개가 0.5초이고 독립적인 슬롯 4개가 쉬지 않고 처리한다면 이상적 용량은 초당 8개입니다. 이는 스케줄링 비용과 공유 병목을 무시한 상한 모델입니다. 입력이 초당 12개라면 초당 약 4개가 계속 쌓입니다."
      },
      {
        "title": "세마포어와 큐는 제한하는 대상이 다릅니다",
        "body": "SemaphoreSlim으로 실행 슬롯 4개를 제한해도, 이미 생성한 Task가 수십만 개면 대기 중 Task와 입력 데이터는 여전히 메모리를 차지합니다. 실행 수 제한만으로 전체 시스템이 유한해지는 것은 아닙니다.\n\n용량 10의 대기열과 worker 4개라면 내부에는 대기 최대 10개와 실행 최대 4개가 있을 수 있습니다. 생산자가 아직 접수하지 못한 데이터, 연결 풀과 응답 버퍼도 별도로 존재합니다. 어느 경계의 수치를 세는지 명시하세요."
      },
      {
        "title": "유한 큐의 대기를 실제로 전달해야 합니다",
        "body": "Channel.CreateBounded와 BoundedChannelFullMode.Wait를 사용하면 큐가 가득 찼을 때 WriteAsync가 비동기적으로 기다릴 수 있습니다. 생산자가 이 반환 값을 await해야 소비 속도가 생산 흐름을 늦추는 역압력이 전달됩니다.\n\nWriteAsync를 무시하거나 각 쓰기를 무제한 Task.Run으로 감싸면 대기 위치만 바뀝니다. Drop 모드는 초과 데이터를 버리는 과부하 정책이지 생산자를 기다리게 하는 정책이 아닙니다. 큐의 상한과 가득 찼을 때의 정책을 함께 설계해야 합니다."
      },
      {
        "title": "외부 병목은 동시 실행 수보다 먼저 포화될 수 있습니다",
        "body": "DB 연결이 8개라면 worker를 100개 만들어도 DB 작업 100개가 즉시 진행되지는 않습니다. 더 많은 요청은 연결 풀에서 기다리고, 서버 제한이나 재시도로 오히려 부하가 늘 수 있습니다.\n\n입력률, 완료율, 큐 길이, 실행 중 수, 오류율과 지연의 분포를 함께 관찰하세요. 평균만 보면 일부 작업의 긴 대기가 숨습니다. 동시 실행 수를 한 단계씩 바꿔 어느 자원이 먼저 포화되는지 확인하는 것이 유용합니다."
      }
    ],
    "trap": {
      "myth": "실행 슬롯을 제한하면 대기열과 메모리 사용량도 자동으로 제한된다.",
      "truth": "세마포어는 실행 수를 제한합니다. 입력과 대기 작업의 상한은 유한 큐·접수 정책·생산자 대기 등으로 별도 관리해야 합니다."
    },
    "exercise": {
      "file": "examples/ConcurrencyLab/06Backpressure.cs",
      "steps": [
        "concurrency-course 폴더에서 dotnet run --project examples/ConcurrencyLab -- 06 실행",
        "capacity=2와 소비자 2개의 조합을 확인한다.",
        "WriteAsync 호출별 대기 시간이 늘어나는 구간을 찾는다.",
        "채널 capacity를 1과 8로 바꾸고 생산자 대기와 전체 완료 시간을 비교한다."
      ],
      "expected": "8개 작업이 모두 완료됩니다. 큐가 가득 찬 구간에서 생산자의 WriteAsync가 기다립니다. 대기열 2개와 실행 2개는 다른 수치입니다."
    },
    "quiz": [
      {
        "question": "초당 입력 12개, 처리 8개가 계속 유지되면 무제한 큐는?",
        "options": [
          "초당 약 4개씩 늘어난다",
          "항상 비어 있다",
          "처리 속도를 자동으로 12개로 높인다"
        ],
        "correct": 0,
        "explanation": "큐는 용량 부족을 없애지 않습니다. 지속적인 입력과 처리의 차이가 대기열로 쌓입니다."
      },
      {
        "question": "Channel에서 생산자에게 역압력을 전달하려면?",
        "options": [
          "WriteAsync의 Task를 무시한다",
          "FullMode.Wait에서 WriteAsync 완료를 await한다",
          "큐를 무한히 키운다"
        ],
        "correct": 1,
        "explanation": "유한 큐가 가득 찼을 때 생산자가 실제로 기다려야 입력 흐름에 제약이 전달됩니다."
      }
    ],
    "takeaway": "실행 슬롯, 대기열, 입력 접수의 상한을 각각 정하고 가득 찼을 때의 동작을 선택하세요.",
    "code": "var channel = Channel.CreateBounded<Job>(\n    new BoundedChannelOptions(10) {\n        FullMode = BoundedChannelFullMode.Wait\n    });\nawait channel.Writer.WriteAsync(job, token);\n// 큐가 가득 차면 생산자가 비동기로 대기합니다."
  },
  {
    "id": 7,
    "title": "실패, 타임아웃, 취소와 정리",
    "kicker": "07 / LIFETIME",
    "lead": "기다리기를 그만둔 것과 실제 작업이 멈춘 것은 다릅니다. 취소 요청부터 자원 정리 확인까지 작업의 수명을 끝까지 추적합니다.",
    "objectives": [
      "대기 타임아웃과 원작업 중단을 구분한다.",
      "CancellationToken과 finally로 협력 취소를 구현한다.",
      "여러 작업의 실패 전파와 제한된 재시도를 설계한다."
    ],
    "sections": [
      {
        "title": "타임아웃은 어느 기다림에 적용했는지 확인합니다",
        "body": "task.WaitAsync(timeout)은 주어진 Task를 일정 시간까지만 기다리는 새 완료 흐름을 제공합니다. 제한 시간을 넘겼다고 원래 Task가 자동으로 취소되는 것은 아닙니다. 호출자는 실패를 받았는데 원작업은 나중에 성공할 수 있습니다.\n\n실제 작업도 중단하도록 요청하려면 CancellationToken을 그 작업의 API에 전달하고, 제한 시간에 CancellationTokenSource를 취소하는 등의 연결이 필요합니다. 그래도 원격 서버에서 이미 시작한 효과까지 되돌리거나 중단했다고 단정할 수는 없습니다."
      },
      {
        "title": "취소는 요청이며 작업이 협력해야 합니다",
        "body": "CancellationTokenSource.Cancel은 취소 요청을 전달합니다. Task.Delay나 취소를 지원하는 I/O API는 토큰을 관찰해 OperationCanceledException으로 빠져나올 수 있습니다. 긴 CPU 반복에서는 ThrowIfCancellationRequested 같은 명시적인 확인 지점이 필요합니다.\n\nawait 경계라면 모두 자동으로 같은 토큰을 확인하는 것은 아닙니다. 호출 사슬을 따라 토큰을 전달해야 합니다. CancellationToken.None이나 토큰을 무시하는 작업은 부모가 취소되어도 계속 실행할 수 있습니다."
      },
      {
        "title": "실패가 발생해도 자원 정리를 기다립니다",
        "body": "파일·연결·슬롯의 수명은 using, await using, finally로 닫습니다. 예외와 취소 경로도 포함해 정리가 한 번 이루어져야 합니다. 취소 요청 후 기다리지 않고 메서드를 떠나면 정리가 끝났는지 알 수 없습니다.\n\nTask.WhenAll은 전달한 작업들이 모두 끝날 때까지 기다리지만, 하나가 실패했다고 형제 작업을 자동 취소하지는 않습니다. 형제 중단 정책이 필요하면 공유하거나 연결한 CTS를 명시적으로 취소하고, 이후 전체 종료를 관찰해야 합니다. 반환한 Task.Exception에는 여러 오류가 들어갈 수 있어 await로 받은 예외 하나가 전체 오류 목록과 같다고 가정하면 안 됩니다."
      },
      {
        "title": "재시도는 중복 효과와 부하를 함께 다룹니다",
        "body": "타임아웃이 난 요청도 원격에서는 이미 반영되었을 수 있습니다. 결제나 저장을 새 ID로 다시 수행하면 중복 효과가 생깁니다. 안정적인 작업 ID와 영속적인 멱등성 규칙, 유일 제약과 트랜잭션 같은 장치가 필요합니다.\n\n일시 오류만 제한 횟수로 재시도하고 입력 오류는 즉시 실패시킵니다. 지수 백오프와 jitter는 재시도 폭주를 줄이는 도구입니다. 전체 작업 마감 시간 안에 재시도와 대기까지 포함해야 합니다. 재시도를 한다는 이유로 끝없이 기다리는 작업을 만들지 마세요."
      }
    ],
    "trap": {
      "myth": "TimeoutException을 받으면 서버의 실제 작업도 멈췄다.",
      "truth": "타임아웃은 호출자가 기다린 경계의 결과입니다. 원작업 중단과 원격 효과의 상태는 별도 취소 전달과 확인이 필요합니다."
    },
    "exercise": {
      "file": "examples/ConcurrencyLab/07Cancellation.cs",
      "steps": [
        "concurrency-course 폴더에서 dotnet run --project examples/ConcurrencyLab -- 07 실행",
        "WaitAsync 타임아웃 직후 원작업의 IsCompleted를 관찰하고 원작업 완료까지 기다린다.",
        "CancellationToken을 전달한 두 번째 작업의 finally 로그를 확인한다.",
        "WhenAll의 형제 작업이 자동 취소되지 않고 완료되는지 확인한다."
      ],
      "expected": "기다리기 타임아웃 후 원작업은 계속될 수 있습니다. 협력 취소 시 finally가 실행되며, WhenAll의 형제는 명시적 취소 없이 정상 완료합니다. 마지막 활성 자원 수는 0이어야 합니다."
    },
    "quiz": [
      {
        "question": "Task.WaitAsync의 제한 시간을 초과하면 원래 Task는?",
        "options": [
          "항상 강제 종료된다",
          "반드시 롤백된다",
          "별도 취소 연결이 없으면 계속될 수 있다"
        ],
        "correct": 2,
        "explanation": "WaitAsync는 기다리는 흐름의 타임아웃을 제공합니다. 원작업 자체를 자동 취소하는 계약은 아닙니다."
      },
      {
        "question": "Task.WhenAll 안의 한 Task가 실패하면?",
        "options": [
          "형제 Task는 자동 취소되지 않는다",
          "모든 형제가 즉시 강제 종료된다",
          "모든 예외가 자동으로 무시된다"
        ],
        "correct": 0,
        "explanation": "WhenAll은 형제 자동 취소 정책을 제공하지 않습니다. 필요하면 토큰과 취소 요청을 명시적으로 구성해야 합니다."
      }
    ],
    "takeaway": "취소를 보냈는지, 실제 종료했는지, 자원 정리가 끝났는지를 서로 다른 상태로 기록하세요.",
    "code": "using var stop = new CancellationTokenSource();\nTask original = WorkAsync(stop.Token);\ntry { await original.WaitAsync(TimeSpan.FromSeconds(1)); }\ncatch (TimeoutException) {\n    stop.Cancel(); // 실제 작업에 명시적 취소 요청\n    try { await original; }\n    catch (OperationCanceledException) when (stop.IsCancellationRequested) { }\n}"
  },
  {
    "id": 8,
    "title": "종합 실습: 작은 작업 처리기",
    "kicker": "08 / BUILD & MEASURE",
    "lead": "순차·스레드·비동기를 비교하고, 제한된 큐와 worker를 가진 처리기를 만듭니다. 성공 개수뿐 아니라 대기와 실패, 중단 후 잔여 작업까지 확인합니다.",
    "objectives": [
      "CPU 중심과 I/O 중심 작업에 맞는 실행 방식을 선택한다.",
      "유한 큐·타임아웃·제한된 재시도를 연결한다.",
      "측정 결과와 실제로 검증하지 못한 범위를 구분한다."
    ],
    "sections": [
      {
        "title": "먼저 작업이 무엇을 기다리는지 분류합니다",
        "body": "CPU 계산이 대부분이면 비동기 문법이 계산량을 줄여주지 않습니다. 가용 코어, 데이터 분할 비용과 공유 경합을 고려해 Parallel.For나 제한된 Task.Run으로 병렬화를 검토합니다. C#의 관리 스레드는 여러 코어에서 병렬로 관리 코드를 실행할 수 있습니다.\n\nI/O 대기가 대부분이고 API가 비동기를 지원하면 async/await가 대기 중 스레드 점유를 줄이는 데 유용합니다. 동기 API만 있는 경우 제한된 스레드를 사용하는 방식이 대안일 수 있지만, ThreadPool에 블로킹 작업을 무제한 쌓으면 starvation과 지연을 만들 수 있습니다."
      },
      {
        "title": "입력부터 결과까지 용량과 수명을 연결합니다",
        "body": "이번 처리기는 12개 작업을 용량 3의 Channel에 넣고 worker 3개가 처리합니다. 각 시도에는 제한 시간이 있고 일시 오류와 타임아웃만 최대 2회까지 시도합니다. 영구 입력 오류는 바로 실패로 기록합니다.\n\n처리 중인 작업 수는 worker 수로 제한하고, 대기 작업 수는 Channel로 제한합니다. 부모 취소는 연결 토큰으로 각 시도와 재시도 대기에 전달합니다. 예상하지 못한 오류가 나면 공유 CTS를 취소한 뒤 모든 worker의 종료를 기다립니다."
      },
      {
        "title": "결과 파일과 지표가 설명을 뒷받침해야 합니다",
        "body": "성공·실패 수, 총 시도 수, 재시도와 타임아웃 수, 최대 실행 수, 전체 시간과 평균 지연을 출력합니다. 선택한 파일 경로에 JSON으로 저장할 수도 있습니다. 실패한 작업 ID가 남아야 누락과 정상 실패를 구분할 수 있습니다.\n\n예제의 ConcurrentDictionary.TryAdd는 한 프로세스 내 중복 커밋을 모델링합니다. 프로세스 재시작이나 외부 서버의 중복 효과까지 막는 영속 멱등성은 아닙니다. 중단할 때 메모리 큐의 남은 데이터도 보존하지 않으므로 운영용 처리기에는 저장·복구 계약이 더 필요합니다."
      },
      {
        "title": "브라우저 예상과 실제 측정을 비교합니다",
        "body": "브라우저 비교는 정해진 계산·대기 단위와 제한된 자원으로 계산한 개념 모델입니다. 실제 .NET에서는 JIT, ThreadPool 상태, GC, 코어 수, 네트워크와 연결 풀의 영향을 받습니다. 도식의 수치를 성능 보장으로 사용하지 마세요.\n\nC# 예제는 짧은 지연 작업으로 순차·블로킹 스레드·비동기를 비교하고 CPU 작업은 순차와 Parallel.For를 비교합니다. 짧은 CPU 작업에서는 병렬화 비용이 더 클 수 있습니다. 예열과 반복 측정, 동일 입력, 실제 처리 결과 검증 없이 빠르다고 결론내리지 마세요."
      }
    ],
    "trap": {
      "myth": "브라우저 시뮬레이션에서 가장 빠른 방식이 실제 서비스에서도 항상 최선이다.",
      "truth": "모델은 실행 자원과 대기의 관계를 설명합니다. 실제 선택은 API의 지원 방식, CPU·I/O 비율, 용량 제한과 측정으로 확인해야 합니다."
    },
    "exercise": {
      "file": "examples/ConcurrencyLab/08WorkerProject.cs",
      "steps": [
        "concurrency-course 폴더에서 dotnet run --project examples/ConcurrencyLab -- 08 실행",
        "먼저 출력만 실행하고 성공 10·실패 2와 최대 실행 수 3 이하를 확인한다.",
        "dotnet run --project examples/ConcurrencyLab -- 08 /tmp/concurrency-results.json으로 결과를 저장한다.",
        "Channel 용량·worker 수·요청 지연을 하나씩 바꾸고 입력을 동일하게 유지해 비교한다.",
        "마지막 취소 시나리오에서 모든 worker가 정리되는지 확인한다."
      ],
      "expected": "의도한 결과는 성공 10, 영구 입력 오류 ID 7과 반복 타임아웃 ID 9의 실패입니다. 최대 실행 수는 3 이하이고 중단 검증 후 살아 있는 worker는 0이어야 합니다. 제작 환경에는 SDK가 없어 실제 실행은 아직 검증하지 못했습니다."
    },
    "quiz": [
      {
        "question": "순수 CPU 계산을 async로 감싸 await만 추가하면?",
        "options": [
          "계산량이 자동으로 줄어든다",
          "추가 병렬화 없이 CPU 계산이 자동으로 빨라지지는 않는다",
          "항상 별도 프로세스가 생긴다"
        ],
        "correct": 1,
        "explanation": "async는 비동기 완료 흐름을 표현합니다. CPU 계산을 병렬화하려면 별도의 실행 자원과 작업 분할이 필요합니다."
      },
      {
        "question": "작업 처리기의 운영 가능성을 확인할 때 함께 봐야 하는 것은?",
        "options": [
          "성공 개수만",
          "시작한 Task 개수만",
          "실패 ID·최대 실행 수·큐 정책·취소 후 정리 상태"
        ],
        "correct": 2,
        "explanation": "접수와 완료, 실패, 취소·정리는 다른 상태입니다. 성공 개수만으로 누락과 잔여 작업을 판단할 수 없습니다."
      }
    ],
    "takeaway": "실행 방식은 작업의 성격으로 고르고, 용량과 수명은 코드로 제한하고, 결과는 측정으로 확인하세요.",
    "code": "var producer = ProduceAsync(channel.Writer, token);\nvar workers = Enumerable.Range(0, 3)\n    .Select(_ => ConsumeAsync(channel.Reader, token));\nawait Task.WhenAll(workers.Append(producer));\n// 실패 정책과 형제 취소는 별도로 구현합니다.\n// 전체 소스는 아래 C# 실습에서 확인하세요."
  }
];
