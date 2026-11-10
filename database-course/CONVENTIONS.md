# 챕터 작성 규칙 (작성자용)

목표: Rust로 데이터베이스(mydb)를 직접 만들며 배우는 한국어 학습자료. 개념 → 디스크 위의 바이트 배치와 알고리즘 → 시뮬레이터 → 구현 가이드(완성 함수·해설·접힌 전체 구현) → 완료 기준 순.
독자: Rust 기초를 아는 개발자. 완성 코드를 읽고 실행한 뒤 조건을 바꿔 실험한다. 핵심 함수의 입력·출력·호출 관계를 먼저 설명하고, 긴 코드와 전체 구현은 원본 링크와 접힌 영역으로 제공한다.

## 파일 골격
```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>짧은 제목 2~4단어</title>
<link rel="stylesheet" href="assets/style.css">
<link rel="stylesheet" href="assets/syntax.css">
<script src="assets/common.js"></script>
<script src="assets/syntax.js"></script>
<style>/* 이 챕터 전용 스타일만 */</style>
</head>
<body data-chapter="02">
<main>
  <header class="chapter-head">
    <span class="label">저장 엔진 · Chapter 02</span>   <!-- Part 2~3은 class="label adv" -->
    <h1>...</h1>
    <p class="lead">...</p>
    <div class="objectives"><h4>학습 목표</h4><ul><li>..</li></ul></div>
  </header>
  <nav class="toc"><b>목차</b><ol><li><a href="#s1">..</a></li></ol></nav>
  <section id="s1"><h2>..</h2> ... </section>
  ...
  <div class="summary"><h3>핵심 요약</h3><ul>..</ul></div>
  <h2>확인 문제</h2> (퀴즈 4개 이상)
  <h2>실습 과제</h2> (mydb에 기능을 더하는 과제 2개 이상, 기대 결과 포함)
</main>
<script>/* 이 챕터 위젯 코드 */</script>
</body></html>
```
- 상단바·이전/다음 내비게이션·진도 저장은 common.js가 자동 처리한다. 직접 만들지 말 것.
- 외부 라이브러리·CDN 사용 금지. 순수 HTML/CSS/SVG/JS만. 오프라인에서 열려야 한다.
- 배경과 도식의 면은 무채색을 사용한다. 파스텔 배경을 넣지 말고 강조색은 글자·테두리·데이터 표시로 구분한다.
- 색은 반드시 CSS 변수(var(--accent) 등)만 사용. 하드코딩 색 금지(다크모드 대응). SVG에서도 `fill="#..."` 대신 `style="fill:var(--ok-soft);stroke:var(--ok)"` 또는 class 사용.
- 폭 360px 모바일에서도 가로 스크롤이 생기지 않게. 넓은 위젯은 `.stage`(overflow-x:auto)로 감싼다.
- 코드 블록 안의 `<`, `>`, `&`는 반드시 이스케이프(`&lt;` `&gt;` `&amp;`).
- 모든 코드 블록에 `data-language="rust|sql|bash|json|python|ebnf|text|console|hexdump"`를 명시하고 `assets/syntax.css`, `assets/syntax.js`를 포함한다. 전체 Rust 예제뿐 아니라 짧은 코드·실행 명령·SQL·AST JSON에도 해당 언어의 구문 강조를 적용한다. 폴더 구조·로그·hexdump는 text/console/hexdump로 구분하며 임의로 Rust 코드처럼 칠하지 않는다.
- 동적 SQL·JSON은 `textContent` 또는 Text 노드로 갱신한 뒤 `CourseSyntax.highlight(element, 'sql' 또는 'json')`을 호출한다. 기존 `<mark>` 선택 범위는 보존한다. 원문 바이트·들여쓰기·줄바꿈·복사 결과가 강조 전후 동일해야 한다. 파서나 코드를 실행해 강조하지 않는다.
- 혼합 터미널은 출력 마크업을 유지하고 실제 명령 부분만 Bash로 표시한다. 색은 글자에만 적용하며 무채색 배경·라이트/다크 대비·360px 내부 스크롤을 확인한다. 외부 CDN이나 실행 시 다운로드에 의존하지 않는다.

## 제공 컴포넌트 (assets/style.css, assets/common.js)
- 콜아웃: `<div class="callout">`, `.callout.tip`, `.callout.warn`, `.callout.danger`, `.callout.deep` + `<span class="title">제목</span>`
- 접는 심화 박스: `<details class="deep"><summary>제목</summary><div>내용</div></details>`
- 위젯: `<div class="widget"><div class="w-title">제목</div><div class="w-desc">설명</div> ... </div>`
- 컨트롤: `.controls`, 버튼 `.btn`, `.btn.primary`, 로그 `.log`, 통계 `.stat-row > .stat > .k + .v`
- 큐 시각화: `.queue > .q-label + .task(.micro|.tick|.io|.timer|.done|.running)`
- 타임라인: `.timeline > .seg` (left/width % 인라인 지정)
- 코드 탭: `<div class="tabs"><div class="tab-bar"><button class="tab" data-tab="a">A</button></div><div class="tab-pane" data-tab="a"><pre>..</pre></div></div>`
- 두 열 비교: `<div class="compare"><div><div class="lbl bad">나쁜 예</div><pre>..</pre></div><div><div class="lbl ok">좋은 예</div><pre>..</pre></div></div>`
- 체크리스트: `<ul class="checklist"><li>..</li></ul>`
- 셀: `.cells > .cell` (+ `.hit` `.miss` `.hl` `.used`)
- 색 유틸: `.c-accent .c-ok .c-bad .c-warn .c-violet .c-teal`, 배경 `.bg-accent .bg-ok ...`
- 표: `<div class="tbl-wrap"><table>..</table></div>`
- 그림: `<figure><svg class="diagram" viewBox="..">..</svg><figcaption>..</figcaption></figure>` (svg 내 `.box .line .muted .accent` 클래스, 흐르는 선은 `class="line flow"`)
- 퀴즈: `<div class="quiz" data-answer="1"><div class="q">질문</div><button class="opt">A</button><button class="opt">B</button>...<div class="explain">해설</div></div>` (data-answer는 0-based)
- 스텝 애니메이션: `MM.stepper(containerEl, { steps: N, interval: 1500, render(i){ /* i단계 그리기 */ return "캡션 HTML"; } })` → 처음/이전/재생/다음 버튼과 캡션 자동 생성
- 도우미: `MM.el(tag, attrs, html)`, `MM.bytes(n)`, `MM.ms(t)`, `MM.esc(s)`, `MM.hex(v,w)`
- 챕터 스크립트는 `</body>` 직전에 두면 DOM이 준비된 상태다.

- 터미널 출력: `<pre class="term"><code><span class="p">$ </span>명령\n<span class="o">출력</span></code></pre>`
- 새 장을 추가하면 `assets/common.js`의 CHAPTERS에서 해당 장을 `ready: true`로 바꾸고, 루트 `index.html`·`README.md`의 장 수를 갱신한다.

## 품질 기준
- 챕터당 인터랙티브 위젯 최소 3개, SVG 도식 2개 이상. 장마다 핵심 메커니즘을 보여 주는 단계 애니메이션을 반드시 포함한다.
- 최종 결과만 바꾸지 말고 바이트·포인터·페이지·토큰·AST 등 중간 상태를 단계별로 보여 준다. 현재 단계, 변경 지점, 조건, 결과를 도식과 설명으로 연결한다.
- 단계 애니메이션에는 이전·다음·재생/정지·초기화를 제공한다. 자동 재생으로 시작하지 않는다. 입력 변경 시 이전 재생을 멈추고 일관된 초기 상태로 돌아간다.
- 입력이나 예측이 실제 상태와 분기를 바꾸는 실습을 넣는다. 장식용 움직임이나 결과를 미리 정한 애니메이션으로 대체하지 않는다.
- prefers-reduced-motion에서는 시간 기반 자동 재생과 전환을 줄이고 수동 단계 조작을 유지한다. 공통 MM.stepper를 우선 사용한다.
- 새 장은 과정 시각화·입력 실험·예측과 결과 비교를 함께 설계한다. 기존 장을 확장할 때도 같은 기준을 적용한다.
- 도식은 작은 화면에서도 상태 이름과 연결 관계를 읽을 수 있어야 한다. 넓은 도식에는 내부 스크롤과 안내를 제공한다. 키보드 조작, 라이트·다크 모드, 360px 화면을 확인한다.
- 구현 가이드: 완성 함수 발췌 → 입력·출력·호출 관계 해설 → 실행 명령·기대 결과 → 접힌 전체 구현. 긴 발췌도 접고 원본 파일/행 링크를 바로 제공한다. 미완성 코드를 기본 경로로 두지 않는다. 참조 구현은 실제로 빌드·실행해 완료 기준을 통과하는지 확인한 코드만 싣는다.
- 완료 기준은 `check.sh`처럼 셸로 PASS/FAIL을 판정할 수 있게 한다. macOS와 Linux 양쪽에서 돌아가야 한다(BSD/GNU 명령 차이 주의: `truncate`, `stat` 대신 `head -c`, `wc -c`).
- 파일에 쓰는 바이트 형식(엔디언, 길이 필드, 체크섬 범위)은 본문에 정확히 적고, 실제로 만든 파일의 hexdump로 보여 준다.
- 성능 수치는 실제로 잰 값만 쓰고 측정 환경(OS, debug/release)을 밝힌다.
- 내구성(fsync)에 관한 설명은 macOS(F_FULLFSYNC)와 Linux의 차이를 구분한다.
- 기준: Rust 2024 에디션, anyhow 1. 외부 크레이트는 꼭 필요한 것만(장마다 명시).
- 각 장은 "이번 장의 저장 구조가 무엇을 못 하는가"로 끝내 다음 장의 동기를 만든다.
- 새 장을 추가하면 `assets/common.js`의 CHAPTERS에서 `ready: true`로 바꾸고, 루트 `index.html`·`README.md`를 갱신한다.
