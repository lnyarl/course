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
