// 공통 스크립트: 내비게이션, 테마, 퀴즈, 스텝 플레이어, 탭, 진도 저장
(function () {
  // ready: false 인 장은 목차에 "준비 중"으로 표시되고 이전/다음 내비게이션에서 건너뛴다.
  const CHAPTERS = [
  {
    "id": "01",
    "file": "01-category-composition.html",
    "title": "범주와 합성",
    "part": "Part I · 기초",
    "desc": "객체와 사상, 합성 순서, 결합법칙과 항등사상",
    "page": 2,
    "ready": true
  },
  {
    "id": "02",
    "file": "02-types-functions.html",
    "title": "타입과 함수",
    "part": "Part I · 기초",
    "desc": "타입을 집합으로 보는 모델과 순수 함수의 조건",
    "page": 11,
    "ready": true
  },
  {
    "id": "03",
    "file": "03-categories.html",
    "title": "크고 작은 범주",
    "part": "Part I · 기초",
    "desc": "자유 범주, 순서 관계, 하나의 객체로 보는 모노이드",
    "page": 27,
    "ready": true
  },
  {
    "id": "04",
    "file": "04-kleisli-categories.html",
    "title": "클레이슬리 범주",
    "part": "Part I · 기초",
    "desc": "Writer 예제로 살펴보는 효과가 있는 함수의 합성",
    "page": 38,
    "ready": true
  },
  {
    "id": "05",
    "file": "05-products-coproducts.html",
    "title": "곱과 쌍대곱",
    "part": "Part I · 기초",
    "desc": "보편 성질, 동형, 초기 객체와 끝 객체",
    "page": 51,
    "ready": true
  },
  {
    "id": "06",
    "file": "06-algebraic-data-types.html",
    "title": "대수적 자료형",
    "part": "Part I · 기초",
    "desc": "곱 타입과 합 타입을 C# 레코드로 표현하기",
    "page": 72,
    "ready": true
  },
  {
    "id": "07",
    "file": "07-functors.html",
    "title": "함자",
    "part": "Part I · 기초",
    "desc": "객체와 사상을 옮기면서 합성과 항등을 보존하기",
    "page": 89,
    "ready": true
  },
  {
    "id": "08",
    "file": "08-functoriality.html",
    "title": "함자성",
    "part": "Part I · 기초",
    "desc": "이변함자, 공변과 반변, Hom 함자",
    "page": 113,
    "ready": true
  },
  {
    "id": "09",
    "file": "09-function-types.html",
    "title": "함수 타입",
    "part": "Part I · 기초",
    "desc": "커링, 지수 객체, 카르테시안 닫힌 범주",
    "page": 134,
    "ready": true
  },
  {
    "id": "10",
    "file": "10-natural-transformations.html",
    "title": "자연변환",
    "part": "Part I · 기초",
    "desc": "함자 사이의 변환과 자연성 사각형",
    "page": 154,
    "ready": true
  },
  {
    "id": "11",
    "file": "11-declarative-programming.html",
    "title": "선언적 프로그래밍",
    "part": "Part II · 구조",
    "desc": "등식으로 추론하고 함수 합성으로 프로그램을 구성하기",
    "page": 180,
    "ready": true
  },
  {
    "id": "12",
    "file": "12-limits-colimits.html",
    "title": "극한과 쌍대극한",
    "part": "Part II · 구조",
    "desc": "원뿔, 곱, 당김과 보편 성질의 일반화",
    "page": 188,
    "ready": true
  },
  {
    "id": "13",
    "file": "13-free-monoids.html",
    "title": "자유 모노이드",
    "part": "Part II · 구조",
    "desc": "리스트, 접기, 생성자와 보편적 확장",
    "page": 211,
    "ready": true
  },
  {
    "id": "14",
    "file": "14-representable-functors.html",
    "title": "표현 가능한 함자",
    "part": "Part II · 구조",
    "desc": "함자를 Hom으로 표현하고 인덱스와 연결하기",
    "page": 220,
    "ready": true
  },
  {
    "id": "15",
    "file": "15-yoneda-lemma.html",
    "title": "요네다 보조정리",
    "part": "Part II · 구조",
    "desc": "자연변환과 원소의 대응, 다형성의 역할",
    "page": 231,
    "ready": true
  },
  {
    "id": "16",
    "file": "16-yoneda-embedding.html",
    "title": "요네다 매장",
    "part": "Part II · 구조",
    "desc": "사상으로 객체를 관찰하고 원래 구조를 복원하기",
    "page": 243,
    "ready": true
  },
  {
    "id": "17",
    "file": "17-morphisms.html",
    "title": "사상으로 보는 구조",
    "part": "Part III · 심화",
    "desc": "가환도, Hom 집합, 자연동형을 다시 연결하기",
    "page": 254,
    "ready": true
  },
  {
    "id": "18",
    "file": "18-adjunctions.html",
    "title": "수반",
    "part": "Part III · 심화",
    "desc": "Hom 집합의 자연동형과 단위·쌍대단위",
    "page": 262,
    "ready": true
  },
  {
    "id": "19",
    "file": "19-free-forgetful-adjunctions.html",
    "title": "자유·망각 수반",
    "part": "Part III · 심화",
    "desc": "구조를 만들거나 잊는 함자 사이의 대응",
    "page": 281,
    "ready": true
  },
  {
    "id": "20",
    "file": "20-monads.html",
    "title": "프로그래머의 모나드 정의",
    "part": "Part III · 심화",
    "desc": "클레이슬리 합성과 bind, 모나드 법칙",
    "page": 289,
    "ready": true
  },
  {
    "id": "21",
    "file": "21-monads-effects.html",
    "title": "모나드와 효과",
    "part": "Part III · 심화",
    "desc": "Reader, Writer, State와 효과의 명시적 표현",
    "page": 301,
    "ready": true
  },
  {
    "id": "22",
    "file": "22-monads-categorically.html",
    "title": "범주론으로 정의하는 모나드",
    "part": "Part III · 심화",
    "desc": "자기함자 범주에서의 모노이드와 수반",
    "page": 318,
    "ready": true
  },
  {
    "id": "23",
    "file": "23-comonads.html",
    "title": "코모나드",
    "part": "Part III · 심화",
    "desc": "문맥에서 꺼내기와 확장, 모나드의 쌍대",
    "page": 337,
    "ready": true
  },
  {
    "id": "24",
    "file": "24-f-algebras.html",
    "title": "F-대수",
    "part": "Part III · 심화",
    "desc": "재귀 자료형과 카타모피즘으로 보는 접기",
    "page": 352,
    "ready": true
  },
  {
    "id": "25",
    "file": "25-algebras-for-monads.html",
    "title": "모나드의 대수",
    "part": "Part III · 심화",
    "desc": "T-대수, 코대수와 렌즈",
    "page": 371,
    "ready": true
  },
  {
    "id": "26",
    "file": "26-ends-coends.html",
    "title": "엔드와 코엔드",
    "part": "Part III · 심화",
    "desc": "쐐기, 자연성, 프로함자 합성",
    "page": 384,
    "ready": true
  },
  {
    "id": "27",
    "file": "27-kan-extensions.html",
    "title": "칸 확장",
    "part": "Part III · 심화",
    "desc": "함자의 확장과 보편 성질",
    "page": 401,
    "ready": true
  },
  {
    "id": "28",
    "file": "28-enriched-categories.html",
    "title": "풍성한 범주",
    "part": "Part III · 심화",
    "desc": "Hom 집합을 넘어 순서와 거리로 일반화하기",
    "page": 420,
    "ready": true
  },
  {
    "id": "29",
    "file": "29-topoi.html",
    "title": "토포스",
    "part": "Part III · 심화",
    "desc": "부분객체 분류자와 범주 안의 논리",
    "page": 434,
    "ready": true
  },
  {
    "id": "30",
    "file": "30-lawvere-theories.html",
    "title": "로비어 이론",
    "part": "Part III · 심화",
    "desc": "유한 곱과 연산으로 대수 이론을 표현하기",
    "page": 443,
    "ready": true
  },
  {
    "id": "31",
    "file": "31-monads-monoids-categories.html",
    "title": "모나드·모노이드·범주",
    "part": "Part III · 심화",
    "desc": "쌍범주에서 세 구조의 관계 정리하기",
    "page": 462,
    "ready": true
  }
];
  window.MM = window.MM || {};
  MM.CHAPTERS = CHAPTERS;
  const LS = { theme: "ctfp-csharp-theme", visited: "ctfp-csharp-visited" };

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
    bar.innerHTML = `<a class="home" href="index.html">범주론 · C#</a>
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

    const footer = el("footer", {class:"course-footer"});
    footer.innerHTML = '<a href="../index.html">전체 코스 라이브러리</a><p>Bartosz Milewski의 <a href="https://ai.dmi.unibas.ch/research/reading_group/milewski-2023-01-30.pdf">Category Theory for Programmers</a> (Igal Tabachnik 편집, 2023-01-30, 98b71ac)를 바탕으로 C# 예제·한국어 해설·인터랙티브 실습으로 재구성했습니다. 원문 및 이 코스의 각색 학습 콘텐츠: <a rel="license" href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. 원문의 Haskell·C++ 코드는 C#으로 변경했으며 도식과 위젯을 새로 작성했습니다.</p>';
    document.querySelector("main").append(footer);
    if (idx < 0) return;
    markVisited(id);
    const main = document.querySelector("main");
    const pager = el("nav", { class: "pager" });
    const ready = CHAPTERS.filter(c => c.ready), r = ready.findIndex(c => c.id === id);
    const prev = ready[r - 1], next = ready[r + 1];
    pager.innerHTML =
      (prev ? `<a href="${prev.file}"><small>← 이전</small>${prev.id}. ${prev.title}</a>` : `<a href="index.html"><small>← 목차</small>코스 홈</a>`) +
      (next ? `<a class="next" href="${next.file}"><small>다음 →</small>${next.id}. ${next.title}</a>` : `<a class="next" href="index.html"><small>목차 →</small>코스 홈</a>`);
    main.insertBefore(pager, footer);
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
    const n = opts.steps, interval = opts.interval || 1400;
    if (!Number.isInteger(n) || n < 1) throw new Error("steps must be a positive integer");
    let i = 0, timer = null;
    const ctl = el("div", { class: "stepper-ctl" });
    ctl.innerHTML = `<button class="btn" type="button" data-a="first" aria-label="처음 단계">⏮ 처음</button><button class="btn" type="button" data-a="prev">◀ 이전</button>
      <button class="btn primary" type="button" data-a="play" aria-pressed="false">▶ 재생</button><button class="btn" type="button" data-a="next">다음 ▶</button>
      <span class="pos"></span>`;
    const cap = el("div", { class: "stepper-cap", "aria-live": "polite" });
    container.append(ctl, cap);
    const playBtn = ctl.querySelector('[data-a="play"]');
    function show() {
      const c = opts.render(i);
      cap.innerHTML = c == null ? "" : c;
      ctl.querySelector(".pos").textContent = `${i + 1} / ${n}`;
      ctl.querySelector('[data-a="prev"]').disabled = i === 0;
      ctl.querySelector('[data-a="next"]').disabled = i === n - 1;
    }
    function stop() { clearInterval(timer); timer = null; playBtn.textContent = "▶ 재생"; playBtn.setAttribute("aria-pressed", "false"); }
    function play() {
      if (i === n - 1) i = 0, show();
      playBtn.textContent = "⏸ 일시정지";
      playBtn.setAttribute("aria-pressed", "true");
      timer = setInterval(() => { if (i >= n - 1) return stop(); i++; show(); if (i === n - 1) stop(); }, interval);
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
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
    window.addEventListener("pagehide", stop);
    return { go(k) { stop(); i = Number.isFinite(k) ? Math.max(0, Math.min(n - 1, Math.trunc(k))) : 0; show(); }, get index() { return i; }, refresh: show, pause: stop };
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
