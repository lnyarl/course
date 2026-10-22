# 챕터 작성 규칙 (작성자용)

목표: 효용 기반 의사결정(Utility AI)을 바탕으로 한 **시뮬레이션 엔진**을 직접 설계·구현할 수 있게 만드는 한국어 학습자료.
순서: 직관 → 원리(수식) → 엔진 코드(`assets/uai.js`) → 실제 게임 사례 → 트레이드오프·함정 → 연습.

## 코스를 하나로 묶는 장치 (반드시 지킬 것)
1. **공유 엔진 `assets/uai.js`**: 모든 챕터의 위젯은 가능하면 이 엔진의 함수(`UAI.curve`, `UAI.combine`, `UAI.select`, `UAI.Reasoner`, `UAI.World`, `UAI.makeHamlet` 등)를 그대로 호출한다. 같은 함수를 챕터마다 새로 만들지 말 것. 엔진에 없는 교육용 변형(예: 일부러 틀린 구현)은 챕터 안에 두고 "엔진 버전과 비교"하게 한다.
2. **러닝 예제 Hamlet 마을**: 주민(아리·보람·찬·두리·은솔·파랑), 욕구 4개(배고픔·기력·재미·사교), 스마트 오브젝트(빵집·밭·집·벤치·선술집·우물·광장 무대), 위협(늑대). 챕터 예시는 가능한 한 이 세계관으로 든다. 다른 게임 사례(The Sims, Zoo Tycoon 2, Guild Wars 2, Dragon Age: Inquisition 등)는 실제 문헌에 근거할 때만 쓴다.
3. **엔진 부품 박스**: 챕터 앞부분에 `<div class="engine-part">`로 "이 챕터가 엔진에 추가하는 부품"을 표시한다 (아래 컴포넌트 참조). 다룰 `uai.js` 함수 이름을 적는다.
4. **앞뒤 연결**: 이전 챕터 개념을 쓸 때는 `<a class="xref" href="03-response-curves.html#s2">03장 반응 커브</a>` 식으로 링크. 챕터 끝에 `<div class="next-hook">`로 "다음 장에서 이 문제를 어떻게 푸는가"를 한두 문장으로 예고한다.

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
<script src="assets/uai.js"></script>
<style>/* 이 챕터 전용 스타일만 */</style>
</head>
<body data-chapter="03">
<main>
  <header class="chapter-head">
    <span class="label">기초 · Chapter 03</span>   <!-- 선택/엔진 파트는 class="label adv", 실전은 class="label prac" -->
    <h1>...</h1>
    <p class="lead">...</p>
    <div class="objectives"><h4>학습 목표</h4><ul><li>..</li></ul></div>
  </header>
  <div class="engine-part"><b>엔진 부품</b> <code>UAI.curve()</code> <code>UAI.PRESETS</code> — 한 줄 설명</div>
  <nav class="toc"><b>목차</b><ol><li><a href="#s1">..</a></li></ol></nav>
  <section id="s1"><h2>..</h2> ... </section>
  ...
  <div class="summary"><h3>핵심 요약</h3><ul>..</ul></div>
  <h2>확인 문제</h2> (퀴즈 4개 이상)
  <div class="next-hook"><b>다음 장으로</b> ...</div>
  <div class="refs"><b>참고 문헌</b><ul>..</ul></div>
</main>
<script>/* 이 챕터 위젯 코드 */</script>
</body></html>
```
- 상단바·이전/다음 내비게이션은 common.js가 자동 삽입한다. 직접 만들지 말 것.
- 외부 라이브러리·CDN 사용 금지. 순수 HTML/CSS/SVG/Canvas/JS만. 오프라인(file://)에서 열려야 한다.
- 색은 반드시 CSS 변수(var(--accent) 등)만 사용. 하드코딩 색 금지(다크모드 대응). SVG는 `style="fill:var(--ok-soft);stroke:var(--ok)"`처럼. Canvas에서는 `MM.cssVar("--accent")`로 읽어 쓰고, 테마 전환 시 다시 그리도록 `document.addEventListener("themechange", redraw)`를 건다.
- 폭 360px 모바일에서도 가로 스크롤이 생기지 않게. 넓은 위젯은 `.stage`(overflow-x:auto)로 감싼다.
- `uai.js`, `common.js`, `style.css`는 수정하지 말 것. 엔진에 버그나 부족한 점을 발견하면 최종 보고에 적는다.

## 제공 컴포넌트 (assets/style.css, assets/common.js)
- 콜아웃: `<div class="callout">`, `.callout.tip`, `.callout.warn`, `.callout.danger`, `.callout.deep` + `<span class="title">제목</span>`
- 접는 심화 박스: `<details class="deep"><summary>제목</summary><div>내용</div></details>`
- 위젯: `<div class="widget"><div class="w-title">제목</div><div class="w-desc">설명</div> ... </div>`
- 컨트롤: `.controls`, 버튼 `.btn`, `.btn.primary`, 로그 `.log`, 통계 `.stat-row > .stat > .k + .v`
- 막대: `<div class="bar"><i style="width:40%"></i></div>` (`.bar.ok .bar.warn .bar.bad .bar.violet`)
- 색 유틸: `.c-accent .c-ok .c-bad .c-warn .c-violet .c-teal`, 배경 `.bg-accent .bg-ok ...`
- 표: `<div class="tbl-wrap"><table>..</table></div>`
- 그림: `<figure><svg class="diagram" viewBox="..">..</svg><figcaption>..</figcaption></figure>` (svg 내 `.box .line .muted .accent` 클래스)
- 수식: `<div class="formula">U = Σ Dᵢ · Pᵢ</div>` (가운데 정렬 모노스페이스 블록)
- 엔진 코드 발췌: `<pre class="engine"><code>...</code></pre>` (실제 uai.js와 일치해야 함)
- 퀴즈: `<div class="quiz" data-answer="1"><div class="q">질문</div><button class="opt">A</button>...<div class="explain">해설</div></div>` (0-based)
- 스텝 애니메이션: `MM.stepper(containerEl, { steps: N, interval: 1500, render(i){ return "캡션 HTML"; } })`
- 도우미: `MM.el(tag, attrs, html)`, `MM.fmt(v, digits)`, `MM.pct(v)`, `MM.cssVar(name)`
- 커브 그리기 공용 위젯: `MM.plotCurve(svgEl, fn, opts)` — 0~1 정사각 좌표에 함수 fn(x)를 그림. opts: `{ color: "--accent", marker: x값, label }`. 반환 객체 `.update(fn, marker)`.
- 챕터 스크립트는 `</body>` 직전에 두면 DOM이 준비된 상태다.

## 품질 기준
- 챕터당 인터랙티브 위젯 최소 3개(시뮬레이터/에디터/계산기/스텝 애니메이션), SVG 도식 2개 이상, 애니메이션 1개 이상.
- 위젯은 실제로 정확하게 동작해야 한다. 작성 후 챕터 스크립트를 추출해 `node --check`로 문법 검사하고, 핵심 로직은 node에서 `require("./assets/uai.js")`로 검증할 것.
- 문헌 사실(저자, 게임명, 수치, 수식)은 `scratchpad/research/*.md` 노트와 원본 PDF에 있는 것만 쓴다. 불확실한 것은 쓰지 말 것.
- "왜 이렇게 설계되었나", "실제 게임에서 어떤 문제로 나타나나"를 꼭 다룬다.
- 분량: 챕터당 충분히 깊게 (본문 + 위젯으로 HTML 900~1,800줄 수준).
