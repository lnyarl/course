/* Windows Kernel Deep Dive — 공통 스크립트
 * 셸(상단바/사이드바/페이저) 생성 + 재사용 컴포넌트 초기화
 * 컴포넌트: figure.stepper / figure.explore / .quiz / .tabs / pre>code 하이라이트
 */
(function () {
  'use strict';

  const PARTS = [
    { id: 1, title: 'Part I · 기초' },
    { id: 2, title: 'Part II · 실행' },
    { id: 3, title: 'Part III · 메모리' },
    { id: 4, title: 'Part IV · 객체 · I/O · 보안' },
    { id: 5, title: 'Part V · 실전 · 전문가' },
  ];

  const CHAPTERS = [
    { id: '01', part: 1, file: '01-architecture.html', title: '윈도우 아키텍처 개관', level: 'basic', min: 60,
      summary: '유저/커널 모드, NT의 계층 구조, Executive·Kernel·HAL, 핵심 바이너리와 함수 접두사 체계.' },
    { id: '02', part: 1, file: '02-system-calls.html', title: '시스템 콜과 모드 전환', level: 'basic', min: 75,
      summary: 'ntdll 스텁에서 syscall 명령, KiSystemCall64, SSDT, 트랩 프레임, PreviousMode까지.' },
    { id: '03', part: 1, file: '03-boot-process.html', title: '부팅 과정', level: 'core', min: 70,
      summary: 'UEFI → bootmgfw → winload → ntoskrnl Phase 0/1 → smss → wininit/winlogon. Secure Boot와 ELAM.' },
    { id: '04', part: 2, file: '04-processes-threads.html', title: '프로세스와 스레드', level: 'core', min: 90,
      summary: 'EPROCESS/KPROCESS, ETHREAD/KTHREAD, PEB/TEB, CreateProcess 내부 흐름, Job, 보호 프로세스.' },
    { id: '05', part: 2, file: '05-scheduling.html', title: '스레드 스케줄링', level: 'core', min: 90,
      summary: '우선순위 0–31, 레디 큐, 퀀텀, 우선순위 부스트, 컨텍스트 스위치, 멀티프로세서 스케줄링.' },
    { id: '06', part: 2, file: '06-irql-interrupts.html', title: 'IRQL · 인터럽트 · DPC · APC', level: 'adv', min: 100,
      summary: 'IDT와 APIC, IRQL 사다리, ISR→DPC 분할 처리, 타이머, 커널/유저/스페셜 APC.' },
    { id: '07', part: 2, file: '07-synchronization.html', title: '동기화', level: 'adv', min: 100,
      summary: 'Interlocked, 스핀락/큐드 스핀락, 디스패처 객체와 대기, 뮤텍스, ERESOURCE, 푸시락, 런다운 보호.' },
    { id: '08', part: 3, file: '08-virtual-memory.html', title: '가상 메모리와 페이징', level: 'core', min: 100,
      summary: '주소 공간 레이아웃, 4단계 페이지 테이블, PTE 비트, TLB, 대형 페이지, 셀프맵, 주소 변환 실습.' },
    { id: '09', part: 3, file: '09-memory-manager.html', title: '메모리 관리자 내부', level: 'adv', min: 120,
      summary: 'VAD, 페이지 폴트 처리, 프로토타입 PTE, 워킹셋, PFN 데이터베이스와 페이지 리스트, 섹션, 풀.' },
    { id: '10', part: 4, file: '10-object-manager.html', title: '객체 관리자와 핸들', level: 'core', min: 90,
      summary: 'OBJECT_HEADER, 객체 타입, 핸들 테이블, 참조 카운트, 객체 네임스페이스와 심볼릭 링크.' },
    { id: '11', part: 4, file: '11-io-system.html', title: 'I/O 시스템과 IRP', level: 'adv', min: 120,
      summary: '드라이버/디바이스 객체, IRP와 스택 로케이션, 계층형 드라이버, 완료 루틴, 버퍼링 방식, PnP/전원.' },
    { id: '12', part: 4, file: '12-filesystem-cache.html', title: '파일 시스템 · 캐시 · 미니필터', level: 'adv', min: 100,
      summary: 'NTFS 구조, FCB/SCB, 캐시 매니저와 Lazy Writer, Filter Manager와 미니필터 고도(altitude).' },
    { id: '13', part: 4, file: '13-security.html', title: '보안 모델', level: 'adv', min: 100,
      summary: 'SRM, 토큰과 SID, 특권, DACL 접근 검사 알고리즘, 무결성 수준, UAC, PPL, AppContainer.' },
    { id: '14', part: 5, file: '14-driver-development.html', title: '커널 드라이버 개발', level: 'adv', min: 120,
      summary: 'WDK, DriverEntry/Unload, IOCTL 디바이스, WDM vs KMDF, IRQL 규칙, Driver Verifier, 서명.' },
    { id: '15', part: 5, file: '15-debugging.html', title: '커널 디버깅과 크래시 분석', level: 'expert', min: 120,
      summary: 'WinDbg/KDNET, 심볼, 핵심 명령어, 버그체크 분석 실전, 덤프 종류, 흔한 버그 패턴.' },
    { id: '16', part: 5, file: '16-mitigations-vbs.html', title: '커널 보안 메커니즘과 VBS', level: 'expert', min: 120,
      summary: 'KASLR, SMEP/SMAP, KVA Shadow, PatchGuard, DSE, HVCI, VTL, Secure Kernel, kCET, 커널 콜백과 ETW.' },
    { id: '17', part: 5, file: '17-expert-roadmap.html', title: '전문가 로드맵과 실습 랩', level: 'expert', min: 60,
      summary: '실습 환경 구축, 단계별 랩 과제, 추천 도서/자료, 전문가로 가는 프로젝트 트랙.' },
  ];

  const LEVEL = { basic: '입문', core: '핵심', adv: '심화', expert: '전문가' };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 무시 */ } },
  };
  const getDone = () => store.get('wk-done', {});
  const setDone = (id, v) => { const d = getDone(); if (v) d[id] = 1; else delete d[id]; store.set('wk-done', d); };

  // 테마는 최대한 일찍 적용
  const savedTheme = store.get('wk-theme', null);
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

  window.WK = { PARTS, CHAPTERS, LEVEL, store, getDone, setDone };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- 셸 ---------------- */
  function buildShell() {
    const main = $('main');
    if (!main) return;
    const chId = document.body.dataset.chapter || '';
    const cur = CHAPTERS.find(c => c.id === chId);

    // 화살표 마커 정의 (모든 SVG에서 url(#wk-arr*)로 참조)
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
    defs.setAttribute('style', 'position:absolute');
    defs.setAttribute('aria-hidden', 'true');
    const mk = (id, color) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:${color}"/></marker>`;
    defs.innerHTML = '<defs>' + mk('wk-arr', 'var(--muted)') + mk('wk-arr-acc', 'var(--acc)') + mk('wk-arr-kernel', 'var(--kernel)') +
      mk('wk-arr-user', 'var(--user)') + mk('wk-arr-ok', 'var(--ok)') + mk('wk-arr-bad', 'var(--bad)') + mk('wk-arr-hv', 'var(--hv)') + '</defs>';
    document.body.prepend(defs);

    const readbar = el('div', 'readbar');
    const top = el('header', 'topbar');
    const done = getDone();
    const nDone = CHAPTERS.filter(c => done[c.id]).length;
    top.innerHTML =
      `<button class="icon-btn nav-toggle" aria-label="목차">☰</button>` +
      `<a class="brand" href="index.html"><span class="logo">NT</span>Windows Kernel Deep Dive</a>` +
      `<span class="crumb">${cur ? '· ' + cur.id + '. ' + esc(cur.title) : ''}</span>` +
      `<span class="spacer"></span>` +
      `<span class="prog" title="완료한 챕터"><span class="bar"><i style="width:${(nDone / CHAPTERS.length) * 100}%"></i></span>${nDone}/${CHAPTERS.length}</span>` +
      `<button class="icon-btn theme-btn" aria-label="테마 전환">◐</button>`;

    const side = el('aside', 'sidebar');
    let html = `<a class="home" href="index.html">🏠 코스 홈 · 로드맵</a>`;
    PARTS.forEach(p => {
      html += `<div class="part">${esc(p.title)}</div>`;
      CHAPTERS.filter(c => c.part === p.id).forEach(c => {
        html += `<a class="ch${c.id === chId ? ' cur' : ''}" href="${c.file}"><span class="n">${c.id}</span><span>${esc(c.title)}</span>${done[c.id] ? '<span class="ck">✓</span>' : ''}</a>`;
        if (c.id === chId) html += `<nav class="toc"></nav>`;
      });
    });
    html += `<div class="extra"><a class="ch${chId === 'glossary' ? ' cur' : ''}" href="glossary.html"><span class="n">📖</span><span>용어집</span></a></div>`;
    side.innerHTML = html;

    const layout = el('div', 'layout');
    main.parentNode.insertBefore(layout, main);
    layout.append(side, main);
    main.classList.add('content-wrap');
    if (!main.querySelector(':scope > .content')) {
      const inner = el('div', 'content');
      while (main.firstChild) inner.appendChild(main.firstChild);
      main.appendChild(inner);
    }
    document.body.prepend(top);
    document.body.prepend(readbar);

    // 목차 (h2)
    const toc = $('.toc', side);
    if (toc) {
      const hs = $$('main h2');
      hs.forEach((h, i) => {
        if (!h.id) h.id = 's' + (i + 1);
        const a = el('a', null, esc(h.textContent));
        a.href = '#' + h.id;
        toc.appendChild(a);
      });
      if ('IntersectionObserver' in window && hs.length) {
        const links = $$('a', toc);
        const io = new IntersectionObserver(ents => {
          ents.forEach(e => {
            if (e.isIntersecting) {
              links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id));
            }
          });
        }, { rootMargin: '-60px 0px -70% 0px' });
        hs.forEach(h => io.observe(h));
      }
    }
    const curLink = $('a.ch.cur', side);
    if (curLink) setTimeout(() => curLink.scrollIntoView({ block: 'center' }), 0);

    $('.nav-toggle', top).addEventListener('click', () => document.body.classList.toggle('nav-open'));
    side.addEventListener('click', e => { if (e.target.closest('a')) document.body.classList.remove('nav-open'); });
    $('.theme-btn', top).addEventListener('click', () => {
      const isDark = getComputedStyle(document.documentElement).colorScheme.includes('dark');
      const next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store.set('wk-theme', next);
    });
    window.addEventListener('scroll', () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      readbar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    }, { passive: true });

    // 챕터 끝: 완료 버튼 + 이전/다음
    if (cur) {
      const idx = CHAPTERS.indexOf(cur);
      const prev = CHAPTERS[idx - 1], next = CHAPTERS[idx + 1];
      const end = el('div', 'chapter-end');
      const btn = el('button', 'done-btn');
      const paint = () => { const on = !!getDone()[cur.id]; btn.classList.toggle('on', on); btn.textContent = on ? '✓ 학습 완료됨' : '이 챕터 학습 완료로 표시'; };
      btn.addEventListener('click', () => { setDone(cur.id, !getDone()[cur.id]); paint(); });
      paint();
      end.appendChild(btn);
      const pager = el('div', 'pager');
      if (prev) pager.appendChild(el('a', 'prev', `<small>← 이전</small>${prev.id}. ${esc(prev.title)}`)).href = prev.file;
      if (next) pager.appendChild(el('a', 'next', `<small>다음 →</small>${next.id}. ${esc(next.title)}`)).href = next.file;
      end.appendChild(pager);
      $('.content', main).appendChild(end);
    }
  }

  /* ---------------- 리스트 표기 파서: "2", "2,4", "2-5", "3+" ---------------- */
  function inList(spec, k) {
    return String(spec).split(/[\s,]+/).filter(Boolean).some(t => {
      if (t.endsWith('+')) return k >= +t.slice(0, -1);
      const m = t.match(/^(\d+)-(\d+)$/);
      if (m) return k >= +m[1] && k <= +m[2];
      return k === +t;
    });
  }
  // "1:값|3:값" → k 이하 중 가장 큰 키의 값 (없으면 첫 값)
  function keyed(spec, k) {
    const pairs = String(spec).split('|').map(s => { const i = s.indexOf(':'); return [+s.slice(0, i), s.slice(i + 1)]; });
    let best = pairs[0][1];
    pairs.forEach(([n, v]) => { if (n <= k) best = v; });
    return best;
  }

  /* ---------------- 스테퍼 (단계별 애니메이션) ----------------
   * <figure class="fig stepper" data-interval="2600">
   *   <svg class="dia"> ... data-on="3" data-off="5" data-only="2,4" data-hl="2-3" data-dim="4+"
   *                       data-at="1:0,0|3:120,40" (translate)  data-text="1:0x0|2:0x1F" (텍스트 교체) ... </svg>
   *   <ol class="steps"><li>1단계 설명</li>...</ol>
   * </figure>
   * 페이지 스크립트는 figure에 'wk:step' 이벤트(detail.step)를 받을 수 있다.
   */
  function initStepper(fig) {
    const steps = $$(':scope > ol.steps > li', fig);
    const n = steps.length;
    if (!n) return;
    steps.forEach((li, i) => li.setAttribute('data-n', `${i + 1}/${n}`));
    let cur = 1, timer = null;
    const ms = +fig.dataset.interval || 2600;
    const ctrl = el('div', 'stepper-ctrl');
    ctrl.innerHTML =
      `<button class="btn" data-a="first" title="처음으로">⏮</button>` +
      `<button class="btn" data-a="prev">◀ 이전</button>` +
      `<button class="btn primary" data-a="play">▶ 자동 재생</button>` +
      `<button class="btn" data-a="next">다음 ▶</button>` +
      `<span class="count"></span><span class="dots"></span>`;
    const dots = $('.dots', ctrl);
    for (let i = 1; i <= n; i++) {
      const d = el('button'); d.title = i + '단계'; d.addEventListener('click', () => { stop(); go(i); }); dots.appendChild(d);
    }
    const ol = $(':scope > ol.steps', fig);
    fig.insertBefore(ctrl, ol);
    const playBtn = $('[data-a=play]', ctrl);

    function render() {
      $$('[data-on]', fig).forEach(e => e.classList.toggle('st-hide', cur < +e.dataset.on || !!(e.dataset.off && cur >= +e.dataset.off)));
      $$('[data-off]:not([data-on])', fig).forEach(e => e.classList.toggle('st-hide', cur >= +e.dataset.off));
      $$('[data-only]', fig).forEach(e => e.classList.toggle('st-hide', !inList(e.dataset.only, cur)));
      $$('[data-hl]', fig).forEach(e => e.classList.toggle('hl', inList(e.dataset.hl, cur)));
      $$('[data-dim]', fig).forEach(e => e.classList.toggle('dim', inList(e.dataset.dim, cur)));
      $$('[data-at]', fig).forEach(e => {
        const [x, y] = keyed(e.dataset.at, cur).split(',').map(Number);
        e.style.transform = `translate(${x}px, ${y}px)`;
      });
      $$('[data-text]', fig).forEach(e => { e.textContent = keyed(e.dataset.text, cur); });
      steps.forEach((li, i) => li.classList.toggle('active', i === cur - 1));
      $('.count', ctrl).textContent = `${cur} / ${n}`;
      $$('button', dots).forEach((d, i) => { d.classList.toggle('on', i === cur - 1); d.classList.toggle('past', i < cur - 1); });
      $('[data-a=prev]', ctrl).disabled = cur === 1;
      $('[data-a=next]', ctrl).disabled = cur === n;
      fig.dispatchEvent(new CustomEvent('wk:step', { detail: { step: cur, total: n } }));
    }
    function go(k) { cur = Math.max(1, Math.min(n, k)); render(); }
    function stop() { clearInterval(timer); timer = null; playBtn.textContent = '▶ 자동 재생'; }
    function play() {
      if (cur === n) go(1);
      playBtn.textContent = '⏸ 일시정지';
      timer = setInterval(() => { if (cur >= n) stop(); else go(cur + 1); }, ms);
    }
    ctrl.addEventListener('click', e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const act = a.dataset.a;
      if (act === 'play') { timer ? stop() : play(); return; }
      stop();
      if (act === 'first') go(1);
      if (act === 'prev') go(cur - 1);
      if (act === 'next') go(cur + 1);
    });
    fig.wkGo = go;
    render();
  }

  /* ---------------- 익스플로러 (클릭해서 설명 보기) ----------------
   * <figure class="fig explore">
   *   <svg class="dia"> <g data-info="key"><rect class="box".../><text/></g> </svg>
   *   <div class="info-panel"></div>   (생략 시 자동 생성)
   *   <template data-key="key"><h4>제목</h4><p>설명</p></template>
   * </figure>
   */
  function initExplore(fig) {
    let panel = $(':scope > .info-panel', fig);
    if (!panel) { panel = el('div', 'info-panel'); const cap = $(':scope > figcaption', fig); fig.insertBefore(panel, cap); }
    const hint = panel.innerHTML.trim() || '<span class="hint">👆 도식의 요소를 클릭하면 상세 설명이 표시됩니다.</span>';
    panel.innerHTML = hint;
    const items = $$('[data-info]', fig);
    items.forEach(it => {
      it.setAttribute('tabindex', '0');
      it.setAttribute('role', 'button');
      const pick = () => {
        const key = it.dataset.info;
        const tpl = $(`template[data-key="${key}"]`, fig);
        items.forEach(o => o.classList.toggle('sel', o.dataset.info === key));
        panel.innerHTML = tpl ? tpl.innerHTML : hint;
        panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = '';
        $$('pre code', panel).forEach(highlight);
        fig.dispatchEvent(new CustomEvent('wk:info', { detail: { key } }));
      };
      it.addEventListener('click', pick);
      it.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
  }

  /* ---------------- 퀴즈 ----------------
   * <div class="quiz"><p class="q">질문</p>
   *   <ol class="opts"><li>보기</li><li data-correct>정답</li></ol>
   *   <div class="explain">해설</div></div>
   */
  function initQuiz(q) {
    const opts = $$('.opts > li', q);
    const retry = el('button', 'btn retry', '↺ 다시 풀기');
    q.appendChild(retry);
    opts.forEach(li => {
      li.setAttribute('tabindex', '0');
      const pick = () => {
        if (q.classList.contains('done')) return;
        q.classList.add('done');
        li.classList.add(li.hasAttribute('data-correct') ? 'correct' : 'wrong');
        opts.forEach(o => { if (o.hasAttribute('data-correct')) o.classList.add('correct'); });
      };
      li.addEventListener('click', pick);
      li.addEventListener('keydown', e => { if (e.key === 'Enter') pick(); });
    });
    retry.addEventListener('click', () => { q.classList.remove('done'); opts.forEach(o => o.classList.remove('correct', 'wrong')); });
  }

  /* ---------------- 탭 ---------------- */
  function initTabs(t) {
    const btns = $$(':scope > .tab-bar > button', t);
    const panels = $$(':scope > .tab-panel', t);
    const show = i => { btns.forEach((b, j) => b.classList.toggle('on', i === j)); panels.forEach((p, j) => p.classList.toggle('on', i === j)); };
    btns.forEach((b, i) => b.addEventListener('click', () => show(i)));
    show(0);
  }

  /* ---------------- 코드 하이라이트 ---------------- */
  const C_KW = 'if|else|for|while|do|return|switch|case|default|break|continue|goto|struct|union|typedef|enum|sizeof|static|const|volatile|extern|void|int|char|unsigned|signed|long|short|bool|true|false|__try|__except|__finally|__leave|inline|__forceinline|auto|class|public|private|namespace|template|nullptr|new|delete|_In_|_Out_|_Inout_|_In_opt_|_Out_opt_|_Use_decl_annotations_';
  const C_RE = new RegExp(
    '(//[^\\n]*|/\\*[\\s\\S]*?\\*/)' +                     // 1 주석
    '|("(?:[^"\\\\\\n]|\\\\.)*"|L"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\')' + // 2 문자열
    '|(^[ \\t]*#[ \\t]*\\w+)' +                            // 3 전처리기
    '|\\b(0x[0-9a-fA-F`]+[uUlL]*|\\d+[uUlL]*)\\b' +          // 4 숫자
    '|\\b(' + C_KW + ')\\b' +                               // 5 키워드
    '|\\b([A-Z][A-Z0-9_]{2,}|[A-Z]\\w*_[A-Z]\\w*|P?K[A-Z]\\w*_\\w+)\\b' + // 6 타입/매크로
    '|\\b([A-Za-z_]\\w*)(?=\\s*\\()',                      // 7 함수 호출
    'gm');
  const ASM_RE = /(;[^\n]*)|\b(0x[0-9a-fA-F`]+|[0-9a-fA-F`]{6,}h?|\d+)\b|\b(r[a-d]x|r[sd]i|r[sb]p|r(?:8|9|1[0-5])[dwb]?|e[a-d]x|e[sd]i|e[sb]p|[a-d][lhx]|[sd]il|[sb]pl|rip|cr[0-8]|dr[0-7]|[cdefgs]s|xmm\d+|rflags|eflags)\b|^(\s*(?:[\w.]+:)?\s*)([a-z][a-z0-9]*)\b/gim;

  function hlC(src) {
    let out = '', last = 0;
    src.replace(C_RE, (m, cm, st, pp, num, kw, ty, fn, off) => {
      out += esc(src.slice(last, off));
      const cls = cm ? 'c' : st ? 's' : pp ? 'k' : num ? 'n' : kw ? 'k' : ty ? 't' : 'f';
      out += `<span class="tk-${cls}">${esc(m)}</span>`;
      last = off + m.length;
      return m;
    });
    return out + esc(src.slice(last));
  }
  function hlAsm(src) {
    let out = '', last = 0;
    src.replace(ASM_RE, (m, cm, num, reg, pre, mn, off) => {
      out += esc(src.slice(last, off));
      if (cm) out += `<span class="tk-c">${esc(m)}</span>`;
      else if (num) out += `<span class="tk-n">${esc(m)}</span>`;
      else if (reg) out += `<span class="tk-r">${esc(m)}</span>`;
      else out += esc(pre) + `<span class="tk-k">${esc(mn)}</span>`;
      last = off + m.length;
      return m;
    });
    return out + esc(src.slice(last));
  }
  function hlDbg(src) {
    return src.split('\n').map(line => {
      const m = line.match(/^(\s*(?:\d+:\s*)?(?:kd|lkd|\d+:\d+:\w+)>\s?)(.*)$/);
      if (m) return `<span class="tk-pr">${esc(m[1])}</span><span class="tk-f">${esc(m[2])}</span>`;
      if (/^\s*(\$\$|\*\*\*|\/\/)/.test(line)) return `<span class="tk-c">${esc(line)}</span>`;
      return esc(line)
        .replace(/\b([0-9a-f]{8}`[0-9a-f]{8}|[0-9a-f]{16}|0x[0-9a-f]+)\b/gi, '<span class="tk-n">$1</span>')
        .replace(/\b(nt|hal|ntdll|kernel32|kernelbase|win32k\w*|fltmgr|ntfs|\w+\.sys)!/gi, '<span class="tk-t">$1</span>!');
    }).join('\n');
  }
  function hlPs(src) {
    return src.split('\n').map(line => {
      const m = line.match(/^(\s*(?:PS [^>]*>|>|\$|C:\\[^>]*>)\s?)(.*)$/);
      if (/^\s*#/.test(line)) return `<span class="tk-c">${esc(line)}</span>`;
      if (m) return `<span class="tk-pr">${esc(m[1])}</span><span class="tk-f">${esc(m[2])}</span>`;
      return esc(line);
    }).join('\n');
  }
  function highlight(code) {
    if (code.dataset.hl) return;
    code.dataset.hl = '1';
    const cls = code.className;
    const src = code.textContent.replace(/^\n/, '');
    if (/lang-(c|cpp|h)\b/.test(cls)) code.innerHTML = hlC(src);
    else if (/lang-asm\b/.test(cls)) code.innerHTML = hlAsm(src);
    else if (/lang-windbg\b/.test(cls)) code.innerHTML = hlDbg(src);
    else if (/lang-(ps|shell|cmd)\b/.test(cls)) code.innerHTML = hlPs(src);
  }
  function addCopy(pre) {
    const b = el('button', 'copy', '복사');
    b.addEventListener('click', () => {
      const t = (pre.querySelector('code') || pre).innerText;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(
        () => { b.textContent = '복사됨'; setTimeout(() => b.textContent = '복사', 1200); },
        () => { b.textContent = '실패'; });
    });
    pre.appendChild(b);
  }

  /* ---------------- 표 래핑 ---------------- */
  function wrapTables() {
    $$('main table').forEach(t => {
      if (t.parentElement.classList.contains('table-wrap')) return;
      const w = el('div', 'table-wrap'); t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
  }

  function init() {
    buildShell();
    wrapTables();
    $$('pre code').forEach(highlight);
    $$('pre').forEach(addCopy);
    $$('figure.stepper').forEach(initStepper);
    $$('figure.explore').forEach(initExplore);
    $$('.quiz').forEach(initQuiz);
    $$('.tabs').forEach(initTabs);
    document.dispatchEvent(new CustomEvent('wk:ready'));
  }
  window.WK.highlight = highlight;
  window.WK.inList = inList;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
