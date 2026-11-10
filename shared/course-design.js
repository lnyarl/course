/* Shared course chrome. Learning state and experiments remain owned by each course. */
(() => {
  const root = document.documentElement;
  const base = new URL('../', document.currentScript.src);
  const syntaxStyle=document.createElement('link');
  syntaxStyle.rel='stylesheet';syntaxStyle.href=new URL('shared/course-syntax.css',base).href;
  const syntaxScript=document.createElement('script');
  syntaxScript.src=new URL('shared/course-syntax.js',base).href;
  document.head.append(syntaxStyle,syntaxScript);

  const path = decodeURIComponent(location.pathname);
  const course = path.match(/([^/]+)-course(?:\/|$)/)?.[1] || (path.includes('CSharp_GC_') ? 'gc' : 'library');
  root.dataset.course = course;
  const courseTitles = {"aspnet-core": "ASP.NET Core 구조와 동작", "network-web": "웹 네트워크", "concurrency": "C# 동시성과 비동기", "os-memory": "운영체제 메모리 관리", "windows-kernel": "Windows 커널", "linux-kernel": "리눅스 커널", "tcpip": "TCP/IP", "nodejs-advanced": "Node.js", "gc": "C# 가비지 컬렉션", "container-runtime": "Rust 컨테이너 런타임 구현", "distributed-queue": "C# 메시지 큐 구현", "database": "Rust 데이터베이스 구현", "category-theory": "C# 범주론", "utility-ai": "효용 기반 AI"};
  const light = () => { if (root.dataset.theme !== 'light') root.dataset.theme = 'light'; };
  light();
  new MutationObserver(light).observe(root, {attributes: true, attributeFilter: ['data-theme']});
  const classic = ['os-memory','container-runtime','database','nodejs-advanced','category-theory','utility-ai'].includes(course);
  if (classic) root.dataset.layout = 'classic';
  const emoji = /[\u{1F000}-\u{1FAFF}\u2600-\u2604\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF]|[\uFE0F\u20E3]/gu;
  function clean(node) {
    if (node.nodeType === 3) {
      if (!node.parentElement?.closest('script,style,pre,code,textarea,[contenteditable]')) {
        const text = node.data.replace(emoji, '');
        if (text !== node.data) node.data = text;
      }
      return;
    }
    if (node.nodeType !== 1 || node.matches('script,style,pre,code,textarea')) return;
    for (const child of node.childNodes) clean(child);
  }
  function start() {
    if (document.getElementById('course-chrome')) return;
    const bar = document.createElement('div');
    bar.id = 'course-chrome';
    const home = document.createElement('a');
    home.href = new URL('index.html', base).href;
    home.className = 'design-brand';
    home.innerHTML = '<span class="design-mark" aria-hidden="true">CL</span><span>COURSE LIBRARY</span>';
    bar.append(home);
    if (course !== 'library') {
      const back = document.createElement('a');
      back.className = 'design-course-link';
      back.href = course === 'gc' ? '#toc' : 'index.html';
      back.textContent = '코스 목차';
      bar.append(back);
      document.body.prepend(bar);
    }
    if (course === 'concurrency' || course === 'windows-kernel') {
      const legacy=document.querySelector('body > .topbar');
      const actions=legacy?.querySelector(course === 'concurrency' ? '.top-actions' : '.prog');
      if(actions)bar.append(actions);
      legacy?.remove();
    }
    if (classic && window.MM?.CHAPTERS) {
      const sidebar = document.createElement('aside');
      sidebar.className = 'design-sidebar'; sidebar.id = 'design-contents';
      const label = document.createElement('a'); label.className = 'design-course-title'; label.href = 'index.html';
      label.textContent = document.querySelector('.topbar .home')?.textContent.trim() || '학습 목차';
      sidebar.append(label);
      const nav = document.createElement('nav'); nav.setAttribute('aria-label','장별 목차');
      for (const chapter of MM.CHAPTERS) {
        const link = document.createElement('a'); link.href = chapter.file;
        const number = document.createElement('span'); number.textContent = chapter.id;
        const title = document.createElement('span'); title.textContent = chapter.title;
        link.append(number,title);
        if (path.endsWith('/' + chapter.file)) link.setAttribute('aria-current','page');
        nav.append(link);
      }
      sidebar.append(nav); bar.after(sidebar);
      const menu = document.createElement('button'); menu.type = 'button'; menu.className = 'design-menu';
      menu.textContent = '목차'; menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-controls',sidebar.id);
      menu.onclick = () => { const open = sidebar.classList.toggle('is-open'); menu.setAttribute('aria-expanded',String(open)); };
      bar.append(menu);
      sidebar.addEventListener('keydown', event => {if(event.key === 'Escape'){sidebar.classList.remove('is-open');menu.setAttribute('aria-expanded','false');menu.focus();}});
    }
    const sidebar=document.querySelector('.design-sidebar, .shell > .sidebar, .layout > .sidebar, .layout > #sidebar, .layout > aside, body > .sidebar, .wrap > nav.toc');
    if(sidebar && course!=='library') {
      sidebar.classList.add('design-course-menu');sidebar.id ||= 'design-course-menu';
      const title=document.createElement('a');title.className='design-course-menu-title';
      const oldTitle=sidebar.querySelector('.design-course-title,.course-name,.brand,.home');
      const titleCopy=oldTitle?.cloneNode(true);
      titleCopy?.querySelectorAll('br').forEach(br=>br.replaceWith(' '));
      titleCopy?.querySelectorAll('.logo,.brand-mark').forEach(mark=>mark.remove());
      title.textContent=courseTitles[course]||(titleCopy?.textContent||document.title).replace(/\s+/g,' ').trim();
      title.href=course==='gc'?'#toc':'index.html';sidebar.prepend(title);
      function decorateMenu(){
        if(!sidebar.contains(title)) {
          const brand=sidebar.querySelector('.brand');
          if(brand){const copy=brand.cloneNode(true);copy.querySelectorAll('.logo,.brand-mark').forEach(mark=>mark.remove());title.textContent=courseTitles[course]||copy.textContent.replace(/\s+/g,' ').trim();}
          sidebar.prepend(title);
        }

        for(const link of sidebar.querySelectorAll('nav a,ol a,a.nav-item,a.ch'))link.classList.add('design-course-menu-item');
        for(const label of sidebar.querySelectorAll('.part,.group-title,.nav-group-title,.lbl'))label.classList.add('design-course-menu-group');
      }
      decorateMenu();
      new MutationObserver(decorateMenu).observe(sidebar,{childList:true,subtree:true});
      let toggle=bar.querySelector('.design-menu');
      if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.className='design-menu';toggle.textContent='목차';bar.append(toggle);}
      toggle.setAttribute('aria-controls',sidebar.id);toggle.setAttribute('aria-expanded','false');
      const close=()=>{sidebar.classList.remove('design-course-menu-open');toggle.setAttribute('aria-expanded','false');};
      toggle.onclick=()=>{const open=sidebar.classList.toggle('design-course-menu-open');toggle.setAttribute('aria-expanded',String(open));};
      sidebar.addEventListener('click',event=>{if(event.target.closest('a')&&innerWidth<=900)close();});
      document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sidebar.classList.contains('design-course-menu-open')){close();toggle.focus();}});
    }
    clean(document.body);
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') clean(record.target);
        for (const node of record.addedNodes) clean(node);
      }
    }).observe(document.body, {childList:true,subtree:true,characterData:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
