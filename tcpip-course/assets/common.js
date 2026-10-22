/* ===== TCP/IP 전문가 과정 · 공통 스크립트 ===== */
(function () {
  'use strict';

  const COURSE = [
    { part: 'Part 1 · 개론', chapters: [
      { id: '01', file: '01-model.html', title: '네트워크와 TCP/IP 모델', desc: '계층 구조, 캡슐화, 패킷의 여행' },
      { id: '02', file: '02-link.html', title: '링크 계층: Ethernet · ARP · 스위치', desc: '프레임 구조, MAC 학습, ARP' },
      { id: '03', file: '03-ip.html', title: 'IP 계층: 주소 · 서브넷 · 라우팅 기초', desc: 'IPv4 헤더, CIDR 계산기, 단편화' },
      { id: '04', file: '04-icmp-dns-dhcp.html', title: 'ICMP · DNS · DHCP', desc: 'ping, traceroute, 이름 해석, 주소 할당' },
      { id: '05', file: '05-transport.html', title: '전송 계층 기초: UDP와 TCP', desc: '포트, 3-way handshake, 상태 머신' },
      { id: '06', file: '06-application.html', title: '응용 계층과 소켓', desc: 'HTTP, 소켓 API, 요청 전체 흐름' },
    ]},
    { part: 'Part 2 · 심화', chapters: [
      { id: '07', file: '07-reliability.html', title: 'TCP 신뢰성: 시퀀스 · ACK · 재전송', desc: '슬라이딩 윈도우, RTO, SACK' },
      { id: '08', file: '08-congestion.html', title: '혼잡 제어', desc: 'Slow Start, Reno, CUBIC, BBR 시뮬레이터' },
      { id: '09', file: '09-tcp-advanced.html', title: 'TCP 심화 옵션과 동작', desc: 'Nagle, TIME_WAIT, BDP, TFO' },
      { id: '10', file: '10-ipv6.html', title: 'IPv6', desc: '주소 체계, NDP, SLAAC, 전환 기술' },
      { id: '11', file: '11-routing.html', title: '라우팅 심화: OSPF · BGP', desc: 'Dijkstra, Bellman-Ford, 경로 정책' },
      { id: '12', file: '12-nat-security.html', title: 'NAT · 방화벽 · TLS · 공격과 방어', desc: 'NAT 유형, TLS 1.3, SYN flood' },
      { id: '13', file: '13-performance.html', title: '성능 분석과 도구', desc: 'tcpdump, sysctl, 지연 분해, QUIC' },
      { id: '14', file: '14-lab.html', title: '종합 실습: 패킷 디코더와 트러블슈팅', desc: 'hex 디코딩, 체크섬, 사례 분석' },
    ]},
  ];
  const ALL = COURSE.flatMap(p => p.chapters);

  // ---------- utils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs = {}, children = []) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); }
    for (const c of [].concat(children)) { if (c == null) continue; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function fmtNum(n) { return n.toLocaleString('ko-KR'); }

  // ---------- storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const Progress = {
    all() { return store.get('tcpip-progress', {}); },
    is(id) { return !!this.all()[id]; },
    set(id, v) { const p = this.all(); if (v) p[id] = true; else delete p[id]; store.set('tcpip-progress', p); document.dispatchEvent(new CustomEvent('progress-change')); },
    count() { return Object.keys(this.all()).length; }
  };

  // ---------- theme ----------
  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); store.set('tcpip-theme', t); }
  (function initTheme() {
    const saved = store.get('tcpip-theme', null);
    const t = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
  })();
  function toggleTheme() { applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }

  // ---------- sidebar ----------
  function buildSidebar() {
    const sb = $('#sidebar'); if (!sb) return;
    const cur = document.body.dataset.chapter;
    sb.classList.add('sidebar');
    let html = `<div class="brand"><div class="logo">IP</div><a href="index.html">TCP/IP 전문가 과정</a></div>`;
    for (const p of COURSE) {
      html += `<div class="part">${p.part}</div>`;
      for (const c of p.chapters) {
        html += `<a class="nav-item ${c.id === cur ? 'active' : ''}" href="${c.file}" data-id="${c.id}"><span class="n">${c.id}</span><span>${c.title}</span><span class="done" data-done="${c.id}"></span></a>`;
      }
    }
    html += `<div class="progress-mini"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>학습 진행률</span><span id="sb-pct">0%</span></div><div class="bar"><i id="sb-bar" style="width:0"></i></div></div>`;
    html += `<div class="tools"><button class="btn sm" id="theme-btn" title="테마 전환">🌓 테마</button><button class="btn sm" id="reset-progress" title="진행률 초기화">↺ 진행률 초기화</button></div>`;
    sb.innerHTML = html;
    $('#theme-btn').addEventListener('click', toggleTheme);
    $('#reset-progress').addEventListener('click', () => { if (confirm('학습 진행률을 초기화할까요?')) { store.set('tcpip-progress', {}); document.dispatchEvent(new CustomEvent('progress-change')); } });
    const mb = el('button', 'btn menu-btn', '☰ 목차');
    document.body.appendChild(mb);
    mb.addEventListener('click', () => sb.classList.toggle('open'));
    document.addEventListener('click', e => { if (sb.classList.contains('open') && !sb.contains(e.target) && e.target !== mb) sb.classList.remove('open'); });
    refreshProgress();
    document.addEventListener('progress-change', refreshProgress);
  }
  function refreshProgress() {
    const p = Progress.all();
    $$('[data-done]').forEach(s => { s.textContent = p[s.dataset.done] ? '✓' : ''; });
    const pct = Math.round(Progress.count() / ALL.length * 100);
    const b = $('#sb-bar'), t = $('#sb-pct');
    if (b) b.style.width = pct + '%'; if (t) t.textContent = pct + '%';
  }

  // ---------- TOC ----------
  function buildTOC() {
    const toc = $('#toc'); if (!toc) return;
    toc.classList.add('toc');
    const hs = $$('.content h2, .content h3');
    if (!hs.length) { toc.remove(); return; }
    toc.innerHTML = '<div class="toc-title">이 장의 내용</div>';
    hs.forEach((h, i) => {
      if (!h.id) h.id = 'sec-' + i;
      const a = el('a', h.tagName === 'H3' ? 'h3' : '', h.textContent.replace(/^\d+(\.\d+)*\s*/, ''));
      a.href = '#' + h.id; toc.appendChild(a);
    });
    const links = $$('a', toc);
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id)); } });
    }, { rootMargin: '-10% 0px -80% 0px' });
    hs.forEach(h => obs.observe(h));
  }

  // ---------- chapter nav ----------
  function buildChapterNav() {
    const cur = document.body.dataset.chapter; if (!cur) return;
    const idx = ALL.findIndex(c => c.id === cur); if (idx < 0) return;
    const prev = ALL[idx - 1], next = ALL[idx + 1];
    const nav = el('div', 'chapter-nav');
    nav.innerHTML = `<div class="complete"><button class="btn primary" id="complete-btn"></button><span class="small" id="complete-msg"></span></div>
      <div class="links">
        ${prev ? `<a class="prev" href="${prev.file}"><div class="lbl">← 이전</div><div>${prev.id}. ${prev.title}</div></a>` : '<span></span>'}
        ${next ? `<a class="next" href="${next.file}"><div class="lbl">다음 →</div><div>${next.id}. ${next.title}</div></a>` : `<a class="next" href="index.html"><div class="lbl">과정 홈</div><div>전체 커리큘럼으로</div></a>`}
      </div>`;
    ($('.content article') || $('.content')).appendChild(nav);
    const btn = $('#complete-btn'), msg = $('#complete-msg');
    const render = () => { const d = Progress.is(cur); btn.textContent = d ? '✓ 학습 완료됨 (취소)' : '이 장을 완료로 표시'; btn.classList.toggle('primary', !d); msg.textContent = d ? '수고하셨습니다. 다음 장으로 이동하세요.' : ''; };
    btn.addEventListener('click', () => { Progress.set(cur, !Progress.is(cur)); render(); });
    document.addEventListener('progress-change', render);
    render();
  }

  // ---------- Tabs ----------
  function initTabs(root = document) {
    $$('.tabs', root).forEach(t => {
      if (t.dataset.init) return; t.dataset.init = 1;
      const btns = $$('.tab-bar button', t), panels = $$(':scope > .tab-panel', t);
      const go = i => { btns.forEach((b, j) => b.classList.toggle('active', i === j)); panels.forEach((p, j) => p.classList.toggle('active', i === j)); };
      btns.forEach((b, i) => b.addEventListener('click', () => go(i)));
      go(0);
    });
  }

  // ---------- Header diagram ----------
  // HeaderDiagram(container, { bitsPerRow:32, fields:[{name, bits, desc, cls:'c1', variable:true, sub:'16 bit'}] })
  function HeaderDiagram(container, opts) {
    const root = typeof container === 'string' ? $(container) : container;
    const bpr = opts.bitsPerRow || 32;
    root.classList.add('hdr');
    const ruler = el('div', 'hdr-ruler'); ruler.style.gridTemplateColumns = `repeat(${bpr / 8}, 1fr)`;
    for (let i = 0; i < bpr; i += 8) ruler.appendChild(el('span', '', `${i} – ${i + 7}`));
    const grid = el('div', 'hdr-grid'); grid.style.gridTemplateColumns = `repeat(${bpr}, minmax(0,1fr))`;
    const desc = el('div', 'hdr-desc', '<span class="small">필드를 클릭하면 설명이 표시됩니다.</span>');
    let pos = 0; const cells = [];
    opts.fields.forEach((f, i) => {
      let rem = f.variable ? (bpr - pos % bpr) : f.bits; let first = true;
      while (rem > 0) {
        const col = pos % bpr, span = Math.min(rem, bpr - col);
        const c = el('div', 'hdr-field ' + (f.cls || '') + (f.variable ? ' variable' : ''));
        c.style.gridColumn = `span ${span}`;
        c.innerHTML = (first ? f.name : `${f.name} (계속)`) + `<small>${f.variable ? '가변' : f.bits + ' bit'}</small>`;
        c.dataset.idx = i; c.title = f.name;
        c.addEventListener('click', () => select(i));
        grid.appendChild(c); cells.push(c); pos += span; rem -= span; first = false;
      }
    });
    function select(i) {
      cells.forEach(c => c.classList.toggle('sel', +c.dataset.idx === i));
      const f = opts.fields[i];
      desc.innerHTML = `<span class="name">${f.name}</span><span class="bits">${f.variable ? '가변 길이' : f.bits + ' bit'}</span><div>${f.desc || ''}</div>`;
    }
    root.appendChild(ruler); root.appendChild(grid); root.appendChild(desc);
    if (opts.selected != null) select(opts.selected);
    return { select };
  }

  // ---------- Stepper (단계 애니메이션 컨트롤러) ----------
  // Stepper(animEl, { steps:[{title, text, run(i, instant)}], reset(), autoplayMs })
  function Stepper(animEl, opts) {
    const root = typeof animEl === 'string' ? $(animEl) : animEl;
    const steps = opts.steps; let i = -1; let timer = null;
    const ctrl = el('div', 'controls');
    const bPrev = el('button', 'btn sm', '◀ 이전'), bNext = el('button', 'btn sm primary', '다음 ▶'),
          bPlay = el('button', 'btn sm', '▶▶ 자동 재생'), bReset = el('button', 'btn sm', '↺ 처음');
    const ind = el('span', 'step-ind');
    ctrl.append(bPrev, bNext, bPlay, bReset, ind);
    const cap = el('div', 'caption');
    root.appendChild(ctrl); root.appendChild(cap);
    function render() {
      ind.textContent = `${Math.max(i + 1, 0)} / ${steps.length}`;
      bPrev.disabled = i < 0; bNext.disabled = i >= steps.length - 1;
      if (i < 0) cap.innerHTML = `<b>준비</b> — ${opts.intro || '「다음 ▶」을 눌러 단계별로 진행하세요.'}`;
      else cap.innerHTML = `<b>${i + 1}. ${steps[i].title}</b><div>${steps[i].text || ''}</div>`;
    }
    function reset(instant) { stop(); i = -1; opts.reset && opts.reset(); render(); }
    function goto(n) {
      if (n < -1 || n >= steps.length) return;
      if (n < i) { root.classList.add('instant'); opts.reset && opts.reset(); for (let k = 0; k <= n; k++) steps[k].run && steps[k].run(k, true); void root.offsetWidth; root.classList.remove('instant'); }
      else { for (let k = i + 1; k <= n; k++) steps[k].run && steps[k].run(k, false); }
      i = n; render();
    }
    function next() { if (i < steps.length - 1) goto(i + 1); else stop(); }
    function stop() { if (timer) { clearInterval(timer); timer = null; bPlay.textContent = '▶▶ 자동 재생'; } }
    function play() { if (timer) return stop(); if (i >= steps.length - 1) reset(); bPlay.textContent = '⏸ 일시정지'; next(); timer = setInterval(() => { if (i >= steps.length - 1) stop(); else next(); }, opts.autoplayMs || 1800); }
    bPrev.onclick = () => { stop(); goto(i - 1); };
    bNext.onclick = () => { stop(); next(); };
    bPlay.onclick = play; bReset.onclick = () => reset();
    reset();
    return { next, goto, reset, play, stop, get index() { return i; } };
  }

  // ---------- Quiz ----------
  // Quiz(container, [{q, options:[], answer:0, explain}])
  function Quiz(container, questions) {
    const root = typeof container === 'string' ? $(container) : container;
    root.classList.add('quiz');
    const name = 'quiz-' + Math.random().toString(36).slice(2, 8);
    questions.forEach((q, qi) => {
      const box = el('div', 'q');
      box.innerHTML = `<div class="qt"><span class="qn">Q${qi + 1}.</span>${q.q}</div>`;
      q.options.forEach((o, oi) => {
        const lab = el('label', 'opt'); lab.innerHTML = `<input type="radio" name="${name}-${qi}" value="${oi}"><span>${o}</span>`;
        if (oi === q.answer) lab.classList.add('answer');
        box.appendChild(lab);
      });
      box.appendChild(el('div', 'explain', `<b>해설.</b> ${q.explain || ''}`));
      root.appendChild(box);
    });
    const bar = el('div', 'row'); const grade = el('button', 'btn primary', '채점하기'); const retry = el('button', 'btn', '다시 풀기');
    bar.append(grade, retry); root.appendChild(bar);
    const res = el('div', 'result'); root.appendChild(res);
    grade.onclick = () => {
      let score = 0;
      $$('.q', root).forEach((box, qi) => {
        const sel = $('input:checked', box); box.classList.remove('correct', 'wrong');
        $$('.opt', box).forEach(o => o.classList.remove('chosen'));
        box.classList.add('graded');
        if (sel) { sel.closest('.opt').classList.add('chosen'); if (+sel.value === questions[qi].answer) { score++; box.classList.add('correct'); } else box.classList.add('wrong'); }
        else box.classList.add('wrong');
      });
      const pct = Math.round(score / questions.length * 100);
      res.textContent = `결과: ${score} / ${questions.length} (${pct}%) ` + (pct === 100 ? '— 완벽합니다!' : pct >= 70 ? '— 잘했습니다. 틀린 문제의 해설을 확인하세요.' : '— 본문을 다시 읽고 재도전하세요.');
      res.classList.add('show'); res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    retry.onclick = () => { $$('.q', root).forEach(b => { b.classList.remove('graded', 'correct', 'wrong'); $$('input', b).forEach(i => i.checked = false); }); res.classList.remove('show'); };
  }

  // ---------- code copy ----------
  function initCopy() {
    $$('pre').forEach(p => {
      if (p.dataset.nocopy) return;
      p.style.position = 'relative';
      const b = el('button', 'btn sm', '복사'); b.style.cssText = 'position:absolute;top:6px;right:6px;opacity:.7';
      b.onclick = () => { navigator.clipboard?.writeText(p.innerText.replace(/^복사\n?/, '')); b.textContent = '복사됨'; setTimeout(() => b.textContent = '복사', 1200); };
      p.appendChild(b);
    });
  }

  // ---------- helpers for IP math (여러 장에서 재사용) ----------
  const IP = {
    parse(s) { const p = s.trim().split('.'); if (p.length !== 4) return null; let n = 0; for (const x of p) { if (!/^\d{1,3}$/.test(x) || +x > 255) return null; n = (n * 256) + (+x); } return n >>> 0; },
    str(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); },
    bin(n) { return (n >>> 0).toString(2).padStart(32, '0'); },
    mask(p) { return p === 0 ? 0 : ((0xFFFFFFFF << (32 - p)) >>> 0); },
  };

  // ---------- init ----------
  document.addEventListener('DOMContentLoaded', () => {
    buildSidebar(); buildTOC(); buildChapterNav(); initTabs(); initCopy();
  });

  window.TCPIP = { COURSE, ALL, $, $$, el, svg, sleep, fmtNum, store, Progress, HeaderDiagram, Stepper, Quiz, initTabs, IP, toggleTheme };
})();
