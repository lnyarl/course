(function () {
'use strict';
const calculators = {
 classifier(v) {const sets=[[],[0],[1,2],[0,1,2]],s=sets[['∅','{0}','{1,2}','{0,1,2}'].indexOf(v[0])];return {rows:[0,1,2].map(x=>[`x=${x}`,`χ(${x})`,s.includes(x)?'true · S로 복원':'false · 제외']),out:`true의 역상 = {${s}}. 포함 S↪X를 이 χ가 유일하게 분류합니다.`};},
 pullback(v) {const s=[[],[0],[1],[0,1]][['∅','{0}','{1}','{0,1}'].indexOf(v[0])],g=v[1].split(',').map(Number),ys=g.map((x,i)=>s.includes(x)?i:null).filter(x=>x!==null);return {rows:g.map((x,i)=>[`y${i}`,`g(y${i})=${x}`,s.includes(x)?'χ(g(y))=true':'χ(g(y))=false']),out:`g⁻¹S={${ys.map(x=>'y'+x)}}. 당김 쌍은 ${ys.map(i=>`(y${i},${g[i]})`).join(', ')||'없음'}.`};},
 heyting(v) {const cv=x=>['0','u','1'].indexOf(x),nm=x=>['0','u','1'][x],p=cv(v[0]),q=cv(v[1]),imp=(a,b)=>a<=b?2:b,neg=imp(p,0);return {rows:[['함의 p⇒q',`${v[0]} ⇒ ${v[1]}`,nm(imp(p,q))],['부정 ¬p',`${v[0]} ⇒ 0`,nm(neg)],['배중률 p∨¬p',`${v[0]} ∨ ${nm(neg)}`,nm(Math.max(p,neg))]],out:`p∨¬p가 최상위 1인가? ${Math.max(p,neg)===2?'예':'아니요'}. 이 격자는 일반 토포스 논리가 Boolean일 필요 없음을 보여 줍니다.`};},
};
function monoid(add) {const op=(a,b)=>(a+(add?b:-b)+3)%3;let failures=[],unit=0;for(let a=0;a<3;a++){if(op(0,a)!==a)unit++;if(op(a,0)!==a)unit++;for(let b=0;b<3;b++)for(let c=0;c<3;c++)if(op(op(a,b),c)!==op(a,op(b,c)))failures.push([a,b,c]);}const f=failures[0];return {rows:[['결합법칙 27개',`${27-failures.length}개 통과`,`${failures.length}개 실패`],['좌우 단위 6개',`${6-unit}개 통과`,`${unit}개 실패`],['첫 결합 반례',f?f.join(','):'없음',f?`${op(op(f[0],f[1]),f[2])} ≠ ${op(f[0],op(f[1],f[2]))}`:'유한 운반 전체 통과']],out:!failures.length&&!unit?'이 유한 연산은 모노이드 법칙을 모두 만족합니다.':'같은 연산 타입이어도 모노이드 법칙이 성립하지 않습니다.'};}
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let arrowId='';

const text=(x,y,value,cls='',anchor='middle')=>`<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(value)}</text>`;

const rect=(x,y,w,h,cls='',rx=10)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;

const circle=(x,y,r,cls='')=>`<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;

const line=(x,y,u,v,cls='')=>`<path d="M${x} ${y}L${u} ${v}" class="edge ${cls}"/>`;

const curve=(d,cls='')=>`<path d="${d}" class="edge ${cls}" marker-end="url(#${arrowId})"/>`;

const node=(x,y,label,cls='',r=23)=>circle(x,y,r,'node '+cls)+text(x,y+5,label,'node-label');

function frame(body,height,steps=1,label=''){return {body,height,steps,label};}

function drawClassifier(v){
 const selected=[[],[0],[1,2],[0,1,2]][['∅','{0}','{1,2}','{0,1,2}'].indexOf(v[0])];
 let b=text(380,27,'부분집합과 true의 역상이 같은 원소들을 고릅니다.','heading');
 b+=rect(45,80,655,125,'set-boundary',25)+text(75,67,'X={0,1,2}','small','start');
 selected.forEach(x=>b+=circle(170+x*210,140,35,'subset-ring'));
 [0,1,2].forEach(x=>{const yes=selected.includes(x),tx=yes?510:250;b+=node(170+x*210,140,x,yes?'selected-node':'',22);b+=curve(`M${170+x*210} 165C${170+x*210} 235 ${tx} 235 ${tx} 285`,yes?'ok-edge':'muted-edge');});
 b+=rect(160,280,445,110,'set-boundary',25)+text(180,268,'Ω','small','start');b+=node(250,335,'false','',35)+node(510,335,'true','ok-node',35);
 b+=text(380,435,selected.length?`S={${selected.join(',')}}를 둘러싼 원소만 true로 갑니다.`:'S=∅: true로 가는 원소가 없습니다.','small');
 return frame(b,470);
}

function drawPullback(v){
 const selected=[[],[0],[1],[0,1]][['∅','{0}','{1}','{0,1}'].indexOf(v[0])],g=v[1].split(',').map(Number);
 let b=text(380,27,'g의 연결을 거슬러 선택 조건을 Y로 옮깁니다.','heading');
 b+=rect(45,75,655,110,'set-boundary',25)+text(75,62,'Y: 색 테두리가 g⁻¹S','small','start');
 b+=rect(170,285,420,110,'set-boundary',25)+text(195,272,'X: 색 테두리가 S','small','start');
 g.forEach((x,i)=>{const a=160+i*220,t=270+x*220,yes=selected.includes(x);b+=curve(`M${a} 153C${a} 220 ${t} 220 ${t} 312`,yes?'ok-edge':'muted-edge');if(yes)b+=circle(a,130,33,'subset-ring');b+=node(a,130,`y${i}`,yes?'selected-node':'',21);});
 [0,1].forEach(x=>{if(selected.includes(x))b+=circle(270+x*220,340,33,'subset-ring');b+=node(270+x*220,340,x,selected.includes(x)?'selected-node':'',21);});
 b+=text(380,445,'선택된 X 원소로 가는 모든 Y 원소가 역상에 포함됩니다.','small');
 return frame(b,480);
}

function drawHeyting(v){
 const cv=x=>['0','u','1'].indexOf(x),names=['0','u','1'],p=cv(v[0]),q=cv(v[1]),imp=(a,b)=>a<=b?2:b,neg=imp(p,0),join=Math.max(p,neg),values=[imp(p,q),neg,join];
 let b=text(380,27,'세 값 Heyting 사슬의 순서와 연산 결과','heading');
 ['p⇒q','¬p = p⇒0','p∨¬p'].forEach((label,j)=>{const x=170+j*210;b+=text(x,75,label,'small');for(let k=0;k<3;k++){const y=330-k*90;if(k<2)b+=line(x,y-20,x,y-70,'muted-edge');b+=node(x,y,names[k],k===values[j]?(j===2&&join<2?'bad-node':'result'):'',23);}b+=text(x,390,`결과 ${names[values[j]]}`,'small');});
 b+=text(380,438,join<2?'중간값 u는 ¬u=0이므로 u∨¬u=u: 최상위 1이 아닙니다.':'이 입력에서는 배중률의 결과가 최상위 1입니다.',join<2?'bad-text':'ok-text');
 return frame(b,475);
}
const drawers={
 classifier: drawClassifier,
 pullback: drawPullback,
 heyting: drawHeyting
};
function init() {
 document.querySelectorAll('.advanced-widget').forEach((el,index)=>{
  const form=el.querySelector('.controls'),stage=el.querySelector('.calc-diagram'),output=el.querySelector('.calc-output'),position=el.querySelector('.position'),play=el.querySelector('[data-action="play"]');
  let step=0,steps=1,timer=null;
  function pause(){if(timer!==null)clearInterval(timer);timer=null;if(play){play.textContent='▶ 재생';play.setAttribute('aria-pressed','false');}}
  function render(){
   const values=[...form.querySelectorAll('select')].map(x=>x.value),kind=el.dataset.kind,result=calculators[kind](values);
   arrowId=`c${document.body.dataset.chapter}w${index}arrow`;
   const visual=drawers[kind](values,step,result);steps=visual.steps;step=Math.min(step,steps-1);
   stage.innerHTML=`<svg class="concept-svg" viewBox="0 0 760 ${visual.height}" role="img" aria-label="${esc(el.querySelector('.w-title').textContent)}"><title>${esc(el.querySelector('.w-title').textContent)}</title><defs><marker id="${arrowId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="arrow-head"/></marker></defs>${visual.body}</svg>`;
   output.textContent=play&&step<steps-1?`현재 단계: ${visual.label}.\n현재 도식의 중간 구조를 확인한 뒤 다음 단계로 진행하세요.`:(play?`현재 단계: ${visual.label}.\n`:'')+result.out;
   el.dataset.step=step;el.dataset.steps=steps;
   if(position)position.textContent=`단계 ${step+1} / ${steps} · ${visual.label}`;
   el.querySelectorAll('[data-action="prev"]').forEach(b=>b.disabled=step===0);
   el.querySelectorAll('[data-action="next"]').forEach(b=>b.disabled=step===steps-1);
   if(play)play.disabled=steps<2;
   if(step>=steps-1)pause();
  }
  form.addEventListener('change',()=>{pause();step=0;render();});
  el.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{
   const action=button.dataset.action;
   if(action==='play'){
    if(timer!==null){pause();return;}
    if(step===steps-1)step=0;
    render();if(steps<2)return;
    play.textContent='Ⅱ 일시정지';play.setAttribute('aria-pressed','true');
    timer=setInterval(()=>{step++;render();},1100);
   }else{pause();step=action==='reset'?0:action==='prev'?Math.max(0,step-1):Math.min(steps-1,step+1);render();}
  }));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',pause);render();
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
