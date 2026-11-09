/* Offline AST inspector. The original AST stays unchanged; collapse only changes visibility. */
(function () {
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const shorten=(s,n=48)=>s.length>n?s.slice(0,n-1)+'…':s;
  function valueText(n){if(!n)return '';if(n.type==='column')return n.name;if(n.type==='null')return 'NULL';return n.type==='text'?JSON.stringify(n.value):String(n.value);}
  function model(raw,path='root',edge='AST'){
    function leaf(key,title,summary,data){return {path:path+'.'+key,edge:key,title,summary,data,children:[],compact:false};}
    const n={path,edge,title:'',summary:'',data:raw,children:[],compact:false};
    const add=(child,key)=>n.children.push(model(child,path+'.'+key,key));
    switch(raw.type){
      case 'select':
        n.title='SELECT';n.summary='FROM '+raw.table;
        n.children.push(leaf('table','FROM',raw.table,{table:raw.table}));
        n.children.push(leaf('columns','열 선택',raw.columns?raw.columns.join(', '):'* (전체 열)',{columns:raw.columns}));
        if(raw.filter)add(raw.filter,'filter');
        if(raw.order.length)n.children.push(leaf('order','ORDER BY',raw.order.map(o=>o.column+(o.descending?' DESC':' ASC')).join(', '),{order:raw.order}));
        if(raw.limit!==null)n.children.push(leaf('limit','LIMIT',raw.limit,{limit:raw.limit}));break;
      case 'insert':
        n.title='INSERT';n.summary='INTO '+raw.table;
        n.children.push(leaf('table','INTO',raw.table,{table:raw.table}));
        n.children.push(leaf('columns','입력 열',raw.columns?raw.columns.join(', '):'테이블에 정의된 열 순서',{columns:raw.columns}));
        raw.values.forEach((v,i)=>add(v,'values['+i+']'));break;
      case 'create':
        n.title='CREATE TABLE';n.summary=raw.table;
        n.children.push(leaf('table','TABLE',raw.table,{table:raw.table}));
        raw.columns.forEach((c,i)=>n.children.push(leaf('columns['+i+']',c.name,c.data_type.toUpperCase()+(c.nullable?' · NULL 허용':' · NOT NULL'),c)));break;
      case 'and':case 'or':n.title=raw.type.toUpperCase();n.summary='두 조건 결합';add(raw.left,'left');add(raw.right,'right');break;
      case 'not':n.title='NOT';n.summary='조건 부정';add(raw.value,'value');break;
      case 'compare':n.title='비교 '+raw.op;n.summary=valueText(raw.left)+' '+raw.op+' '+valueText(raw.right);n.compact=true;add(raw.left,'left');add(raw.right,'right');break;
      case 'is_null':n.title=raw.negated?'IS NOT NULL':'IS NULL';n.summary=valueText(raw.value);n.compact=true;add(raw.value,'value');break;
      case 'column':n.title='열';n.summary=raw.name;break;
      case 'text':n.title='문자열';n.summary=JSON.stringify(raw.value);break;
      case 'int':n.title='정수 i64';n.summary=String(raw.value);break;
      case 'null':n.title='NULL';n.summary='값 없음';break;
      default:n.title=String(raw.type||'노드');n.summary=JSON.stringify(raw);
    }
    return n;
  }
  class ASTViewer{
    constructor(svg){
      this.svg=svg;this.host=svg.parentElement;this.host.className='ast-viewer';
      this.mode='outline';this.expanded=new Set();this.selected='root';this.autoFit=true;this.camera={scale:1,x:0,y:0};this.nodes=new Map();
      this.host.innerHTML='';
      this.toolbar=document.createElement('div');this.toolbar.className='av-toolbar';this.toolbar.setAttribute('aria-label','AST 보기 제어');
      this.toolbar.innerHTML='<button type="button" class="btn" data-av-action="outline">트리 목록</button><button type="button" class="btn" data-av-action="diagram">도식</button><button type="button" class="btn" data-av-action="expand">모두 펼치기</button><button type="button" class="btn" data-av-action="collapse">접기</button><button type="button" class="btn" data-av-action="fit" data-av-zoom>전체 맞춤</button><button type="button" class="btn" data-av-action="out" data-av-zoom aria-label="AST 축소">−</button><button type="button" class="btn" data-av-action="in" data-av-zoom aria-label="AST 확대">+</button><button type="button" class="btn" data-av-action="actual" data-av-zoom>100%</button><span class="av-status" aria-live="polite"></span>';
      this.body=document.createElement('div');this.body.className='av-body';this.main=document.createElement('div');this.main.className='av-main';
      this.outline=document.createElement('div');this.outline.className='av-outline';this.outline.setAttribute('role','tree');this.outline.setAttribute('aria-label','펼쳐 보는 AST');
      this.viewport=document.createElement('div');this.viewport.className='av-diagram';this.viewport.hidden=true;this.svg.removeAttribute('style');this.viewport.append(svg);
      this.inspector=document.createElement('aside');this.inspector.className='av-inspector';this.inspector.setAttribute('aria-label','선택한 AST 노드 상세');
      this.inspector.innerHTML='<h4>노드 상세</h4><p class="av-path"></p><p class="av-value"></p><button type="button" class="btn" data-av-toggle-detail>하위 노드 펼치기</button><pre data-language="json"></pre>';
      this.help=document.createElement('p');this.help.className='av-help';this.help.textContent='노드를 선택하면 잘리지 않은 값과 원래 AST를 확인합니다. 화살표 키로 이동·펼치기가 가능합니다.';
      this.main.append(this.outline,this.viewport);this.body.append(this.main,this.inspector);this.host.append(this.toolbar,this.body,this.help);
      this.toolbar.onclick=e=>{const a=e.target.closest('[data-av-action]')?.dataset.avAction;if(!a)return;
        if(a==='outline'||a==='diagram'){this.mode=a;this.render();}
        else if(a==='expand'){for(const [path,n]of this.nodes)if(n.children.length)this.expanded.add(path);this.autoFit=true;this.render();}
        else if(a==='collapse'){this.expanded=new Set(this.root?['root']:[]);this.selected='root';this.autoFit=true;this.render();}
        else if(a==='fit'){this.autoFit=true;this.renderDiagram();}
        else if(a==='actual'){this.autoFit=false;this.centerAt(1);}
        else this.zoom(a==='in'?1.25:1/1.25);
      };
      this.inspector.querySelector('[data-av-toggle-detail]').onclick=()=>this.toggle(this.selected);
      this.outline.onclick=e=>{const row=e.target.closest('[data-av-path]');if(!row)return;this.selected=row.dataset.avPath;if(e.target.closest('.av-toggle'))this.toggle(this.selected);else this.render(true);};
      this.outline.onkeydown=e=>{
        const rows=[...this.outline.querySelectorAll('[data-av-path]')],at=rows.findIndex(r=>r.dataset.avPath===this.selected),n=this.nodes.get(this.selected);if(!n)return;
        if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Enter',' '].includes(e.key))e.preventDefault();
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){const row=rows[Math.max(0,Math.min(rows.length-1,at+(e.key==='ArrowDown'?1:-1)))];if(row){this.selected=row.dataset.avPath;this.render(true);}}
        else if(e.key==='ArrowRight'&&n.children.length){this.expanded.add(n.path);this.render(true);}
        else if(e.key==='ArrowLeft'){if(this.expanded.has(n.path)&&n.children.length)this.expanded.delete(n.path);else this.selected=n.parent||'root';this.render(true);}
        else if(e.key==='Enter'||e.key===' ')this.toggle(n.path);
      };
      svg.onclick=e=>{const g=e.target.closest('[data-av-node]');if(g){this.selected=g.dataset.avNode;this.render();}};
      svg.onkeydown=e=>{const g=e.target.closest('[data-av-node]');if(g&&(e.key==='Enter'||e.key===' ')){e.preventDefault();this.selected=g.dataset.avNode;this.render();}};
      this.viewport.onpointerdown=e=>{if(e.target.closest('[data-av-node]')||e.button!==0)return;this.autoFit=false;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:this.camera.x,cy:this.camera.y};this.viewport.setPointerCapture(e.pointerId);this.viewport.classList.add('is-panning');};
      this.viewport.onpointermove=e=>{if(!this.drag||this.drag.id!==e.pointerId)return;this.camera.x=this.drag.cx+e.clientX-this.drag.x;this.camera.y=this.drag.cy+e.clientY-this.drag.y;this.transform();};
      const release=()=>{this.drag=null;this.viewport.classList.remove('is-panning');};this.viewport.onpointerup=release;this.viewport.onpointercancel=release;this.viewport.onlostpointercapture=release;
      this.viewport.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();this.zoom(e.deltaY<0?1.12:1/1.12);},{passive:false});
      this.resize=new ResizeObserver(()=>{if(this.mode==='diagram'&&this.root)this.renderDiagram();});this.resize.observe(this.main);
    }
    setNode(raw){
      const first=!this.root,newType=this.root?.data?.type!==raw?.type;this.nodes.clear();this.root=raw?model(raw):null;
      if(this.root){const visit=(n,parent)=>{n.parent=parent;this.nodes.set(n.path,n);n.children.forEach(c=>visit(c,n.path));};visit(this.root,null);
        if(first||newType){this.expanded.clear();for(const [p,n]of this.nodes)if(n.children.length&&!n.compact)this.expanded.add(p);this.selected='root';this.autoFit=true;}
        if(!this.nodes.has(this.selected))this.selected='root';
      }else{this.selected='root';this.expanded.clear();}
      this.render();
    }
    visible(){const out=[];const walk=(n,depth)=>{out.push({node:n,depth});if(this.expanded.has(n.path))n.children.forEach(c=>walk(c,depth+1));};if(this.root)walk(this.root,0);return out;}
    toggle(path){const n=this.nodes.get(path);if(!n?.children.length)return;if(this.expanded.has(path))this.expanded.delete(path);else this.expanded.add(path);this.autoFit=true;this.render(true);}
    render(focus=false){
      this.outline.hidden=this.mode!=='outline';this.viewport.hidden=this.mode!=='diagram';
      this.toolbar.querySelectorAll('[data-av-action]').forEach(b=>{const view=['outline','diagram'].includes(b.dataset.avAction);if(view)b.setAttribute('aria-pressed',String(this.mode===b.dataset.avAction));b.disabled=!view&&!this.root;});
      this.toolbar.querySelectorAll('[data-av-zoom]').forEach(b=>b.hidden=this.mode!=='diagram');
      this.help.textContent=this.mode==='diagram'?'전체 맞춤으로 도식을 한 화면에 봅니다. 100%로 글자를 읽고 빈 공간을 드래그해 이동하세요. 노드를 선택하면 전체 값을 확인합니다.':'목록을 위아래로 스크롤하고 노드를 선택해 전체 값을 확인하세요. 좌우 화살표로 펼치기·접기, 위아래 화살표로 이동합니다.';
      const rows=this.visible();this.outline.replaceChildren();
      if(!this.root){const p=document.createElement('p');p.className='av-empty';p.textContent='아직 완성한 노드 없음';this.outline.append(p);this.svg.innerHTML='<text x="16" y="35">아직 완성한 노드 없음</text>';}
      for(const {node:n,depth} of rows){
        const row=document.createElement('div');row.className='av-row';row.dataset.avPath=n.path;row.style.setProperty('--depth',Math.min(depth,6));row.tabIndex=n.path===this.selected?0:-1;row.setAttribute('role','treeitem');row.setAttribute('aria-level',depth+1);row.setAttribute('aria-selected',String(n.path===this.selected));if(n.children.length)row.setAttribute('aria-expanded',String(this.expanded.has(n.path)));
        const toggle=document.createElement('button');toggle.type='button';toggle.className='av-toggle';toggle.tabIndex=-1;toggle.disabled=!n.children.length;toggle.textContent=n.children.length?(this.expanded.has(n.path)?'▾':'▸'):'·';toggle.setAttribute('aria-label',n.title+' 하위 '+(this.expanded.has(n.path)?'접기':'펼치기'));
        const copy=document.createElement('span');copy.className='av-node-copy';const edge=document.createElement('span');edge.className='av-edge';edge.textContent=n.edge;const title=document.createElement('span');title.className='av-title';title.textContent=n.title;const summary=document.createElement('span');summary.className='av-summary';summary.textContent=shorten(n.summary,85);copy.append(edge,title,summary);row.append(toggle,copy);this.outline.append(row);
      }
      this.renderDiagram();this.details();this.status();
      if(focus&&this.mode==='outline'){const row=[...this.outline.children].find(e=>e.dataset.avPath===this.selected);row?.focus({preventScroll:true});row?.scrollIntoView({block:'nearest'});}
    }
    details(){
      const n=this.nodes.get(this.selected),pre=this.inspector.querySelector('pre'),toggle=this.inspector.querySelector('button');
      this.inspector.querySelector('h4').textContent=n?n.title:'노드 상세';this.inspector.querySelector('.av-path').textContent=n?n.path:'노드를 선택하세요.';
      this.inspector.querySelector('.av-value').textContent=n?n.summary:'';toggle.hidden=!n?.children.length;toggle.textContent=this.expanded.has(n?.path)?'하위 노드 접기':'하위 노드 펼치기';pre.textContent=n?JSON.stringify(n.data,null,2):'';if(window.CourseSyntax)CourseSyntax.highlight(pre,'json');
    }
    renderDiagram(){
      if(!this.root)return;
      const positions=new Map();let leaf=0,maxDepth=0;
      const place=(n,depth)=>{const children=this.expanded.has(n.path)?n.children:[];const placed=children.map(c=>place(c,depth+1));const y=placed.length?(placed[0].y+placed.at(-1).y)/2:leaf++*86+45;const p={node:n,x:depth*235+25,y};positions.set(n.path,p);maxDepth=Math.max(maxDepth,depth);return p;};place(this.root,0);
      this.positions=positions;this.bounds={width:maxDepth*235+260,height:Math.max(110,leaf*86+24)};
      const links=[];for(const p of positions.values())if(p.node.parent&&positions.has(p.node.parent)){const a=positions.get(p.node.parent),x=a.x+185,mid=(x+p.x)/2;links.push(`<path class="av-link" d="M${x} ${a.y}H${mid}V${p.y}H${p.x}"/><text class="av-link-label" x="${p.x+8}" y="${p.y-35}">${esc(p.node.edge)}</text>`);}
      this.svg.innerHTML='<g class="av-scene">'+links.join('')+[...positions.values()].map(p=>`<g class="av-card${p.node.path===this.selected?' selected':''}" data-av-node="${esc(p.node.path)}" role="button" tabindex="0" aria-label="${esc(p.node.title+' '+p.node.summary)}"><title>${esc(p.node.title+' '+p.node.summary)}</title><rect x="${p.x}" y="${p.y-29}" width="185" height="58" rx="6"/><text x="${p.x+10}" y="${p.y-7}">${esc(shorten(p.node.title,23))}</text><text class="av-subtitle" x="${p.x+10}" y="${p.y+15}">${esc(shorten(p.node.summary,25))}${p.node.children.length&&!this.expanded.has(p.node.path)?' [+]':''}</text></g>`).join('')+'</g>';
      const width=this.main.clientWidth||520,height=this.viewport.clientHeight||450;this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      if(this.autoFit){const scale=Math.min(1,(width-24)/this.bounds.width,(height-24)/this.bounds.height);this.camera={scale,x:(width-this.bounds.width*scale)/2,y:(height-this.bounds.height*scale)/2};}
      this.transform();
    }
    centerAt(scale){if(!this.root||!this.bounds)return;const width=this.main.clientWidth||520,height=this.viewport.clientHeight||450,p=this.positions.get(this.selected)||this.positions.get('root');this.camera={scale,x:width/2-(p.x+92.5)*scale,y:height/2-p.y*scale};this.transform();}
    zoom(factor){this.autoFit=false;const width=this.main.clientWidth||520,height=this.viewport.clientHeight||450,old=this.camera.scale,scale=Math.max(.05,Math.min(3,old*factor));this.camera.x=width/2-(width/2-this.camera.x)*scale/old;this.camera.y=height/2-(height/2-this.camera.y)*scale/old;this.camera.scale=scale;this.transform();}
    transform(){this.svg.querySelector('.av-scene')?.setAttribute('transform',`translate(${this.camera.x} ${this.camera.y}) scale(${this.camera.scale})`);this.status();}
    status(){this.toolbar.querySelector('.av-status').textContent=`표시 ${this.visible().length} / 전체 ${this.nodes.size}노드`+(this.mode==='diagram'?' · '+Math.round(this.camera.scale*100)+'%':'');}
  }
  window.ASTViewer=ASTViewer;
})();
