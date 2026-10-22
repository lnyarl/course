// 공통 스크립트: 내비게이션, 테마, 퀴즈, 스텝 플레이어
(function () {
  const CHAPTERS = [
    { id: "01", file: "01-hierarchy-address-space.html", title: "메모리 계층과 프로세스 주소 공간", part: "개론" },
    { id: "02", file: "02-contiguous-allocation.html", title: "주소 바인딩과 연속 메모리 할당", part: "개론" },
    { id: "03", file: "03-paging-basics.html", title: "페이징과 주소 변환", part: "개론" },
    { id: "04", file: "04-tlb.html", title: "TLB와 유효 접근 시간", part: "개론" },
    { id: "05", file: "05-multilevel-page-tables.html", title: "다단계 페이지 테이블과 x86-64", part: "개론" },
    { id: "06", file: "06-virtual-memory-page-fault.html", title: "가상 메모리와 페이지 폴트", part: "개론" },
    { id: "07", file: "07-page-replacement.html", title: "페이지 교체 알고리즘", part: "개론" },
    { id: "08", file: "08-thrashing-working-set.html", title: "스래싱, 워킹셋, 프레임 할당", part: "심화" },
    { id: "09", file: "09-kernel-allocators.html", title: "커널 할당자: Buddy와 Slab/SLUB", part: "심화" },
    { id: "10", file: "10-user-allocators.html", title: "유저 공간 할당자: malloc의 내부", part: "심화" },
    { id: "11", file: "11-cow-mmap-pagecache.html", title: "Copy-on-Write, mmap, 페이지 캐시", part: "심화" },
    { id: "12", file: "12-linux-reclaim-oom.html", title: "Linux 메모리 회수, swap, OOM, cgroup", part: "심화" },
    { id: "13", file: "13-numa-hugepages-cache.html", title: "NUMA, Huge Page, 캐시와 메모리 모델", part: "심화" },
    { id: "14", file: "14-memory-security.html", title: "메모리 보안: ASLR, NX, KPTI, MTE", part: "심화" },
    { id: "15", file: "15-virtualization-memory.html", title: "가상화와 메모리: EPT, Ballooning, KSM", part: "심화" },
    { id: "16", file: "16-practice-diagnostics.html", title: "실전 진단 도구와 종합 문제", part: "실전" },
  ];
  window.MM = window.MM || {};
  MM.CHAPTERS = CHAPTERS;

  // 테마
  try {
    const saved = localStorage.getItem("mm-theme");
    if (saved) document.documentElement.dataset.theme = saved;
  } catch (e) {}
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("mm-theme", next); } catch (e) {}
  }

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
    bar.innerHTML = `<a class="home" href="index.html">🧠 메모리 관리 코스</a>
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
      const v = JSON.parse(localStorage.getItem("mm-visited") || "{}");
      v[id] = 1;
      localStorage.setItem("mm-visited", JSON.stringify(v));
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
  MM.hex = (v, w) => "0x" + v.toString(16).toUpperCase().padStart(w || 1, "0");
  MM.bin = (v, w) => v.toString(2).padStart(w, "0");
  MM.bytes = b => b >= 1 << 30 ? (b / (1 << 30)).toFixed(1) + " GiB" : b >= 1 << 20 ? (b / (1 << 20)).toFixed(1) + " MiB" : b >= 1024 ? (b / 1024).toFixed(1) + " KiB" : b + " B";

  document.addEventListener("DOMContentLoaded", () => {
    buildNav();
    initQuizzes();
  });
})();
