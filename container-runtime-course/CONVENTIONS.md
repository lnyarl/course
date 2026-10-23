# 챕터 작성 규칙 (작성자용)

목표: Rust로 컨테이너 런타임(myctr)을 직접 만들며 배우는 한국어 학습자료. 개념 → 커널 메커니즘 → 시뮬레이터 → 구현 가이드(뼈대·힌트·접힌 참조 구현) → 완료 기준 순.
독자: Rust 기초를 아는 개발자. 코드는 독자가 직접 짠다. 정답을 먼저 보여 주지 말고 힌트를 단계적으로 연다.

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
    <span class="label">프로세스와 격리 · Chapter 02</span>   <!-- Part 2~3은 class="label adv" -->
    <h1>...</h1>
    <p class="lead">...</p>
    <div class="objectives"><h4>학습 목표</h4><ul><li>..</li></ul></div>
  </header>
  <nav class="toc"><b>목차</b><ol><li><a href="#s1">..</a></li></ol></nav>
  <section id="s1"><h2>..</h2> ... </section>
  ...
  <div class="summary"><h3>핵심 요약</h3><ul>..</ul></div>
  <h2>확인 문제</h2> (퀴즈 4개 이상)
  <h2>실습 과제</h2> (myctr에 기능을 더하는 과제 2개 이상, 기대 결과 포함)
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

- 터미널 출력: `<pre class="term"><code><span class="p">$ </span>명령\n<span class="o">출력</span></code></pre>`
- 새 장을 추가하면 `assets/common.js`의 CHAPTERS에서 해당 장을 `ready: true`로 바꾸고, 루트 `index.html`·`README.md`의 장 수를 갱신한다.

## 품질 기준
- 챕터당 인터랙티브 위젯 최소 3개, SVG 도식 2개 이상.
- 구현 가이드: 뼈대 코드(TODO) → 단계별 힌트(`details.deep`) → 접힌 참조 구현. 참조 구현은 실제로 빌드·실행해 완료 기준을 통과하는지 확인한 코드만 싣는다.
- 완료 기준은 `check.sh`처럼 셸로 PASS/FAIL을 판정할 수 있게 한다. 이전 장의 기준도 계속 통과해야 한다.
- 3장부터 mount namespace·pivot_root·새 `/proc`·최소 `/dev`를 이후 참조 구현에서 유지한다. 3~7장은 `--rootfs`가 필수이고, 8장은 `--rootfs` 또는 `--image` 중 하나가 필수다. 호스트 파일시스템으로 돌아가는 무옵션 경로를 만들지 않는다. rootless는 실행자 소유 rootfs를 별도로 준비한다. cgroup 관측은 호스트에서 수행하고 전체 cgroupfs를 컨테이너에 노출하지 않는다.
- `examples/chNN`의 참조 소스와 HTML에 접힌 전체 코드는 같아야 한다. 공통 검사 모듈을 삭제하거나 일부만 재선정하지 않고 해당 장까지의 모듈을 누적 실행한다. 보안 정책이 의도적으로 이전 동작을 제한하면 검사에서 그 기대값과 필요한 진단용 옵션을 명시한다.
- 기준: Rust 2024 에디션, nix 0.29, clap 4, anyhow 1. Linux 커널 5.x+, cgroup v2. aarch64/x86_64 모두 고려.
- 시스템 콜 이름·플래그·/proc·/sys 경로·시그널 번호는 정확하게. 불확실한 수치는 쓰지 말 것.
- 각 장은 "이 코드가 fork와 exec 사이 어디에 들어가는가"를 명시하고, 다음 장과의 연결고리로 끝낸다.
