// 공통 스크립트: 내비게이션, 테마, 퀴즈, 스텝 플레이어, 탭, 진도 저장
(function () {
  // ready: false 인 장은 목차에 "준비 중"으로 표시되고 이전/다음 내비게이션에서 건너뛴다.
  const CHAPTERS = [
    // Part 1. 프로세스와 격리
    { id: "01", file: "01-process-exec.html", title: "프로세스 실행: fork · exec · wait", part: "프로세스와 격리", desc: "개발 환경, 자식 프로세스 실행, 종료 코드 전달, 좀비와 고아", ready: true },
    { id: "02", file: "02-uts-pid-namespace.html", title: "UTS · PID 네임스페이스", part: "프로세스와 격리", desc: "clone 플래그, hostname 격리, PID 1의 특별 대우, 미니 init", ready: true },
    { id: "03", file: "03-mount-pivot-root.html", title: "파일시스템 격리: mount ns와 pivot_root", part: "프로세스와 격리", desc: "마운트 전파, rootfs 준비, pivot_root, /proc·/dev 마운트", ready: true },
    // Part 2. 자원 · 권한 · 네트워크
    { id: "04", file: "04-cgroups-v2.html", title: "cgroups v2 자원 제한", part: "자원 · 권한 · 네트워크", desc: "트리 규칙, memory.max와 OOM, cpu.max와 throttling, pids.max", ready: true },
    { id: "05", file: "05-user-namespace.html", title: "user 네임스페이스와 rootless", part: "자원 · 권한 · 네트워크", desc: "UID/GID 매핑, setgroups, 부모·자식 동기화, rootless 권한 경계", ready: true },
    { id: "06", file: "06-network.html", title: "컨테이너 네트워크", part: "자원 · 권한 · 네트워크", desc: "net namespace, veth와 브리지, 동기화 파이프, NAT와 conntrack, netlink", ready: true },
    { id: "07", file: "07-security.html", title: "보안 강화: capabilities · seccomp", part: "자원 · 권한 · 네트워크", desc: "capability 집합과 exec 규칙, no_new_privs, seccomp BPF 필터, 두 겹 방어", ready: true },
    // Part 3. 이미지와 표준
    { id: "08", file: "08-oci-image-overlayfs.html", title: "OCI 이미지와 overlayfs", part: "이미지와 표준", desc: "index·manifest·config·layer, 레지스트리 API와 digest 검증, overlayfs와 whiteout, 이미지 설정으로 실행", ready: true },
    { id: "09", file: "09-oci-runtime-spec.html", title: "OCI 런타임 스펙", part: "이미지와 표준", desc: "bundle과 config.json, create/start와 exec.fifo, 상태 판정, seccomp 프로파일 번역, docker run --runtime=myctr", ready: true },
  ];
  window.MM = window.MM || {};
  MM.CHAPTERS = CHAPTERS;
  const LS = { theme: "ctr-theme", visited: "ctr-visited" };

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
    bar.innerHTML = `<a class="home" href="index.html">📦 컨테이너 런타임 만들기</a>
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
