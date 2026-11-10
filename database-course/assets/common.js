// 공통 스크립트: 내비게이션, 테마, 퀴즈, 스텝 플레이어, 탭, 진도 저장
(function () {
  // ready: false 인 장은 목차에 "준비 중"으로 표시되고 이전/다음 내비게이션에서 건너뛴다.
  const CHAPTERS = [
    // Part 1. 저장 엔진
    { id: "01", file: "01-log-kv.html", title: "로그 구조 키-값 저장소", part: "저장 엔진", desc: "레코드 형식과 crc, 덧붙이기 쓰기, 메모리 색인, 재생과 찢어진 쓰기, compaction", ready: true },
    { id: "02", file: "02-pages-buffer-pool.html", title: "페이지와 버퍼 풀", part: "저장 엔진", desc: "4KB 페이지, slotted page, 버퍼 풀과 교체 정책, dirty page", ready: true },
    { id: "03", file: "03-btree.html", title: "B+트리", part: "저장 엔진", desc: "리프·내부 노드 분할, 범위 스캔, 병합 원리", ready: true },
    // Part 2. 관계형 계층
    { id: "04", file: "04-tables-records.html", title: "테이블과 레코드", part: "관계형 계층", desc: "튜플 형식, NULL 비트맵, 가변 길이 필드, 카탈로그", ready: true },
    { id: "05", file: "05-sql-parser.html", title: "SQL 파서", part: "관계형 계층", desc: "토크나이저, 재귀 하강 파서, AST", ready: true },
    { id: "06", file: "06-query-executor.html", title: "쿼리 실행기", part: "관계형 계층", desc: "Volcano 모델, 필터·프로젝션·정렬, nested loop·hash 조인", ready: true },
    // Part 3. 신뢰성과 동시성
    { id: "07", file: "07-wal-recovery.html", title: "WAL과 크래시 복구", part: "신뢰성과 동시성", desc: "private workspace, afterimage WAL, fsync, 체크포인트와 redo 복구", ready: true },
    { id: "08", file: "08-transactions.html", title: "트랜잭션과 동시성", part: "신뢰성과 동시성", desc: "snapshot·전역 OCC 구현, 잠금·MVCC·데드락 개념", ready: true },
    { id: "09", file: "09-server-optimizer.html", title: "서버와 최적화", part: "신뢰성과 동시성", desc: "psql simple-query 서버, 기본키 접근 선택, EXPLAIN", ready: true },
  ];
  window.MM = window.MM || {};
  MM.CHAPTERS = CHAPTERS;
  const LS = { theme: "mydb-theme", visited: "mydb-visited" };

  // 테마
  try {
    const saved = localStorage.getItem(LS.theme);
    if (saved) document.documentElement.dataset.theme = saved;
  } catch (e) {}
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(LS.theme, next); } catch (e) {}
  }

  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  MM.el = el;

  // 진도(방문 기록)
  MM.visited = function () {
    try { return new Set(JSON.parse(localStorage.getItem(LS.visited) || "[]")); } catch (e) { return new Set(); }
  };
  function markVisited(id) {
    try {
      const s = MM.visited(); s.add(id);
      localStorage.setItem(LS.visited, JSON.stringify([...s]));
    } catch (e) {}
  }
  MM.resetVisited = function () { try { localStorage.removeItem(LS.visited); } catch (e) {} };

  function buildNav() {
    const id = document.body.dataset.chapter;
    const idx = CHAPTERS.findIndex(c => c.id === id);
    const bar = el("div", { class: "topbar" });
    bar.innerHTML = `<a class="home" href="index.html">🗄️ 데이터베이스 만들기</a>
      <span class="crumb">${idx >= 0 ? `${CHAPTERS[idx].part} · ${CHAPTERS[idx].id}. ${CHAPTERS[idx].title}` : ""}</span>
      <button type="button" aria-label="테마 전환">◐</button>`;
    bar.querySelector("button").onclick = toggleTheme;
    document.body.prepend(bar);
    document.body.prepend(el("div", { class: "progress-bar" }));
    addEventListener("scroll", () => {
      const h = document.documentElement;
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      document.querySelector(".progress-bar").style.width = (p * 100) + "%";
    }, { passive: true });

    if (idx < 0) return;
    markVisited(id);
    const main = document.querySelector("main");
    const pager = el("nav", { class: "pager" });
    const ready = CHAPTERS.filter(c => c.ready), r = ready.findIndex(c => c.id === id);
    const prev = ready[r - 1], next = ready[r + 1];
    pager.innerHTML =
      (prev ? `<a href="${prev.file}"><small>← 이전</small>${prev.id}. ${prev.title}</a>` : `<a href="index.html"><small>← 목차</small>코스 홈</a>`) +
      (next ? `<a class="next" href="${next.file}"><small>다음 →</small>${next.id}. ${next.title}</a>` : `<a class="next" href="index.html"><small>목차 →</small>코스 홈</a>`);
    main.append(pager);
  }

  // 퀴즈
  function initQuizzes(root) {
    (root || document).querySelectorAll(".quiz").forEach(q => {
      if (q.dataset.ready) return;
      q.dataset.ready = 1;
      const ans = +q.dataset.answer;
      const opts = [...q.querySelectorAll(".opt")];
      opts.forEach((o, i) => {
        o.type = "button";
        o.onclick = () => {
          opts.forEach(x => x.classList.remove("correct", "wrong"));
          o.classList.add(i === ans ? "correct" : "wrong");
          if (i !== ans) opts[ans].classList.add("correct");
          q.classList.add("answered");
        };
      });
    });
  }
  MM.initQuizzes = initQuizzes;

  // 탭
  function initTabs(root) {
    (root || document).querySelectorAll(".tabs").forEach(t => {
      if (t.dataset.ready) return;
      t.dataset.ready = 1;
      const tabs = [...t.querySelectorAll(":scope > .tab-bar > .tab")];
      const panes = [...t.querySelectorAll(":scope > .tab-pane")];
      function activate(name) {
        tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
        panes.forEach(p => p.classList.toggle("active", p.dataset.tab === name));
      }
      tabs.forEach(b => b.onclick = () => activate(b.dataset.tab));
      activate((tabs.find(b => b.classList.contains("active")) || tabs[0]).dataset.tab);
    });
  }
  MM.initTabs = initTabs;

  // 스텝 플레이어: MM.stepper(container, { steps: N, render(i) -> caption, interval: ms })
  MM.stepper = function (container, opts) {
    const n = Math.max(1, Math.trunc(Number(opts.steps) || 1));
    const interval = Math.max(200, Number(opts.interval) || 1400);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let i = 0, timer = null;
    const ctl = el("div", { class: "stepper-ctl", role: "group", "aria-label": "단계 재생 제어" });
    ctl.innerHTML = `<button type="button" class="btn" data-a="first" aria-label="첫 단계로 초기화">↺ 초기화</button><button type="button" class="btn" data-a="prev">◀ 이전</button>
      <button type="button" class="btn primary" data-a="play" aria-pressed="false">▶ 재생</button><button type="button" class="btn" data-a="next">다음 ▶</button>
      <span class="pos" aria-live="polite"></span>`;
    const cap = el("div", { class: "stepper-cap", "aria-live": "polite", "aria-atomic": "true" });
    container.append(ctl, cap);
    const playBtn = ctl.querySelector('[data-a="play"]');
    function stop() {
      clearInterval(timer); timer = null;
      playBtn.textContent = "▶ 재생"; playBtn.setAttribute("aria-pressed", "false");
    }
    function show() {
      const c = opts.render(i);
      cap.innerHTML = c == null ? "" : c;
      ctl.querySelector(".pos").textContent = `${i + 1} / ${n}`;
      ctl.querySelector('[data-a="first"]').disabled = i === 0;
      ctl.querySelector('[data-a="prev"]').disabled = i === 0;
      ctl.querySelector('[data-a="next"]').disabled = i === n - 1;
      if (i === n - 1) stop();
    }
    function motionChanged() {
      if (reduced.matches) stop();
      playBtn.disabled = reduced.matches || n === 1;
      playBtn.title = reduced.matches ? "동작 줄이기 설정: 이전·다음으로 직접 진행하세요." : "단계를 자동으로 진행합니다.";
    }
    function play() {
      if (reduced.matches || n === 1) return;
      if (i === n - 1) { i = 0; show(); }
      playBtn.textContent = "⏸ 정지"; playBtn.setAttribute("aria-pressed", "true");
      timer = setInterval(() => { i = Math.min(n - 1, i + 1); show(); }, interval);
    }
    ctl.onclick = e => {
      const a = e.target.closest("button")?.dataset.a; if (!a) return;
      if (a === "play") return timer ? stop() : play();
      stop();
      if (a === "first") i = 0;
      if (a === "prev") i = Math.max(0, i - 1);
      if (a === "next") i = Math.min(n - 1, i + 1);
      show();
    };
    function hidden() { if (document.hidden) stop(); }
    reduced.addEventListener("change", motionChanged);
    document.addEventListener("visibilitychange", hidden);
    motionChanged(); show();
    return {
      go(k) { stop(); i = Math.max(0, Math.min(n - 1, Math.trunc(Number(k) || 0))); show(); },
      get index() { return i; }, refresh: show, stop,
      destroy() { stop(); reduced.removeEventListener("change", motionChanged); document.removeEventListener("visibilitychange", hidden); ctl.remove(); cap.remove(); }
    };
  };

  // 포맷 도우미
  MM.hex = (v, w) => "0x" + v.toString(16).toUpperCase().padStart(w || 1, "0");
  MM.bytes = b => b >= 1 << 30 ? (b / (1 << 30)).toFixed(1) + " GiB" : b >= 1 << 20 ? (b / (1 << 20)).toFixed(1) + " MiB" : b >= 1024 ? (b / 1024).toFixed(1) + " KiB" : b + " B";
  MM.ms = t => t >= 1000 ? (t / 1000).toFixed(2) + " s" : t >= 1 ? t.toFixed(1) + " ms" : (t * 1000).toFixed(0) + " µs";
  MM.esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  document.addEventListener("DOMContentLoaded", () => {
    buildNav();
    initQuizzes();
    initTabs();
  });
})();

// 개별 실습 안내: 위젯 제목을 키로 사용해 챕터의 코드 블록과 독립적으로 유지합니다.
(function () {
  const guides = {
  "색인이 없으면 얼마나 느린가": [
    "파일 크기를 늘릴 때 순차 읽기와 색인 조회의 비용 차이를 확인합니다.",
    [
      "파일 크기 슬라이더를 왼쪽에서 오른쪽으로 옮기고 ‘색인 없이 get’을 봅니다.",
      "같은 크기에서 저장 장치를 HDD와 NVMe SSD로 바꿉니다."
    ],
    "파일 크기가 커질수록 순차 읽기 시간이 늘어납니다. 색인 조회는 64바이트 읽기와 탐색 시간으로 계산하므로 거의 일정합니다.",
    "캐시가 없는 단순 비용 계산입니다. 실제 벤치마크나 키 색인을 만드는 비용은 포함하지 않습니다."
  ],
  "레코드 인코더": [
    "문자열이 길이 필드와 CRC에 어떻게 반영되는지 확인합니다.",
    [
      "key를 a, value를 1로 넣고 총 14바이트인지 확인합니다.",
      "value를 한으로 바꿔 UTF-8 본문이 3바이트가 되는지 봅니다.",
      "‘1비트 뒤집기’를 누른 뒤 CRC 판정을 보고 ‘원래대로’로 복구합니다."
    ],
    "a/1은 헤더 12 + 키 1 + 값 1바이트입니다. 삭제 표시를 켜면 값 대신 val_len=0xffffffff가 기록되고 값 본문은 사라집니다.",
    "바이트와 CRC는 실제 계산하지만 파일에는 쓰지 않습니다. 뒤집는 위치는 무작위입니다."
  ],
  "로그와 색인 시뮬레이터": [
    "덮어쓰기와 삭제가 기존 바이트를 지우지 않는 이유를 확인합니다.",
    [
      "‘처음으로’를 누른 뒤 set a 1, set a 2, get a를 한 줄씩 입력하고 실행합니다.",
      "del a를 실행한 뒤 get a와 compact를 차례로 실행합니다."
    ],
    "get a는 2를 반환하고 keydir는 두 번째 레코드를 가리킵니다. del 뒤에는 (nil)이며 compact 뒤에는 살아 있는 레코드만 남습니다.",
    "메모리의 로그 모델입니다. 실제 파일 재시작·동기화는 아래 Rust 검사에서 확인합니다."
  ],
  "쓰기와 재생을 한 단계씩 따라가기": [
    "로그에 쓰는 순간과 메모리 색인을 바꾸는 순간을 구분합니다.",
    [
      "대상 키를 a로 두고 예측을 (nil)로 고릅니다.",
      "다음으로 파일 추가 → 색인 갱신 → 삭제 → 재시작을 진행합니다.",
      "예측 확인 후 이전으로 돌아가 삭제 직전의 화살표와 비교합니다."
    ],
    "파일에 과거 값이 남아도 마지막 tombstone을 재생하면 색인에서 a가 없어집니다. 최종 조회는 (nil)입니다.",
    "정해진 명령 순서를 추적하는 모델이며 입력 키의 실제 UTF-8 길이로 오프셋을 계산합니다."
  ],
  "정전 시뮬레이터": [
    "불완전한 마지막 레코드를 어디까지 복구할지 확인합니다.",
    [
      "순서가 뒤바뀐 쓰기를 끄고 디스크에 닿은 바이트를 20으로 둡니다.",
      "21로 올려 마지막 레코드가 살아나는지 비교합니다.",
      "21에서 순서가 뒤바뀐 쓰기를 켜 CRC 판정이 바뀌는지 봅니다."
    ],
    "20바이트는 마지막 레코드가 덜 써져 버려집니다. 온전한 21바이트이면 torn=value를 복구합니다. 길이가 충분해도 CRC가 틀리면 온전한 기록이 아닙니다.",
    "정전 시 장치가 어떤 바이트를 남기는지 가정하는 모델입니다. 하드웨어 내구성 측정이 아닙니다."
  ],
  "손상 바이트를 고르고 복구 경계 예측하기": [
    "첫 오류가 이후 레코드의 재생도 막는다는 것을 확인합니다.",
    [
      "실험을 1비트 뒤집기로, 위치를 30으로 둡니다. 보존할 바이트 수에 28을 넣습니다.",
      "예측 확인 후 초기화하고 다음으로 세 레코드를 순서대로 읽습니다.",
      "손상 위치를 16으로 옮겨 보존 경계가 14로 줄어드는지 비교합니다."
    ],
    "각 레코드는 14바이트입니다. 30은 세 번째 레코드 내부이므로 앞의 28바이트만 보존합니다. 두 번째가 손상되면 세 번째도 재생하지 않습니다.",
    "이 장 KV 예제의 꼬리 절단 정책입니다. 7장의 WAL은 완전한 프레임 CRC 오류에서 중단하는 다른 정책입니다."
  ],
  "공간 증폭 계산기": [
    "유효한 데이터보다 로그가 커지는 원인을 계산합니다.",
    [
      "키 개수를 100, 쓰기 횟수를 100000, 삭제 비율을 0으로 둡니다.",
      "쓰기 횟수를 줄였다 늘리며 로그 크기와 살아 있는 데이터를 비교합니다.",
      "삭제 비율을 올려 로그에 tombstone이 쌓여도 유효 데이터가 줄어드는지 봅니다."
    ],
    "기본 조건에서는 로그가 약 4.2MB, 살아 있는 데이터가 약 4.2KB로 공간 증폭이 약 1000배입니다.",
    "키 10바이트·값 20바이트, 균등 무작위 접근의 기대값입니다. 실제 compaction 실행 시간은 계산하지 않습니다."
  ],
  "페이지 번호 → 파일 위치": [
    "페이지 번호를 파일 오프셋으로 변환합니다.",
    [
      "페이지 번호에 1, 2, 1024를 차례로 넣습니다.",
      "각 결과를 페이지 번호 × 4096과 비교합니다."
    ],
    "1은 4096, 2는 8192, 1024는 4194304바이트입니다. 번호는 0부터 시작합니다.",
    "오프셋 계산이며 페이지를 할당하거나 파일을 읽지 않습니다."
  ],
  "슬롯 페이지에 레코드 넣기": [
    "레코드 본문과 슬롯 디렉터리가 양쪽에서 자라는 모습을 확인합니다.",
    [
      "초기화 후 길이 500으로 삽입을 한 번 누릅니다.",
      "삽입을 반복해 회색 빈 공간이 줄어드는지 봅니다.",
      "남은 공간보다 큰 길이를 넣고 실패 전후 슬롯 수를 비교합니다."
    ],
    "각 삽입은 본문 길이 외에 슬롯 4바이트를 소비합니다. 500바이트 삽입은 총 504바이트를 차지하며 공간 부족이면 기존 행은 유지됩니다.",
    "4096바이트 레이아웃 계산입니다. 실제 문자열 내용·디스크 I/O는 생략합니다."
  ],
  "본문 복사 → 슬롯 기록 → 헤더 갱신": [
    "페이지 삽입에서 바꾸는 바이트와 순서를 따라갑니다.",
    [
      "기존 100바이트 레코드를 끄고 새 레코드에 abc를 넣습니다.",
      "최종 free에 4081을 넣은 뒤 다음으로 본문 → 슬롯 → 헤더를 봅니다.",
      "기존 레코드를 켜면 빈 공간이 104바이트 더 줄어드는지 확인합니다."
    ],
    "빈 페이지는 헤더 8바이트를 제외한 4088바이트입니다. abc 3 + 슬롯 4바이트를 쓰면 free=4081입니다.",
    "중간 상태는 메모리 쓰기 과정입니다. 이 상태로 크래시가 나도 안전하다는 뜻은 아닙니다."
  ],
  "3프레임 CLOCK 실험실": [
    "pin·참조 비트·dirty가 교체 가능 여부에 미치는 영향을 봅니다.",
    [
      "초기화 후 페이지 0, 1, 2를 각각 fetch합니다.",
      "unpin하지 않고 페이지 3을 fetch해 모든 프레임 고정 오류를 확인합니다.",
      "프레임 하나를 수정하고 unpin한 뒤 페이지 3을 다시 fetch합니다."
    ],
    "pin이 있는 페이지는 교체하지 않습니다. unpin된 후보의 참조 비트를 내린 뒤 다시 만나면 교체하며 dirty이면 쓰기 후 새 페이지를 읽습니다.",
    "프레임·파일 모두 메모리 모델입니다. flush는 dirty를 쓰지만 pin을 해제하지 않습니다."
  ],
  "CLOCK 손을 한 프레임씩 움직이며 예측하기": [
    "교체 후보를 한 번의 프레임 검사씩 찾습니다.",
    [
      "세 프레임의 pin과 R을 모두 끄고 시작 손을 0으로 둡니다.",
      "후보 frame 0을 예측한 뒤 다음을 눌러 선택 과정을 봅니다.",
      "frame 0의 dirty와 dirty 쓰기 실패를 켜고 다시 진행합니다."
    ],
    "처음 조건에서는 frame 0이 즉시 후보입니다. dirty 쓰기가 실패하면 새 page 9로 덮지 않고 기존 페이지를 유지합니다.",
    "위 자유 조작 CLOCK과 상태를 공유하지 않는 독립 실험입니다. 읽기·쓰기는 모의 횟수입니다."
  ],
  "경계와 같은 키는 어디로 갈까?": [
    "구분 키와 같은 값이 오른쪽 자식으로 가는 규칙을 확인합니다.",
    [
      "찾을 키에 19, 20, 39, 40을 차례로 넣습니다.",
      "강조되는 child 번호와 각 리프의 키 목록을 비교합니다."
    ],
    "19는 child[0], 20과 39는 child[1], 40은 child[2]입니다. 경계 비교는 <가 아니라 ≤인 구분 키의 수로 결정합니다.",
    "고정된 한 내부 노드의 경로 선택입니다. 존재하지 않는 39도 내려갈 자식은 정해집니다."
  ],
  "분할을 멈춰 보며 비교하기": [
    "리프의 키 복사와 내부 노드의 키 이동을 구분합니다.",
    [
      "리프와 10,20,30,40을 선택하고 새 입력 적용을 누릅니다.",
      "다음으로 부모에 30이 나타날 때 오른쪽에도 30이 남는지 봅니다.",
      "내부로 바꿔 같은 단계를 비교합니다."
    ],
    "리프는 부모와 오른쪽에 30이 모두 남습니다. 내부에서는 30이 부모로 이동하고 오른쪽에는 40만 남습니다.",
    "최대 3키 노드 하나의 분할 과정입니다. 전체 트리 연쇄 분할은 아래 삽입 실험에서 확인합니다."
  ],
  "직접 키를 넣고 트리를 나누기": [
    "반복 삽입이 리프와 부모 분할로 이어지는 과정을 봅니다.",
    [
      "초기화 후 예제 10~120을 누릅니다.",
      "로그에서 리프 분할과 내부 분할을 찾고 부모 구분 키를 비교합니다.",
      "키 30으로 검색한 뒤 같은 키를 삽입·갱신합니다."
    ],
    "키 30의 값은 300입니다. 중복 삽입은 값을 갱신하므로 새로운 키를 만들지 않습니다. 리프는 next로 이어집니다.",
    "메모리 B+트리이며 최대 24개 키를 표시합니다. 디스크 저장은 Rust 구현에서 검사합니다."
  ],
  "리프를 하나씩 읽는 범위 스캔": [
    "범위 검색이 루트 탐색 뒤 리프 연결을 따라가는 이유를 봅니다.",
    [
      "바로 위에서 예제 10~120을 준비합니다.",
      "하한 25, 상한 65로 범위 시작을 누릅니다.",
      "다음 리프 읽기를 눌러 결과가 누적되는 모습을 확인합니다."
    ],
    "최종 키는 30,40,50,60입니다. 25 이상이 들어갈 리프에서 시작하고 65를 넘으면 종료합니다.",
    "바로 위 트리를 공유합니다. 삽입·초기화하면 진행 중 스캔이 취소되므로 다시 시작해야 합니다."
  ],
  "삭제 뒤에는 빌릴까, 합칠까?": [
    "삭제 후 형제의 여유에 따라 재균형 경로가 갈리는 이유를 봅니다.",
    [
      "오른쪽 형제를 [30,40,50]으로 두고 다음으로 끝까지 진행합니다.",
      "부모 경계가 40으로 바뀌는지 봅니다.",
      "[30,40]으로 바꾸고 합친 뒤 루트가 사라지는지 비교합니다."
    ],
    "여유가 있으면 30을 빌려 왼쪽 [20,30], 오른쪽 [40,50]이 됩니다. 여유가 없으면 [20,30,40]으로 합치고 루트를 축소합니다.",
    "삭제·병합 원리 모델입니다. 제공 Rust B+트리에는 delete가 구현돼 있지 않습니다."
  ],
  "행을 바이트로 바꾸기": [
    "NULL, 빈 문자열, UTF-8 문자열의 저장 차이를 봅니다.",
    [
      "id=1, name=한으로 넣고 name NULL을 끕니다.",
      "name을 빈 문자열로 바꾼 뒤 name NULL을 켜서 비교합니다."
    ],
    "한의 본문은 3바이트입니다. 빈 문자열은 길이 0인 TEXT이고, NULL은 NULL 비트로 표시하므로 두 값의 의미가 다릅니다.",
    "고정된 3열 스키마를 인코딩합니다. 화면의 숫자 범위는 Rust i64와 같으며 저장은 아래 힙 위젯에서 별도로 합니다."
  ],
  "행 인코딩을 한 단계씩 실행하기": [
    "행의 메타데이터와 가변 길이 본문이 연결되는 순서를 봅니다.",
    [
      "위 행 입력의 name을 한으로 하고 NULL을 끕니다.",
      "현재 입력 가져오기를 누르고 예상 본문 길이에 3을 넣습니다.",
      "다음으로 NULL 비트 → 정수 셀 → 문자열 셀 → 본문을 추적합니다."
    ],
    "name 셀에는 문자열 자체 대신 오프셋과 길이가 들어가고 뒤쪽 본문에 UTF-8 3바이트가 놓입니다.",
    "위 입력을 자동 추종하지 않습니다. 값을 바꿨다면 현재 입력 가져오기를 다시 눌러야 합니다."
  ],
  "현재 행을 힙 페이지에 넣기": [
    "인코딩된 행이 슬롯 번호와 기본키를 얻는 과정을 봅니다.",
    [
      "힙 초기화 후 위 입력에서 id=1로 현재 행 삽입을 누릅니다.",
      "같은 id로 다시 삽입해 거부되는지 확인합니다.",
      "id=2로 바꾸고 삽입해 슬롯 수와 빈 공간을 비교합니다."
    ],
    "중복 기본키는 행을 추가하지 않습니다. 새 키를 넣으면 본문 크기와 슬롯 디렉터리 4바이트만큼 공간을 사용합니다.",
    "입력 행을 복사해 보관하는 메모리 힙입니다. 이후 입력 변경은 이미 삽입한 행을 수정하지 않습니다."
  ],
  "카탈로그 → 기본키 색인 → 행 읽기": [
    "스키마와 RID를 먼저 알아야 행 바이트를 해석할 수 있음을 봅니다.",
    [
      "위 힙에 id=1 행을 넣고 조회 기본키를 1로 둡니다.",
      "1. 카탈로그 읽기 → 2. RID 찾기 → 3. 행 읽기 순서로 누릅니다.",
      "모의 재열기 뒤 카탈로그 읽기부터 다시 진행합니다."
    ],
    "카탈로그는 스키마, 색인은 page/slot 위치, 행 읽기는 그 위치의 바이트를 값으로 복원합니다. 없는 키는 RID를 얻지 못합니다.",
    "재열기는 해석한 스키마만 지우며 메모리 바이트를 유지합니다. 실제 프로세스 재시작이 아닙니다."
  ],
  "조회가 지나가는 위치를 따라가기": [
    "존재하는 키와 없는 키의 조회 종료 지점을 비교합니다.",
    [
      "인코딩 애니메이션에 가져온 행의 id를 조회 기본키로 넣고 경로 다시 준비를 누릅니다.",
      "다음으로 카탈로그 → 색인 → 슬롯 → 행을 진행합니다.",
      "없는 키로 비교를 누르고 종료 위치를 봅니다."
    ],
    "일치하는 키는 p1/slot1에서 행을 복원합니다. 없는 키는 색인 단계에서 끝나므로 슬롯과 행을 읽지 않습니다.",
    "위 힙에 삽입한 행 전체가 아니라 인코딩 애니메이션이 가져온 한 행의 경로를 모델링합니다."
  ],
  "SQL을 한 토큰씩 읽기": [
    "SQL 문자가 토큰과 원문 범위로 바뀌는 것을 확인합니다.",
    [
      "예제에서 문자열과 INSERT를 고르고 분석을 누릅니다.",
      "다음이나 토큰 버튼으로 문자열 토큰을 선택합니다.",
      "구문 오류 예제로 바꿔 분석하고 오류 위치를 확인합니다."
    ],
    "문자열 안의 두 작은따옴표는 값에서 하나로 해석됩니다. 오류 예제는 정상 AST를 만들지 못하며 원문 위치를 표시합니다.",
    "브라우저 파서를 실행합니다. SQL 문법 성공은 테이블이나 열이 실제로 존재한다는 뜻이 아닙니다."
  ],
  "토큰 소비 → 호출 스택 → AST 생성": [
    "파서의 중간 트리와 완성 문장 AST를 구별합니다.",
    [
      "위에서 SELECT와 우선순위 예제를 분석합니다.",
      "다음으로 토큰 소비와 호출 스택을 추적합니다.",
      "완성 AST 보기를 누른 뒤 WHERE 트리를 펼쳐 OR 아래 AND가 있는지 봅니다."
    ],
    "AND가 OR보다 먼저 묶입니다. 도중에는 부분 트리만 완성되며 마지막에 SELECT 전체 AST가 나타납니다.",
    "위 SQL 분석 결과를 공유합니다. AST는 실행 계획이나 조회 결과가 아닙니다."
  ],
  "루트 연산자와 결과 예측": [
    "괄호가 문법 트리와 논리 결과를 바꾸는 것을 확인합니다.",
    [
      "A 참만 켜고 B·C 참은 끕니다. 괄호를 끈 상태의 루트를 OR로 예측합니다.",
      "괄호를 켜고 루트를 AND로 바꿔 예측 확인합니다."
    ],
    "A OR (B AND C)는 TRUE지만 (A OR B) AND C는 FALSE입니다. 입력 진리값이 같아도 묶는 방식이 결과를 바꿉니다.",
    "세 조건의 boolean 논리 실험입니다. NULL의 UNKNOWN은 다음 장에서 다룹니다."
  ],
  "next()를 요청하고 한 행씩 결과 받기": [
    "pull 실행과 Sort의 blocking 동작을 구분합니다.",
    [
      "정렬 뒤 3행 예제를 적용하고 다음으로 Sort 버퍼가 채워지는 동안 결과가 비어 있는지 봅니다.",
      "정렬 없이 2행으로 바꾸고 최종 결과를 봅니다.",
      "LIMIT 0과 타입 오류 예제를 차례로 적용합니다."
    ],
    "Sort는 입력을 모두 모은 뒤 내보냅니다. 정렬 없는 LIMIT는 필요한 행 뒤 추가 Scan을 멈춥니다. LIMIT 0도 바인딩 오류를 숨기지 않습니다.",
    "people 메모리 5행을 SELECT로 실행합니다. 호출 횟수는 실제 디스크 읽기 횟수가 아닙니다."
  ],
  "NULL 조건의 TRUE·FALSE·UNKNOWN 예측하기": [
    "UNKNOWN과 FALSE를 구분해 WHERE 통과 여부를 확인합니다.",
    [
      "TRUE OR UNKNOWN 버튼을 누르고 TRUE를 예측합니다.",
      "FALSE AND UNKNOWN, NOT UNKNOWN을 차례로 선택합니다.",
      "다음으로 결과와 WHERE 판정을 비교합니다."
    ],
    "세 결과는 TRUE, FALSE, UNKNOWN입니다. WHERE는 TRUE만 통과시키므로 FALSE와 UNKNOWN 모두 행을 제외합니다.",
    "SQL 3값 논리 모델입니다. UNKNOWN을 JavaScript false로 바꿔 계산하면 안 됩니다."
  ],
  "중첩 루프와 해시 조인의 실제 후보 비교": [
    "같은 결과를 내면서 검사하는 후보가 다른 두 조인을 비교합니다.",
    [
      "중첩 루프를 고르고 끝까지 진행해 출력과 join_checks를 봅니다.",
      "해시 조인으로 바꿔 hash_build·hash_probe와 출력 행을 비교합니다.",
      "오른쪽 중복 행을 켜고 결과 행이 늘어나는지, NULL 행을 켜고 연결되지 않는지 봅니다."
    ],
    "두 알고리즘의 결과 조합은 같아야 합니다. 중복 키는 모든 조합을 만들고 NULL끼리는 일치하지 않습니다.",
    "SQL JOIN 문법은 지원하지 않으며 연산자 API 실험입니다. 각 카운터는 서로 다른 작업 단위이므로 숫자만으로 속도를 단정하지 않습니다."
  ],
  "EOF 꼬리와 완전한 CRC 오류 구분하기": [
    "복구 가능한 미완성 꼬리와 복구를 멈춰야 하는 손상을 구분합니다.",
    [
      "정상에서 redo를 예측하고 확인합니다.",
      "EOF에서 자르기를 골라 위치를 107바이트로 두고 old를 예측합니다. 마지막 COMMIT의 1바이트가 빠진 상태입니다.",
      "FILE 길이 필드 손상으로 바꾸고 error를 예측합니다."
    ],
    "정상 커밋은 새 값을 REDO합니다. 미완성 마지막 COMMIT은 적용하지 않습니다. 완전한 프레임의 CRC 오류는 복구를 중단합니다.",
    "실제 포맷과 CRC를 계산하지만 FILE 본문 4바이트는 설명용이며 실제 테이블 파일이 아닙니다."
  ],
  "쓰기 순서에서 crash를 넣고 REDO 추적하기": [
    "응답 전이라도 durable COMMIT이 있으면 새 값을 복원함을 봅니다.",
    [
      "종료 지점을 COMMIT 쓰기 전으로 놓고 이전 값을 예측합니다.",
      "WAL sync 직후로 바꾸고 새 값을 예측합니다.",
      "COMMIT 썼지만 sync 전에서 바이트가 보인다는 가정을 켜고 끄며 비교합니다."
    ],
    "WAL sync 뒤에는 home 설치가 끝나지 않아도 REDO합니다. sync 전에는 바이트가 남았는지에 따라 결과가 갈립니다.",
    "장치의 실제 정전 동작을 측정하지 않습니다. 가정한 바이트 잔존 상태를 복구 규칙에 넣는 모델입니다."
  ],
  "checkpoint 뒤 오래된 snapshot을 커밋하면?": [
    "checkpoint가 revision 충돌 검사를 없애지 않는다는 것을 봅니다.",
    [
      "A·B 쓰기를 모두 켜고 A 먼저 commit, query 오류는 끕니다.",
      "conflict를 예측하고 다음으로 checkpoint 뒤 B의 base를 비교합니다.",
      "B 쓰기를 끄고 ok로 예측을 바꿉니다."
    ],
    "A의 쓰기 커밋이 global revision을 2로 올리면 base=1인 B의 dirty commit은 충돌합니다. 읽기 전용 B는 오래된 snapshot이어도 종료할 수 있습니다.",
    "checkpoint는 WAL을 정리하지만 committed revision을 0으로 리셋하지 않습니다."
  ],
  "두 세션의 private copy와 COMMIT 충돌": [
    "서로 다른 키를 써도 전역 revision에서 충돌하는 것을 봅니다.",
    [
      "모두 쓰기 스케줄에서 A id=2, B id=3을 넣고 새 조건 적용합니다.",
      "B의 dirty COMMIT 충돌을 예측하고 다음으로 끝까지 진행합니다.",
      "읽기 전용 스케줄로 바꾸거나 B id=1로 바꿔 결과를 비교합니다."
    ],
    "A가 먼저 쓰기를 커밋하면 B의 base가 오래되어 충돌합니다. 읽기 전용은 성공하지만 중복 id=1은 query 실패 상태를 만듭니다.",
    "행 집합으로 whole-DB snapshot 규칙을 설명하며 실제 SQL·파일 I/O는 실행하지 않습니다."
  ],
  "잠금 요청 순서를 바꾸고 대기 그래프 보기": [
    "잠금 획득 순서가 대기 순환을 만드는지 확인합니다.",
    [
      "B 순서를 Y→X로 두고 순환이 생긴다고 예측합니다.",
      "다음으로 A→B와 B→A 대기 간선이 함께 생기는 단계까지 봅니다.",
      "B 순서를 X→Y로 바꿔 같은 단계를 비교합니다."
    ],
    "반대 순서는 서로 가진 자원을 기다리는 순환을 만듭니다. 같은 순서는 한쪽이 먼저 기다려 순환을 피합니다.",
    "개념 모델입니다. 제공 Rust 구현에는 행 잠금·대기 큐·deadlock detector가 없습니다."
  ],
  "직렬 실행·행 snapshot·global OCC 비교": [
    "쓰기 충돌 정책에 따라 업무 불변식이 깨질 수 있음을 봅니다.",
    [
      "행 단위 snapshot을 선택하고 마지막 0명을 예측합니다.",
      "global revision OCC로 바꿔 1명을 예측합니다.",
      "직렬 실행도 1명인지 확인하고 왜 두 번째 변경이 막히는지 캡션을 읽습니다."
    ],
    "행 snapshot은 서로 다른 행 쓰기를 모두 허용해 0명이 될 수 있습니다. global OCC는 두 번째 쓰기 커밋을 거부하고 직렬 실행은 두 번째 읽기에서 조건을 확인합니다.",
    "근무 boolean UPDATE는 개념 실험이며 현재 SQL은 UPDATE를 지원하지 않습니다."
  ],
  "실험 1 · SQL이 패킷 바이트가 되는 과정": [
    "PostgreSQL Query의 길이 필드와 전체 프레임 길이를 구분합니다.",
    [
      "기본 입력을 누르고 패킷 생성을 누릅니다.",
      "다음으로 Query 단계까지 가서 SQL UTF-8 바이트 수를 확인합니다.",
      "length 4 + SQL 바이트 + 종료 NUL 1을 더해 예측 확인합니다."
    ],
    "Query length는 type 1바이트를 제외합니다. 따라서 전체 프레임은 예측한 length보다 1바이트 큽니다. DataRow의 NULL은 길이 -1입니다.",
    "오프라인 인코딩 모델입니다. RowDescription은 필드 설명만 보이며 실제 소켓·인증을 수행하지 않습니다."
  ],
  "실험 2 · 후보를 고르고 결과 동등성 확인": [
    "색인 후보를 좁혀도 나머지 조건을 검사해야 함을 확인합니다.",
    [
      "AND 아래 기본키 예제와 자동 선택으로 바인딩·계획 생성합니다.",
      "순차 강제로 바꾸고 다시 생성해 결과와 scan_rows를 비교합니다.",
      "OR의 함정과 LIMIT 0도 바인딩 오류 예제를 실행합니다."
    ],
    "기본키 후보는 id=3 한 행이지만 age 조건도 검사합니다. 순차 조회와 결과는 같아야 합니다. OR은 한 키로 제한하면 행을 놓치므로 순차 경로입니다.",
    "비용은 모델 단위, scan_rows는 논리 행 수입니다. 페이지 입력은 추정치만 바꾸며 데이터는 고정 5행입니다."
  ],
  "실험 3 · 두 연결을 교차 실행하기": [
    "세션별 I/T/E 상태와 공개 데이터의 커밋 경계를 봅니다.",
    [
      "시나리오를 쓰기 충돌로 고르고 다음으로 두 세션의 BEGIN·INSERT·COMMIT을 따라갑니다.",
      "오류 후 전체 롤백으로 바꿔 E 상태에서는 일반 명령이 거부되는지 봅니다.",
      "거래·기록 초기화 후 세션 A에서 BEGIN → INSERT → ROLLBACK을 직접 눌러 봅니다."
    ],
    "자기 미커밋 행은 자신의 snapshot에만 보입니다. 첫 쓰기 COMMIT 뒤 다른 dirty COMMIT은 충돌하며 ROLLBACK하면 E에서 I로 돌아갑니다.",
    "소켓 없이 명령 기록을 재현합니다. 단계 초기화는 기록의 첫 상태로, 거래·기록 초기화는 명령 목록을 비웁니다."
  ]
};
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.widget').forEach((widget, index) => {
      const title = widget.querySelector('.w-title');
      const guide = guides[title?.textContent.trim()];
      if (!guide || widget.querySelector('.lab-guide')) return;
      const id = `lab-guide-${document.body.dataset.chapter}-${index}`;
      const panel = document.createElement('aside');
      panel.className = 'lab-guide';
      panel.setAttribute('aria-label', '실습 안내');
      const goal = document.createElement('p');
      goal.className = 'lab-guide-goal';
      goal.id = id;
      goal.textContent = guide[0];
      const start = document.createElement('p');
      start.className = 'lab-guide-start';
      const label = document.createElement('strong'); label.textContent = '먼저 해보기 · ';
      start.append(label, document.createTextNode(guide[1][0]));
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = '조작 순서 · 예상 결과 · 모델 범위';
      const steps = document.createElement('ol');
      guide[1].forEach(text => { const li = document.createElement('li'); li.textContent = text; steps.append(li); });
      details.append(summary, steps);
      for (const [name, value] of [['관찰과 해석', guide[2]], ['이 실험의 범위', guide[3]]]) {
        const p = document.createElement('p'), b = document.createElement('strong');
        b.textContent = name + ' · '; p.append(b, document.createTextNode(value)); details.append(p);
      }
      panel.append(goal, start, details);
      (widget.querySelector('.w-desc') || title).after(panel);
      widget.setAttribute('aria-describedby', [widget.getAttribute('aria-describedby'), id].filter(Boolean).join(' '));
    });
  });
})();
