/* Standalone local annotations. Configuration: shared/README.md. No dependencies. */
(() => {
  'use strict';
  const script = document.currentScript;
  const options = {...script.dataset};
  const base = new URL('../', script.src);
  function mount() {
  if (document.getElementById('course-comments')) return;
  const content = document.querySelector(options.root || 'body');
  if (!content) { console.error('Local comments: data-root did not match an element.'); return; }
  const page = options.pageId || decodeURI(location.pathname).replace(/index\.html$/, '').replace(/\/$/, '');
  // Keep the original keys when configuration is omitted: existing notes stay readable.
  const namespace = options.namespace
    ? 'local-comments:v1:' + encodeURIComponent(options.namespace) + ':'
    : 'course-comments:v1:' + decodeURI(base.pathname) + ':';
  const reserveSpace = options.layout !== 'overlay';
  const host = document.createElement('div');
  host.id = 'course-comments';
  document.body.append(host);
  const ui = host.attachShadow({mode: 'open'});
  ui.innerHTML = `<style>
    :host{all:initial;color-scheme:light;font:14px/1.6 system-ui,sans-serif;color:#20242c;position:relative;z-index:2147483000}
    *{box-sizing:border-box} [hidden]{display:none!important}
    button,textarea{font:inherit}button{cursor:pointer;border:1px solid #d4d7dd;border-radius:8px;background:#fff;color:#20242c;padding:7px 11px}button:hover{background:#f2f3f5}button:focus-visible,textarea:focus-visible{outline:3px solid #175cd3;outline-offset:2px}
    #toggle{position:fixed;right:20px;bottom:20px;box-shadow:0 3px 18px #0002;font-weight:650}
    #add{position:fixed;background:#175cd3;color:white;border:0;box-shadow:0 3px 16px #0003}
    aside{position:fixed;right:0;top:0;width:340px;height:100dvh;background:#fff;border-left:1px solid #d4d7dd;box-shadow:-4px 0 22px #0001;display:flex;flex-direction:column;padding:20px;gap:14px}
    header{display:flex;align-items:center;justify-content:space-between}h2{font-size:18px;margin:0}p{margin:0}.hint{font-size:12px;color:#606773}#list{overflow:auto;flex:1;min-height:0}article{background:white;border:1px solid #d4d7dd;border-radius:12px;padding:14px;margin-bottom:12px;overflow-wrap:anywhere}blockquote{margin:0 0 10px;padding-left:10px;border-left:3px solid #175cd3;color:#606773;font-size:12px;max-height:110px;overflow:auto;white-space:pre-wrap}.body{white-space:pre-wrap;margin:10px 0}.actions{display:flex;gap:6px;flex-wrap:wrap}.actions button{font-size:12px}time{font-size:11px;color:#606773}textarea{display:block;resize:vertical;width:100%;min-height:110px;max-height:30vh;border:1px solid #b6bcc6;border-radius:8px;padding:10px;background:white;color:#20242c;margin:8px 0}#editor{overflow:auto;max-height:65vh;flex-shrink:0}#quote{max-height:90px}#status{font-size:12px;color:#175cd3}#export{font-size:12px}.primary{background:#175cd3;color:white}footer{display:grid;gap:8px}.missing{color:#8a3b12;font-size:12px}
    @media(max-width:700px){aside{width:min(340px,100vw)}#toggle{right:12px;bottom:12px}}
    @media print{:host{display:none}}
  </style>
  <button id="toggle" aria-expanded="false" aria-controls="panel">코멘트 <span id="count">0</span></button>
  <button id="add" hidden>＋ 코멘트</button>
  <aside id="panel" aria-label="문서 코멘트" hidden>
    <header><h2>내 코멘트 <span id="total"></span></h2><button id="close" aria-label="코멘트 닫기">✕</button></header>
    <p class="hint">본문을 드래그하거나 세 번 클릭해 선택한 뒤 ‘＋ 코멘트’를 누르세요. 키보드로 선택한 뒤에도 추가할 수 있습니다.</p>
    <form id="editor" hidden><blockquote id="quote"></blockquote><label for="note">코멘트</label><textarea id="note" maxlength="10000" placeholder="궁금한 점이나 생각을 남기세요." required></textarea><div class="actions"><button class="primary" type="submit">저장</button><button type="button" id="cancel">취소</button></div></form>
    <p id="status" role="status" aria-live="polite"></p><div id="list"></div>
    <footer><button id="export">모든 코멘트 내보내기 (JSON)</button><p class="hint">이 브라우저에만 저장됩니다. 브라우저 데이터 삭제 시 사라지므로 파일로 보관하세요.</p></footer>
  </aside>`;
  const $ = id => ui.getElementById(id);
  if (options.title) ui.querySelector('h2').firstChild.textContent = options.title + ' ';
  const style = document.createElement('style');
  style.textContent = '::highlight(course-notes){background:#175cd3;color:#fff} @media(min-width:1100px){html.course-notes-open{padding-right:340px!important;box-sizing:border-box}}';
  document.head.append(style);
  let pending = null, editing = null, records = [], refreshTimer;
  const status = text => { $('status').textContent = text; };
  function readAll() {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith(namespace)) continue;
      const item = JSON.parse(localStorage.getItem(key));
      if (item?.version !== 1 || typeof item.id !== 'string' || typeof item.page !== 'string' || typeof item.text !== 'string' || typeof item.quote !== 'string' || !item.anchor || typeof item.anchor.start !== 'number') throw Error('Invalid annotation');
      result.push(item);
    }
    return result.sort((a,b) => a.createdAt.localeCompare(b.createdAt));
  }
  function textIndex() {
    const nodes = []; let text = '';
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {acceptNode(node) {
      return node.parentElement.closest('script,style,noscript,textarea,input,select,button,svg,canvas,[contenteditable],#course-comments,[hidden]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }});
    while (walker.nextNode()) { const node = walker.currentNode; nodes.push({node,start:text.length}); text += node.textContent; }
    return {nodes,text};
  }
  function resolve(item, index) {
    const {text,nodes} = index; let start = item.anchor.start;
    if (text.slice(start,start + item.quote.length) !== item.quote) {
      const candidates = []; let at = text.indexOf(item.quote);
      while (at !== -1) { candidates.push(at); at = text.indexOf(item.quote,at + 1); }
      const matching = candidates.filter(i => (!item.anchor.before || text.slice(Math.max(0,i-32),i) === item.anchor.before) && (!item.anchor.after || text.slice(i+item.quote.length,i+item.quote.length+32) === item.anchor.after));
      start = matching.length === 1 ? matching[0] : candidates.length === 1 ? candidates[0] : -1;
    }
    if (start < 0) return null;
    const first = nodes.find(n => n.start + n.node.length > start);
    const end = start + item.quote.length;
    const last = nodes.find(n => n.start < end && n.start + n.node.length >= end);
    if (!first || !last) return null;
    const range = document.createRange();range.setStart(first.node,start-first.start);range.setEnd(last.node,end-last.start);return range;
  }
  function highlight() {
    if (!globalThis.CSS?.highlights || !globalThis.Highlight) return;
    const index = textIndex();
    CSS.highlights.set('course-notes',new Highlight(...records.map(r => resolve(r,index)).filter(Boolean)));
  }
  function open() { $('panel').hidden = false; $('toggle').hidden = true; $('toggle').setAttribute('aria-expanded','true');if(reserveSpace) document.documentElement.classList.add('course-notes-open'); }
  function cancel() { pending = null;editing = null;$('editor').hidden = true;$('note').value = ''; }
  function close() { if (!$('editor').hidden && $('note').value.trim() && !confirm('저장하지 않은 코멘트를 닫을까요?')) return;cancel();$('panel').hidden = true;$('toggle').hidden = false;$('toggle').setAttribute('aria-expanded','false');document.documentElement.classList.remove('course-notes-open');$('toggle').focus(); }
  function button(label,fn) { const el = document.createElement('button');el.type='button';el.textContent=label;el.addEventListener('click',fn);return el; }
  function render() {
    try { records = readAll().filter(r => r.page === page); } catch { status('저장소를 읽을 수 없습니다. 브라우저 저장 설정이나 저장 데이터를 확인하세요.');return; }
    $('count').textContent = records.length;$('total').textContent = records.length;$('list').replaceChildren();
    if (!records.length) { const empty = document.createElement('p');empty.className='hint';empty.textContent='아직 이 페이지에 남긴 코멘트가 없습니다.';$('list').append(empty); }
    for (const item of records) {
      const card = document.createElement('article');const quote = document.createElement('blockquote');quote.textContent=item.quote;
      const body = document.createElement('p');body.className='body';body.textContent=item.text;
      const time = document.createElement('time');time.textContent=new Date(item.updatedAt).toLocaleString('ko-KR');
      const actions = document.createElement('div');actions.className='actions';
      actions.append(button('원문 보기',() => {
        if (item.hash && location.hash !== item.hash) location.hash = item.hash;
        setTimeout(() => { const range = resolve(item,textIndex());if (!range) { status('원문 위치를 찾지 못했습니다. 저장된 인용문은 유지됩니다.');return; } const el=range.startContainer.parentElement;el.scrollIntoView({block:'center',behavior:'smooth'});highlight();if(innerWidth<1100 && $('editor').hidden) close(); },150);
      }),button('수정',() => begin(item)),button('삭제',() => {
        if (!confirm('이 코멘트를 삭제할까요?')) return;
        try {localStorage.removeItem(namespace+item.id);if(editing===item.id)cancel();render();status('삭제했습니다.');}catch{status('삭제하지 못했습니다. 다시 시도하세요.');}
      }));card.append(quote,body,time,actions);$('list').append(card);
    }
    highlight();
  }
  function begin(item) {
    if (!$('editor').hidden && $('note').value.trim() && !confirm('작성 중인 내용을 버리고 다른 코멘트를 열까요?')) return;
    pending=item;editing=item.id || null;open();$('quote').textContent=item.quote;$('note').value=item.text || '';$('editor').hidden=false;$('add').hidden=true;$('note').focus();
  }
  function selection() {
    const selected = getSelection();
    if (!selected || selected.isCollapsed || !selected.rangeCount) { $('add').hidden=true;return; }
    const range = selected.getRangeAt(0);const index=textIndex();
    // Selection boundaries can be elements (triple click / selectNodeContents),
    // whose offsets count child nodes, not characters. Clip to indexed text first.
    const parts=index.nodes.filter(({node})=>node.length && range.intersectsNode(node)).map(({node,start})=>({
      start:start+(node===range.startContainer ? range.startOffset : 0),
      end:start+(node===range.endContainer ? range.endOffset : node.length)
    })).filter(part=>part.end>part.start);
    if (!parts.length) { $('add').hidden=true;return; }
    const start=parts[0].start,end=parts[parts.length-1].end,quote=index.text.slice(start,end);
    if (!quote.trim()) { $('add').hidden=true;return; }
    const anchor={start,before:index.text.slice(Math.max(0,start-32),start),after:index.text.slice(end,end+32)};
    $('add')._selection={quote,anchor,hash:location.hash};
    const rect=range.getBoundingClientRect();$('add').style.left=Math.max(8,Math.min(innerWidth-140,rect.right-100))+'px';$('add').style.top=Math.max(8,Math.min(innerHeight-50,rect.bottom+8))+'px';$('add').hidden=false;
  }
  document.addEventListener('selectionchange',selection);
  $('add').addEventListener('pointerdown',event=>event.preventDefault());
  $('add').onclick=()=>begin($('add')._selection);
  $('toggle').onclick=()=>{open();render();$('close').focus();};$('close').onclick=close;$('cancel').onclick=cancel;
  $('editor').onsubmit=event=>{
    event.preventDefault();const text=$('note').value.trim();if(!text || !pending)return;
    const now=new Date().toISOString();const item={...pending,version:1,id:editing || crypto.randomUUID(),page,url:location.href,title:document.title,text,createdAt:pending.createdAt || now,updatedAt:now};
    try {localStorage.setItem(namespace+item.id,JSON.stringify(item));cancel();render();status('이 브라우저에 저장했습니다.');}catch{status('저장하지 못했습니다. 저장 공간·브라우저 설정을 확인하세요. 입력 내용은 유지됩니다.');}
  };
  $('export').onclick=()=>{
    try {const items=readAll();const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),comments:items},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='course-comments-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status(items.length+'개 코멘트를 내보냈습니다.');}catch{status('코멘트를 읽지 못해 내보내지 못했습니다.');}
  };
  ui.addEventListener('keydown',event=>{if(event.key==='Escape')close();if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!$('editor').hidden){event.preventDefault();$('editor').requestSubmit();}});
  window.addEventListener('storage',event=>{if(!event.key||event.key.startsWith(namespace))render();});
  window.addEventListener('beforeunload',event=>{if(!$('editor').hidden && $('note').value.trim()){event.preventDefault();event.returnValue='';}});
  new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(highlight,250);}).observe(content,{childList:true,subtree:true});
  render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
