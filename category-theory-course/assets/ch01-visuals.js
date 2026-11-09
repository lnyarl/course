(() => {
'use strict';
const $=id=>document.getElementById(id),esc=MM.esc;
const add=(parent,id,title,body)=>{const el=document.createElement('div');el.className='visual-lab';el.id=id;el.innerHTML=`<h3>${title}</h3>${body}`;$(parent).append(el);return el;};
const fn={add:x=>x+3,double:x=>2*x,square:x=>x*x};
add('composer','composition-motion','합성 순서에 따른 두 계산 경로',`<p>두 경로에 같은 입력을 넣습니다. 다음 단계로 중간값을 확인하고, 마지막 값을 비교하세요.</p><div class="visual-stage" id="composition-cards" tabindex="0" role="region" aria-label="함수 실행 순서별 두 계산 경로"></div><div class="controls"><button class="btn primary" id="motion-play" type="button">재생</button><button class="btn" id="motion-prev" type="button">이전</button><button class="btn" id="motion-next" type="button">다음 단계</button><button class="btn" id="motion-reset" type="button">처음</button></div><div id="motion-caption" aria-live="polite"></div>`);
$('composition-motion').append($('compose-output'));
let step=0,timer=null;
const stop=()=>{clearInterval(timer);timer=null;$('motion-play').textContent='재생';};
const svgText=(x,y,v,cls='')=>`<text x="${x}" y="${y}" text-anchor="middle" class="${cls}">${esc(v)}</text>`;
const svgBox=(x,y,v,cls='node')=>`<rect x="${x}" y="${y}" width="115" height="48" rx="8" class="${cls}"/>`+svgText(x+57.5,y+30,v);
const svgArrow=(x,y,label,id)=>`<path class="edge" d="M${x} ${y}H${x+100}" marker-end="url(#${id})"/>`+svgText(x+50,y-14,label,'small');
const svgStart=(height,id,title)=>`<svg viewBox="0 0 700 ${height}" role="img"><title>${esc(title)}</title><defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--accent)"/></marker></defs>`;
function motion(){
 const x=Number($('compose-x').value),f=fn[$('compose-f').value],g=fn[$('compose-g').value],routes=[[x,f(x),g(f(x))],[x,g(x),f(g(x))]],equal=routes[0][2]===routes[1][2];
 let svg=svgStart(265,'order-arrow','동일 입력의 f 다음 g와 g 다음 f 비교');
 routes.forEach((vals,row)=>{const y=50+row*100;svg+=svgText(105,y-16,row===0?'g ∘ f':'f ∘ g');vals.forEach((v,i)=>{const bx=48+i*230;svg+=svgBox(bx,y,i<=step?v:'?',i===step?'hot':i<step?'done':'node');if(i<2)svg+=svgArrow(bx+120,y+24,row===0?(i===0?'f':'g'):(i===0?'g':'f'),'order-arrow');});});
 svg+=svgText(350,250,step<2?'중간값을 거쳐 두 결과를 비교합니다.':equal?'같은 입력에서 결과 일치 · 함수 전체의 동등성은 별도 확인':'결과 불일치 · 합성 순서가 중요합니다.');$('composition-cards').innerHTML=svg+'</svg>';
 $('compose-output').textContent=step<2?'다음 단계로 진행하기 전에 두 경로의 다음 값을 예측해 보세요.':`g ∘ f = ${routes[0][2]}, f ∘ g = ${routes[1][2]}\n${equal?'이 입력에서는 같은 값입니다. 함수 전체가 같다는 증명은 아닙니다.':'결과가 다르므로 두 합성 함수가 다릅니다.'}`;
 $('motion-caption').textContent=`${step+1} / 3 · ${step===0?'동일 입력을 두 경로에 놓습니다.':step===1?'먼저 적용한 함수가 달라 중간값이 달라질 수 있습니다.':'두 번째 함수를 적용한 최종값을 비교합니다.'}`;$('motion-prev').disabled=step===0;$('motion-next').disabled=step===2;
}
$('motion-play').onclick=()=>{if(timer){stop();return;}if(step===2)step=0;motion();$('motion-play').textContent='일시정지';timer=setInterval(()=>{step++;motion();if(step===2)stop();},matchMedia('(prefers-reduced-motion: reduce)').matches?1800:1100);};
$('motion-prev').onclick=()=>{stop();step=Math.max(0,step-1);motion();};$('motion-next').onclick=()=>{stop();step=Math.min(2,step+1);motion();};$('motion-reset').onclick=()=>{stop();step=0;motion();};
['compose-x','compose-f','compose-g'].forEach(id=>$(id).addEventListener('input',()=>{stop();step=0;motion();}));document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);motion();
add('association','association-map','묶는 쪽이 달라도 값이 지나는 순서는 같습니다',`<div class="visual-stage" id="association-nodes" tabindex="0" role="region" aria-label="결합법칙의 함수 묶음과 실제 호출 순서"></div><p id="association-caption" aria-live="polite"></p>`);
function association(){
 const x=Number($('assoc-x').value),vals=[x,x+1,2*(x+1),(2*(x+1))**2],fg=$('assoc-group').value==='fg';
 let svg=svgStart(225,'assoc-arrow','합성의 묶음은 달라도 호출 순서는 f g h');
 const start=fg?20:200,end=fg?510:690;
 svg+=`<rect x="${start}" y="65" width="${end-start}" height="110" rx="14" class="group-boundary"/>`+svgText((start+end)/2,52,fg?'묶음 k = g ∘ f':'묶음 k = h ∘ g');
 vals.forEach((v,i)=>{const bx=22+i*180;svg+=svgBox(bx,100,v,'node');if(i<3)svg+=`<path class="edge" d="M${bx+120} 124H${bx+173}" marker-end="url(#assoc-arrow)"/>`+svgText(bx+146,91,['f · +1','g · ×2','h · 제곱'][i],'small');});
 svg+=svgText(350,207,'같은 호출 순서 f → g → h · 점선 경계는 미리 묶어 만든 함수');$('association-nodes').innerHTML=svg+'</svg>';
 $('association-caption').textContent=fg?'f와 g를 하나의 함수 k로 만듭니다. k의 출력이 h의 입력입니다.':'g와 h를 하나의 함수 k로 만듭니다. f의 출력이 k의 입력입니다.';
}
['assoc-x','assoc-group'].forEach(id=>$(id).addEventListener('input',association));association();
const defs=id=>`<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--accent)"/></marker></defs>`;
add('type-checker','type-map','타입 접점을 눈으로 확인하기',`<div class="visual-stage" tabindex="0" role="region" aria-label="가로 스크롤 가능한 타입 연결 도식"><svg viewBox="0 0 700 180" role="img" aria-label="두 함수의 정의역과 공역 연결" id="type-live-svg"></svg></div><p>가운데 두 타입이 다르면 연결이 끊깁니다. 작은 화면에서는 좌우로 스크롤하세요.</p>`);
const types={length:['String','Int'],append:['String','String'],even:['Int','Bool'],idString:['String','String'],idInt:['Int','Int'],idBool:['Bool','Bool']};
function typeMap(){const f=types[$('type-f').value],g=types[$('type-g').value],ok=f[1]===g[0];$('type-live-svg').innerHTML=defs('type-live-arrow')+[...f,...g].map((t,i)=>`<rect class="node" x="${20+175*i}" y="65" width="130" height="50" rx="10"/><text x="${85+175*i}" y="96" text-anchor="middle">${esc(t)}</text>`).join('')+`<path class="edge" d="M150 90H192" marker-end="url(#type-live-arrow)"/><path class="edge ${ok?'':'missing'}" d="M325 90H367"/><path class="edge" d="M500 90H542" marker-end="url(#type-live-arrow)"/><text x="175" y="45" text-anchor="middle">f</text><text x="525" y="45" text-anchor="middle">g</text><text x="350" y="150" text-anchor="middle">${ok?'접점 일치 · 합성 가능':'접점 불일치 · 합성 불가'}</text>`;}
['type-f','type-g'].forEach(id=>$(id).addEventListener('input',typeMap));typeMap();
add('graph-checker','relation-map','화살표를 켜고 끄면 범주 그림도 바뀝니다',`<div class="visual-stage" tabindex="0" role="region" aria-label="가로 스크롤 가능한 관계 그래프"><svg viewBox="0 0 620 300" role="img" aria-label="체크한 관계와 부족한 합성 화살표" id="relation-live-svg"></svg></div><p>실선은 실제 사상, 점선은 길이 2 경로에 필요하지만 빠진 합성입니다. 고리는 항등사상입니다. 각 객체 쌍의 사상이 최대 하나인 모델입니다.</p>`);
function relation(){const r=Array.from({length:3},()=>[false,false,false]);$('graph-checker').querySelectorAll('input[data-from]').forEach(e=>r[+e.dataset.from][+e.dataset.to]=e.checked);let s=defs('relation-live-arrow');for(let i=0;i<3;i++)for(let j=0;j<3;j++){const exists=r[i][j],missing=!exists&&r[i].some((v,k)=>v&&r[k][j]);if(!exists&&!missing)continue;const x=100+210*i,y=100+210*j,d=i===j?`M${x-15} 130C${x-90} 20 ${x+90} 20 ${x+15} 130`:`M${x} ${i<j?125:195}Q${(x+y)/2} ${i<j?40:280} ${y} ${i<j?125:195}`;s+=`<path class="edge ${missing?'missing':''}" d="${d}" ${exists?'marker-end="url(#relation-live-arrow)"':''}/>`;}for(let i=0;i<3;i++)s+=`<circle class="node" cx="${100+i*210}" cy="160" r="32"/><text x="${100+i*210}" y="166" text-anchor="middle">${'ABC'[i]}</text>`;$('relation-live-svg').innerHTML=s;}
$('graph-checker').querySelectorAll('input[data-from]').forEach(e=>e.addEventListener('change',relation));['graph-identities','graph-close','graph-reset'].forEach(id=>$(id).addEventListener('click',relation));relation();
})();
