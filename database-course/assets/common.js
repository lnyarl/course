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
