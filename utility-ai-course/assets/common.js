// 공통 스크립트: 내비게이션, 테마, 퀴즈, 스텝 플레이어
(function () {
  const CHAPTERS = [
    { id: "01", file: "01-decision-landscape.html", title: "의사결정 아키텍처 지형도", part: "기초" },
    { id: "02", file: "02-utility-expected-utility.html", title: "효용과 기대 효용", part: "기초" },
    { id: "03", file: "03-response-curves.html", title: "반응 커브: 상태를 효용으로", part: "기초" },
    { id: "04", file: "04-considerations.html", title: "Consideration과 점수 결합", part: "기초" },
    { id: "05", file: "05-action-selection.html", title: "행동 선택 전략과 Dual Utility", part: "선택" },
    { id: "06", file: "06-time-inertia.html", title: "시간, 관성, 반응성", part: "선택" },
    { id: "07", file: "07-needs-smart-objects.html", title: "욕구 모델과 스마트 오브젝트", part: "엔진" },
    { id: "08", file: "08-context-targets.html", title: "컨텍스트와 타깃 평가", part: "엔진" },
    { id: "09", file: "09-engine-architecture.html", title: "시뮬레이션 엔진 아키텍처", part: "엔진" },
    { id: "10", file: "10-hybrid-architectures.html", title: "하이브리드 아키텍처 사례", part: "엔진" },
    { id: "11", file: "11-tuning-debugging.html", title: "튜닝, 디버깅, 밸런싱", part: "실전" },
    { id: "12", file: "12-capstone-hamlet.html", title: "캡스톤: Hamlet 마을 시뮬레이터", part: "실전" },
  ];
  window.MM = window.MM || {};
  MM.CHAPTERS = CHAPTERS;

  // 테마
  try {
    const saved = localStorage.getItem("uai-theme");
    if (saved) document.documentElement.dataset.theme = saved;
  } catch (e) {}
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("uai-theme", next); } catch (e) {}
    document.dispatchEvent(new Event("themechange"));
  }
  // CSS 변수 값 읽기 (Canvas 그리기용)
  MM.cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => document.dispatchEvent(new Event("themechange")));

  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  MM.el = el;

  function buildNav() {
    const id = document.body.dataset.chapter;
    const idx = CHAPTERS.findIndex(c => c.id === id);
    const bar = el("div", { class: "topbar" });
    bar.innerHTML = `<a class="home" href="index.html">🎯 효용 AI 시뮬레이션 코스</a>
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
    try {
      const v = JSON.parse(localStorage.getItem("uai-visited") || "{}");
      v[id] = 1;
      localStorage.setItem("uai-visited", JSON.stringify(v));
    } catch (e) {}
    const main = document.querySelector("main");
    const pager = el("nav", { class: "pager" });
    const prev = CHAPTERS[idx - 1], next = CHAPTERS[idx + 1];
    pager.innerHTML =
      (prev ? `<a href="${prev.file}"><small>← 이전</small>${prev.id}. ${prev.title}</a>` : `<a href="index.html"><small>← 목차</small>코스 홈</a>`) +
      (next ? `<a class="next" href="${next.file}"><small>다음 →</small>${next.id}. ${next.title}</a>` : `<a class="next" href="index.html"><small>목차 →</small>코스 홈</a>`);
    main.append(pager);
  }

  // 퀴즈: <div class="quiz" data-answer="1"><div class="q">..</div><button class="opt">..</button>...<div class="explain">..</div></div>
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

  // 스텝 플레이어: 단계별 애니메이션을 위한 공통 컨트롤
  // MM.stepper(container, { steps: N, render(i) -> caption string, interval: ms })
  MM.stepper = function (container, opts) {
    const n = opts.steps, interval = opts.interval || 1400;
    let i = 0, timer = null;
    const ctl = el("div", { class: "stepper-ctl" });
    ctl.innerHTML = `<button class="btn" data-a="first">⏮</button><button class="btn" data-a="prev">◀ 이전</button>
      <button class="btn primary" data-a="play">▶ 재생</button><button class="btn" data-a="next">다음 ▶</button>
      <span class="pos"></span>`;
    const cap = el("div", { class: "stepper-cap" });
    container.append(ctl, cap);
    const playBtn = ctl.querySelector('[data-a="play"]');
    function show() {
      const c = opts.render(i);
      cap.innerHTML = c == null ? "" : c;
      ctl.querySelector(".pos").textContent = `${i + 1} / ${n}`;
      ctl.querySelector('[data-a="prev"]').disabled = i === 0;
      ctl.querySelector('[data-a="next"]').disabled = i === n - 1;
    }
    function stop() { clearInterval(timer); timer = null; playBtn.textContent = "▶ 재생"; }
    function play() {
      if (i === n - 1) i = 0, show();
      playBtn.textContent = "⏸ 정지";
      timer = setInterval(() => { if (i >= n - 1) return stop(); i++; show(); }, interval);
    }
    ctl.onclick = e => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === "play") return timer ? stop() : play();
      stop();
      if (a === "first") i = 0;
      if (a === "prev") i = Math.max(0, i - 1);
      if (a === "next") i = Math.min(n - 1, i + 1);
      show();
    };
    show();
    return { go(k) { stop(); i = k; show(); }, get index() { return i; }, refresh: show };
  };

  // 숫자 포맷 도우미
  MM.fmt = (v, d) => (+v).toFixed(d == null ? 2 : d);
  MM.pct = v => Math.round(v * 100) + "%";

  // 커브 플롯: 0~1 정사각 좌표에 fn(x)를 그린다. svgEl에 viewBox가 없으면 0 0 240 200로 설정
  // opts: { color: "--accent", marker: x, label, xLabel, yLabel, extra: [{fn, color, dash}] }
  MM.plotCurve = function (svgEl, fn, opts) {
    opts = opts || {};
    const NS = "http://www.w3.org/2000/svg";
    if (!svgEl.getAttribute("viewBox")) svgEl.setAttribute("viewBox", "0 0 240 200");
    svgEl.classList.add("plot");
    const L = 30, T = 10, Wd = 200, Ht = 160;
    const X = x => L + x * Wd, Y = y => T + (1 - y) * Ht;
    function path(f) {
      let d = "";
      for (let i = 0; i <= 120; i++) {
        const x = i / 120, y = Math.max(-0.05, Math.min(1.05, f(x)));
        d += (i ? "L" : "M") + X(x).toFixed(1) + "," + Y(y).toFixed(1);
      }
      return d;
    }
    function draw(f, marker) {
      fn = f || fn;
      if (marker !== undefined) opts.marker = marker;
      let h = "";
      for (let i = 0; i <= 4; i++) {
        h += `<line class="grid" x1="${X(i / 4)}" y1="${T}" x2="${X(i / 4)}" y2="${T + Ht}"/><line class="grid" x1="${L}" y1="${Y(i / 4)}" x2="${L + Wd}" y2="${Y(i / 4)}"/>`;
      }
      h += `<line class="axis" x1="${L}" y1="${T + Ht}" x2="${L + Wd}" y2="${T + Ht}"/><line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${T + Ht}"/>`;
      h += `<text x="${L - 4}" y="${T + 4}" text-anchor="end">1</text><text x="${L - 4}" y="${T + Ht + 4}" text-anchor="end">0</text><text x="${L + Wd}" y="${T + Ht + 14}" text-anchor="end">1</text>`;
      if (opts.xLabel) h += `<text x="${L + Wd / 2}" y="${T + Ht + 26}" text-anchor="middle">${opts.xLabel}</text>`;
      if (opts.yLabel) h += `<text x="10" y="${T + Ht / 2}" text-anchor="middle" transform="rotate(-90 10 ${T + Ht / 2})">${opts.yLabel}</text>`;
      for (const e of opts.extra || []) h += `<path class="curve" d="${path(e.fn)}" style="stroke:var(${e.color || "--muted"})${e.dash ? ";stroke-dasharray:4 3" : ""}"/>`;
      h += `<path class="curve" d="${path(fn)}" style="stroke:var(${opts.color || "--accent"})"/>`;
      if (opts.marker != null) {
        const mx = opts.marker, my = Math.max(0, Math.min(1, fn(mx)));
        h += `<line x1="${X(mx)}" y1="${T + Ht}" x2="${X(mx)}" y2="${Y(my)}" style="stroke:var(--warn);stroke-dasharray:3 3"/>`;
        h += `<line x1="${L}" y1="${Y(my)}" x2="${X(mx)}" y2="${Y(my)}" style="stroke:var(--warn);stroke-dasharray:3 3"/>`;
        h += `<circle cx="${X(mx)}" cy="${Y(my)}" r="4.5" style="fill:var(--warn)"/>`;
        h += `<text x="${X(mx) + 6}" y="${Y(my) - 6}" style="fill:var(--warn);font-weight:700">${my.toFixed(2)}</text>`;
      }
      if (opts.label) h += `<text x="${L + 6}" y="${T + 14}" style="fill:var(--text);font-weight:700">${opts.label}</text>`;
      svgEl.innerHTML = h;
    }
    draw();
    return { update: draw, get opts() { return opts; } };
  };

  document.addEventListener("DOMContentLoaded", () => {
    buildNav();
    initQuizzes();
  });
})();
