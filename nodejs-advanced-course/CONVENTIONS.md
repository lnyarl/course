# 챕터 작성 규칙 (작성자용)

목표: "Node.js 전문가를 키우는" 수준의 한국어 학습자료. 개념 → 내부 메커니즘(V8/libuv/Node 코어의 실제 구조) → 현업에서 나타나는 문제 → 트레이드오프 → 연습 순.
독자: 이미 Node.js로 서비스를 만들어 본 백엔드 개발자. 기초 문법 설명은 생략하고 "왜 그렇게 동작하는가"와 "운영에서 어떻게 터지는가"에 집중한다.

## 파일 골격
```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>짧은 제목 2~4단어</title>
<link rel="stylesheet" href="assets/style.css">
<script src="assets/common.js"></script>
<style>/* 이 챕터 전용 스타일만 */</style>
</head>
<body data-chapter="02">
<main>
  <header class="chapter-head">
    <span class="label">런타임 내부 · Chapter 02</span>   <!-- Part 2~4는 class="label adv" -->
    <h1>...</h1>
    <p class="lead">...</p>
    <div class="objectives"><h4>학습 목표</h4><ul><li>..</li></ul></div>
  </header>
  <nav class="toc"><b>목차</b><ol><li><a href="#s1">..</a></li></ol></nav>
  <section id="s1"><h2>..</h2> ... </section>
  ...
  <div class="summary"><h3>핵심 요약</h3><ul>..</ul></div>
  <h2>확인 문제</h2> (퀴즈 4개 이상)
  <h2>실습 과제</h2> (직접 코드를 돌려보는 과제 2개 이상, 기대 결과 포함)
</main>
<script>/* 이 챕터 위젯 코드 */</script>
</body></html>
```
- 상단바·이전/다음 내비게이션·진도 저장은 common.js가 자동 처리한다. 직접 만들지 말 것.
- 외부 라이브러리·CDN 사용 금지. 순수 HTML/CSS/SVG/JS만. 오프라인에서 열려야 한다.
- 색은 반드시 CSS 변수(var(--accent) 등)만 사용. 하드코딩 색 금지(다크모드 대응). SVG에서도 `fill="#..."` 대신 `style="fill:var(--ok-soft);stroke:var(--ok)"` 또는 class 사용.
- 폭 360px 모바일에서도 가로 스크롤이 생기지 않게. 넓은 위젯은 `.stage`(overflow-x:auto)로 감싼다.
- 코드 블록 안의 `<`, `>`, `&`는 반드시 이스케이프(`&lt;` `&gt;` `&amp;`).

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

## 품질 기준
- 챕터당 인터랙티브 위젯 최소 3개(시뮬레이터/계산기/스텝 애니메이션), SVG 도식 2개 이상.
- 위젯은 실제로 정확하게 동작해야 한다 (예: 이벤트 루프 시뮬레이터는 실제 Node 출력 순서와 일치). 작성 후 `node --check`로 스크립트 문법 검사, 핵심 로직은 node로 직접 실행해 검증.
- Node.js 실제 API 이름·플래그·기본값(예: `UV_THREADPOOL_SIZE` 기본 4, `server.headersTimeout` 기본 60000ms, `highWaterMark` 기본 64KiB/16 객체)은 정확하게. 버전 의존적인 것은 "Node 22 기준"처럼 명시. 불확실한 수치는 쓰지 말 것.
- 기준 버전: Node.js 22 LTS / 24 LTS. 최신 기능은 "24+"처럼 표기.
- "왜 이렇게 설계되었나", "현업에서 어떤 장애로 나타나나", "어떻게 진단·측정하나"를 꼭 다룬다.
- 분량: 챕터당 충분히 깊게 (HTML 1,000~2,000줄 수준).
