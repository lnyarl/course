# ASP.NET Core · 설계를 이해하는 실험실

[교재 열기](index.html) · [C# 실행 실습 안내](lab-guide.html)

18주 커리큘럼을 18개 장으로 구성한 한국어 정적 HTML 교재입니다. 설계 의도와 프레임워크 비교, 요청·DI·API·EF Core, 보안·비동기·큐·테스트·운영, 측정·캐시·저수준 최적화를 다룹니다.

- 설치·빌드·CDN 없이 index.html을 브라우저로 열 수 있습니다.
- 각 장: 설명, 책임 흐름 도식, 코드, 조작 가능한 개념 실험, 직접 실습, 해설 퀴즈, 공식 출처.
- 비교: ASP.NET Core / Spring Boot / Rails / Django / Express / FastAPI / Go net/http.
- 탐색: `index.html#chapter-1`부터 `#chapter-18`, 검색·완료 표시·테마·최종 설계 노트.
- 진도와 노트는 현재 브라우저 localStorage에 저장합니다. 파일 이동·브라우저 변경·저장 차단 시 유지되지 않을 수 있습니다. 노트는 Markdown으로 내려받을 수 있습니다.
- 실험은 결정적 개념 모델이며 실제 프레임워크 실행이나 벤치마크가 아닙니다. 입력을 바꾸면 초기 단계로 돌아갑니다. 자동 재생은 기본 정지이며 언제든 정지/이전/초기화할 수 있습니다.
- C# 코드는 장별 발췌와 `examples/RequestLab` 독립 프로젝트를 구분합니다. 제작 환경에는 .NET SDK가 없어 C# 컴파일·실행을 검증하지 못했습니다.

## 구성

- `content/foundations.js`: 1–9장, 기반·설계 비교·HTTP·DI·데이터.
- `content/engineering.js`: 10–18장, 설계·보안·운영·최적화.
- `models.js`: 외부 실행 없는 학습 모델.
- `course.js`, `course.css`: 탐색, 접근 가능한 조작, 시각화, 진도.
- `examples/RequestLab`: .NET 10 최소 요청 실험 서버.
- `qa/`: 테스트 스크립트와 실제 브라우저 결과.

검증 범위와 실행 명령은 `qa/README.md`를 참조하세요. 외부 게시/배포는 수행하지 않았습니다.
