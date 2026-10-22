// 공통 스크립트: 내비게이션, 테마, 퀴즈, 스텝 플레이어, 탭, 진도 저장
(function () {
  const CHAPTERS = [
    // Part 1. 런타임 내부
    { id: "01", file: "01-architecture-bootstrap.html", title: "Node.js 아키텍처와 부트스트랩", part: "런타임 내부", desc: "V8·libuv·바인딩 레이어, node 프로세스가 뜨는 순서, 스냅샷" },
    { id: "02", file: "02-event-loop.html", title: "이벤트 루프 심층 해부", part: "런타임 내부", desc: "6개 페이즈, nextTick/마이크로태스크 우선순위, poll 블로킹, 스타베이션" },
    { id: "03", file: "03-libuv-threadpool-io.html", title: "libuv 스레드풀과 I/O 모델", part: "런타임 내부", desc: "epoll/kqueue vs 스레드풀, fs·dns·crypto가 가는 길, UV_THREADPOOL_SIZE" },
    { id: "04", file: "04-v8-jit-optimization.html", title: "V8 JIT와 최적화·역최적화", part: "런타임 내부", desc: "Ignition→Sparkplug→Maglev→TurboFan, 히든 클래스, 인라인 캐시, deopt" },
    { id: "05", file: "05-v8-memory-gc.html", title: "V8 메모리 구조와 GC", part: "런타임 내부", desc: "Young/Old 세대, Scavenger, Mark-Compact, Orinoco, 힙 플래그 튜닝" },
    { id: "06", file: "06-streams-backpressure.html", title: "스트림과 백프레셔", part: "런타임 내부", desc: "highWaterMark, Readable 상태 머신, pipeline, 웹 스트림 상호운용" },
    { id: "07", file: "07-async-internals.html", title: "비동기 내부: Promise, async_hooks, ALS", part: "런타임 내부", desc: "마이크로태스크 큐의 실체, await 변환, AsyncLocalStorage, 컨텍스트 전파" },
    { id: "08", file: "08-module-system.html", title: "모듈 시스템: CJS·ESM·로더", part: "런타임 내부", desc: "해석 알고리즘, exports 맵, 순환 참조, require(esm), 커스텀 훅" },
    // Part 2. 성능과 진단
    { id: "09", file: "09-multicore-workers-cluster.html", title: "멀티코어: Worker, Cluster, 자식 프로세스", part: "성능과 진단", desc: "worker_threads vs cluster vs child_process, SharedArrayBuffer/Atomics, IPC" },
    { id: "10", file: "10-cpu-profiling.html", title: "CPU 프로파일링과 핫패스 최적화", part: "성능과 진단", desc: "--cpu-prof, 플레임 그래프 읽기, 벤치마크 함정, 이벤트 루프 지연 측정" },
    { id: "11", file: "11-memory-leak-diagnosis.html", title: "메모리 누수 진단", part: "성능과 진단", desc: "힙 스냅샷 비교, retainer 트리, 누수 패턴 6종, 프로덕션 덤프 전략" },
    { id: "12", file: "12-networking-http.html", title: "네트워킹 심층: HTTP/1.1·2, 커넥션 관리", part: "성능과 진단", desc: "keep-alive와 Agent 풀, 타임아웃 7종, HTTP/2, TLS 비용, undici" },
    { id: "13", file: "13-errors-resilience.html", title: "에러 처리와 복원력 패턴", part: "성능과 진단", desc: "uncaughtException 정책, 그레이스풀 셧다운, 서킷 브레이커, 재시도·백오프" },
    // Part 3. 운영
    { id: "14", file: "14-production-deployment.html", title: "프로덕션 배포: 컨테이너, 시그널, 리소스", part: "운영", desc: "Docker 이미지 최적화, PID 1 문제, k8s 프로브, cgroup과 힙 크기, 12-factor" },
    { id: "15", file: "15-observability.html", title: "관측성: 로그·메트릭·트레이스", part: "운영", desc: "pino 구조화 로깅, 이벤트 루프 지연 메트릭, OpenTelemetry, 진단 리포트" },
    { id: "16", file: "16-security.html", title: "보안: 공급망부터 런타임까지", part: "운영", desc: "프로토타입 오염, ReDoS, lockfile·provenance, 권한 모델, HTTP 한계값" },
    { id: "17", file: "17-testing-quality.html", title: "테스트 전략과 품질 게이트", part: "운영", desc: "node:test, 모킹 경계, 플래키 테스트, 계약 테스트, 성능 회귀 CI" },
    { id: "18", file: "18-scalable-architecture.html", title: "확장 가능한 서비스 아키텍처", part: "운영", desc: "캐시 계층, 큐·멱등성, 레이트 리미팅, 그레이스풀 디그레이드, 설정 관리" },
    // Part 4. 확장과 실전
    { id: "19", file: "19-native-addons-wasm.html", title: "네이티브 확장: N-API, WASM, FFI", part: "확장과 실전", desc: "Node-API 바인딩, 스레드 안전 콜백, WebAssembly 통합, 빌드·배포" },
    { id: "20", file: "20-diagnostics-workshop.html", title: "실전 진단 워크숍", part: "확장과 실전", desc: "CPU 100%, 메모리 폭증, 루프 블로킹, 커넥션 고갈: 사례 기반 종합 훈련" },
  ];
  window.MM = window.MM || {};
  MM.CHAPTERS = CHAPTERS;
  const LS = { theme: "njs-theme", visited: "njs-visited" };

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
    bar.innerHTML = `<a class="home" href="index.html">⬢ Node.js 전문가 코스</a>
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
    const prev = CHAPTERS[idx - 1], next = CHAPTERS[idx + 1];
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
