# C#으로 메시지 큐 만들기

`index.html`을 브라우저에서 직접 열면 됩니다. 서버 실행이나 설치 과정은 필요하지 않습니다.

목차와 10개 장은 별도 HTML 파일입니다. 각 파일에 본문, 그림, 스타일, 인터랙션 코드가 포함돼 있어 인터넷 연결 없이 열립니다. 장을 이동하려면 폴더의 HTML 파일들을 함께 보관하세요.

공식 문서 링크는 인터넷 연결이 필요합니다. 실험은 브라우저 안에서 실행하는 개념 모델입니다.

## 장별 C# 실행 예제

.NET 10 SDK를 사용합니다. 이 폴더에서 `./examples/check-all.sh`를 실행하면 네 예제 프로젝트의 검증 시나리오가 순서대로 실행됩니다. 각 장에는 해당 시나리오만 실행하는 명령과 결과를 해석하는 방법이 있습니다.

| 장 | 예제 프로젝트 | 확인할 경계 |
|---|---|---|
| [01 큐가 필요한 순간](01-memory-queue.html) | MiniQueue.Demo | FIFO, 입력 초과, 결과 저장 전 실패 |
| [02 TCP로 세 프로세스 연결](02-tcp-protocol.html) → [04 ACK와 작업 임대](04-ack-lease.html) | MiniQueue.Transport | 프레임 경계, 로그 복구, 재전달 권한 |
| [05 중복 처리와 멱등성](05-idempotency.html) → [07 동시성과 역압력](07-concurrency-backpressure.html) | MiniQueue.WorkerLab | 결과 커밋과 ACK 간격, 재시도 상태, 접수 제한과 종료 |
| [08 파티션으로 나누기](08-partitioning.html) → [10 분단·합의·최종 검증](10-consensus-validation.html) | MiniQueue.ClusterLab | 키 라우팅, 복제 확인 범위, 리더 교체 시 커밋 조건 |

1장의 `QueueState`를 2장의 전송 실습에서 이어 씁니다. 3장부터는 각 장에서 새로 검증할 계약에 맞춘 실행 시나리오를 제공합니다. TCP와 파일을 실제로 사용하는 실습, 가상 시간과 노드로 조건을 비교하는 실습의 범위는 장마다 안내합니다.

Docker에서 전체 검증을 실행할 수도 있습니다. 같은 폴더에서 아래 명령을 실행하면 빌드와 실습 파일이 컨테이너 안에 생깁니다.

```sh
docker run --rm --network none -v "$PWD/examples:/source:ro" \
  mcr.microsoft.com/dotnet/sdk:10.0 \
  bash -c 'cp -R /source /tmp/examples && bash /tmp/examples/check-all.sh'
```
