# 챕터 작성 규칙 (작성자용)

목표: "전문가를 키우는" 수준의 한국어 학습자료. 개념 → 메커니즘 → 실제 구현(Linux/x86-64/ARM64) → 트레이드오프 → 연습 순.

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
<body data-chapter="03">
<main>
  <header class="chapter-head">
    <span class="label">개론 · Chapter 03</span>   <!-- 심화는 class="label adv" -->
    <h1>...</h1>
    <p class="lead">...</p>
    <div class="objectives"><h4>학습 목표</h4><ul><li>..</li></ul></div>
  </header>
  <nav class="toc"><b>목차</b><ol><li><a href="#s1">..</a></li></ol></nav>
  <section id="s1"><h2>..</h2> ... </section>
  ...
  <div class="summary"><h3>핵심 요약</h3><ul>..</ul></div>
  <h2>확인 문제</h2> (퀴즈 4개 이상)
</main>
<script>/* 이 챕터 위젯 코드 */</script>
</body></html>
```
- 상단바·이전/다음 내비게이션은 common.js가 자동 삽입한다. 직접 만들지 말 것.
- 외부 라이브러리·CDN 사용 금지. 순수 HTML/CSS/SVG/JS만. 오프라인에서 열려야 한다.
- 색은 반드시 CSS 변수(var(--accent) 등)만 사용. 하드코딩 색 금지 (다크모드 대응). SVG에서도 `fill="var(--ok-soft)"` 대신 style 또는 class 사용: `style="fill:var(--ok-soft);stroke:var(--ok)"`.
- 폭 360px 모바일에서도 가로 스크롤이 생기지 않게. 넓은 위젯은 `.stage`(overflow-x:auto)로 감싼다.

## 제공 컴포넌트 (assets/style.css, assets/common.js)
- 콜아웃: `<div class="callout">`, `.callout.tip`, `.callout.warn`, `.callout.danger`, `.callout.deep` + `<span class="title">제목</span>`
- 접는 심화 박스: `<details class="deep"><summary>제목</summary><div>내용</div></details>`
- 위젯: `<div class="widget"><div class="w-title">제목</div><div class="w-desc">설명</div> ... </div>`
- 컨트롤: `.controls`, 버튼 `.btn`, `.btn.primary`, 로그 `.log`, 통계 `.stat-row > .stat > .k + .v`
- 셀: `.cells > .cell` (+ `.hit` `.miss` `.hl` `.used`)
- 색 유틸: `.c-accent .c-ok .c-bad .c-warn .c-violet .c-teal`, 배경 `.bg-accent .bg-ok ...`
- 표: `<div class="tbl-wrap"><table>..</table></div>`
- 그림: `<figure><svg class="diagram" viewBox="..">..</svg><figcaption>..</figcaption></figure>` (svg 내 `.box .line .muted` 클래스)
- 퀴즈: `<div class="quiz" data-answer="1"><div class="q">질문</div><button class="opt">A</button><button class="opt">B</button>...<div class="explain">해설</div></div>` (data-answer는 0-based)
- 스텝 애니메이션: `MM.stepper(containerEl, { steps: N, interval: 1500, render(i){ /* i단계 그리기 */ return "캡션 HTML"; } })` → 처음/이전/재생/다음 버튼과 캡션 자동 생성
- 도우미: `MM.hex(v,w)`, `MM.bin(v,w)`, `MM.bytes(n)`, `MM.el(tag, attrs, html)`
- 챕터 스크립트는 `</body>` 직전에 두면 DOM이 준비된 상태다.

## 품질 기준
- 챕터당 인터랙티브 위젯 최소 3개(시뮬레이터/계산기/스텝 애니메이션), SVG 도식 2개 이상.
- 위젯은 실제로 정확하게 동작해야 한다 (알고리즘 정확성 중요). 작성 후 node로 핵심 로직을 검증하거나 최소한 문법 검사(`node --check`로 추출 스크립트)할 것.
- 실제 시스템 수치/구조(예: x86-64 PTE 비트, Linux 함수명·sysctl·/proc 경로)는 정확하게. 불확실한 것은 쓰지 말 것.
- "왜 이렇게 설계되었나", "현업에서 어떤 문제로 나타나나"를 꼭 다룬다.
- 분량: 챕터당 충분히 깊게 (본문 + 위젯으로 대략 HTML 1,000~2,000줄 수준 허용).
