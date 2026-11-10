# Course Library

운영체제, 네트워크, 런타임, 데이터베이스, 프로그래밍 이론, 게임 AI를 도식·애니메이션·시뮬레이터로 직접 조작하며 배우는 인터랙티브 학습자료 모음입니다.

**사이트:** https://lnyarl.github.io/course/

| 코스 | 분야 | 구성 | 바로가기 |
|---|---|---|---|
| ASP.NET Core · 설계를 이해하는 실험실 | 웹 프레임워크 · C# | 18장 · 18개 실험 · 프레임워크 7개 비교 | [교재 열기](aspnet-core-course/index.html) |
| 동시성과 비동기, 밑바닥부터 · C# | 시스템 기초 | 8장 · 실험 8개 | [교재 열기](concurrency-course/index.html) |
| 현대 운영체제 메모리 관리 | 운영체제 | 16장 | https://lnyarl.github.io/course/os-memory-course/ |
| Windows Kernel Deep Dive | 운영체제 | 17장 | https://lnyarl.github.io/course/windows-kernel-course/ |
| TCP/IP 전문가 과정 | 네트워크 | 14장 | https://lnyarl.github.io/course/tcpip-course/ |
| 웹 네트워크 해부 실험실 | 네트워크 | 12장 · 12개 실험 · 48문항 | [교재 열기](network-web-course/index.html) |
| Node.js 전문가 코스 | 런타임 | 20장 | https://lnyarl.github.io/course/nodejs-advanced-course/ |
| C# 가비지 컬렉터 해부 | 런타임 | 19개 섹션 (한 페이지) | https://lnyarl.github.io/course/CSharp_GC_%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C.html |
| 컨테이너 런타임 만들기 (Rust) | 시스템 프로그래밍 | 9장 | https://lnyarl.github.io/course/container-runtime-course/ |
| C#으로 메시지 큐 만들기 | 분산 시스템 | 10장 · 장별 페이지 | [교재 열기](distributed-queue-course/index.html) |
| 데이터베이스 만들기 (Rust) | 데이터베이스 | 9장 | https://lnyarl.github.io/course/database-course/ |
| 프로그래머를 위한 범주론 · C# | 프로그래밍 이론 | 31장 | https://lnyarl.github.io/course/category-theory-course/ |
| 효용 AI 시뮬레이션 코스 | 게임 AI | 12장 | https://lnyarl.github.io/course/utility-ai-course/ |

모든 페이지는 빌드 없는 정적 HTML이라 GitHub Pages(`main` 브랜치, 루트)에서 그대로 열립니다.

## 학습 코멘트

모든 코스에서 본문 텍스트를 드래그한 뒤 **＋ 코멘트**를 누르면 오른쪽 패널에서 메모를 작성할 수 있습니다. 오른쪽 아래 **코멘트** 버튼으로 다시 열어 수정·삭제하거나 원문으로 이동합니다. 작성 후 **저장**(또는 Ctrl/Cmd+Enter)을 누르세요. 좁은 화면에서는 패널이 본문 위에 열립니다.

코멘트는 같은 사이트·브라우저의 `localStorage`에 저장됩니다. 서버 전송이나 AI 연동은 없습니다. 브라우저 데이터 삭제 시 사라지며, 기기·브라우저·사이트 주소가 바뀌면 공유되지 않습니다. **모든 코멘트 내보내기 (JSON)**로 선택한 원문, 페이지 주소, 코멘트와 작성 시간을 파일로 보관할 수 있습니다. HTML 파일을 직접 여는 `file://` 환경의 저장소 동작은 브라우저마다 다르므로 사이트 또는 동일한 로컬 HTTP 주소에서 이용하세요.

공통 구현: `shared/course-comments.js`. 새 코스 HTML을 추가하면 `python3 tools/connect-comments.py`로 연결합니다. 웹 네트워크 코스 생성기는 연결 태그를 자동으로 포함합니다. 브라우저 검증은 설치된 패키지를 사용해 `node tools/verify-comments.mjs /path/to/playwright/index.mjs /path/to/chromium`으로 실행합니다.
