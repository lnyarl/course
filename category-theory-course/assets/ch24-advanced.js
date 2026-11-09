(function () {
'use strict';
const calculators = {
 natfold(v) { const n=+v[0], star=v[1]==='별표', rows=[['Zero', '1',star?'ε':'0']]; for(let i=1;i<=n;i++)rows.push([`Succ 단계 ${i}`,star?'* + '+('*'.repeat(i-1)||'ε'):`${i-1} + 1`,star?'*'.repeat(i):String(i)]); return {rows,out:`fold 결과: ${star?('*'.repeat(n)||'ε'):n}. ${n+1}개 생성자를 해석했습니다.`}; },
 hom(v) {const k=+v[0],inc=v[1]==='+k'?k:1,rows=[];for(let n=0;n<4;n++) rows.push([`n=${n}`,`h(α(Succ ${n}))=${k*(n+1)}`,`β(Fh(Succ ${n}))=${k*n+inc}`]);return {rows,out:`준동형 표본: ${inc===k?'모두 일치':'불일치'}. Zero는 두 해석 모두 0입니다.`};},
 unfold(v) {const n=+v[0],rows=[];let s=0;for(let i=n;i>0;i--){s+=i;rows.push([`상태 ${i}`,`원소 ${i}, 다음 ${i-1}`,`부분합 ${s}`]);} rows.push(['상태 0','종료 1 분기',`합계 ${s}`]);return {rows,out:`unfold = [${Array.from({length:n},(_,i)=>n-i)}], fold 합계=${s}`};},
};
function monoid(add) {const op=(a,b)=>(a+(add?b:-b)+3)%3;let failures=[],unit=0;for(let a=0;a<3;a++){if(op(0,a)!==a)unit++;if(op(a,0)!==a)unit++;for(let b=0;b<3;b++)for(let c=0;c<3;c++)if(op(op(a,b),c)!==op(a,op(b,c)))failures.push([a,b,c]);}const f=failures[0];return {rows:[['결합법칙 27개',`${27-failures.length}개 통과`,`${failures.length}개 실패`],['좌우 단위 6개',`${6-unit}개 통과`,`${unit}개 실패`],['첫 결합 반례',f?f.join(','):'없음',f?`${op(op(f[0],f[1]),f[2])} ≠ ${op(f[0],op(f[1],f[2]))}`:'유한 운반 전체 통과']],out:!failures.length&&!unit?'이 유한 연산은 모노이드 법칙을 모두 만족합니다.':'같은 연산 타입이어도 모노이드 법칙이 성립하지 않습니다.'};}
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let arrowId='';

const text=(x,y,value,cls='',anchor='middle')=>`<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(value)}</text>`;

const rect=(x,y,w,h,cls='',rx=10)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;

const circle=(x,y,r,cls='')=>`<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;

const line=(x,y,u,v,cls='')=>`<path d="M${x} ${y}L${u} ${v}" class="edge ${cls}"/>`;

const arrow=(x,y,u,v,label='',cls='')=>`<path d="M${x} ${y}L${u} ${v}" class="edge ${cls}" marker-end="url(#${arrowId})"/>`+(label?text((x+u)/2,(y+v)/2-9,label,'tiny'): '');

const node=(x,y,label,cls='',r=23)=>circle(x,y,r,'node '+cls)+text(x,y+5,label,'node-label');

function pill(x,y,w,value,cls=''){return rect(x,y,w,36,'token '+cls,7)+text(x+w/2,y+24,value,'token-label');}

function list(values,x,y,{cell=43,gap=7,pad=12,cls='',label=''}={}) {
 const width=Math.max(50,values.length*(cell+gap)-gap+2*pad);
 let body=rect(x,y,width,58,'boundary '+cls,10);
 if(label)body+=text(x,y-10,label,'small','start');
 values.forEach((v,i)=>{body+=pill(x+pad+i*(cell+gap),y+11,cell,v,cls);});
 if(!values.length)body+=text(x+width/2,y+35,'[]','muted');
 return {body,width};
}

function frame(body,height,steps=1,label=''){return {body,height,steps,label};}

function drawNatfold(v,step){
 const n=+v[0],star=v[1]==='별표',done=Math.min(step,n+1),remaining=n-done;
 const val=star?('*'.repeat(Math.max(0,done-1))||'ε'):String(Math.max(0,done-1));
 let b=text(380,28,'자연수의 생성자 트리 → 아래에서 위로 접기','heading');
 const chain=[];
 for(let i=0;i<=Math.max(-1,remaining);i++)chain.push({label:'Succ',value:false});
 if(done===0){chain.length=0;for(let i=0;i<n;i++)chain.push({label:'Succ'});chain.push({label:'Zero'});}
 else chain.push({label:val,value:true});
 chain.forEach((a,i)=>{const y=70+i*65;b+=node(260,y,a.label,a.value?'result':'',25);if(i)b+=arrow(260,y-40,260,y-25,'','muted-edge');});
 const h=chain.length*65+110;
 if(done){const y=70+(chain.length-1)*65;b+=text(430,y-10,done===1?'α(Zero)':'α(Succ(result))','small');b+=arrow(390,y+12,300,y+12,'','accent-edge');b+=text(475,y+30,`해석한 생성자 ${done}/${n+1}`,'small');}
 b+=text(380,h-16,done===0?'아직 해석하지 않은 재귀 구조':done===n+1?'생성자 경계가 사라지고 운반 타입의 값만 남습니다.':'가장 안쪽 하위 트리를 값 하나로 교체합니다.','small');
 return frame(b,h,n+2,done===0?'입력 트리':done===1?'Zero 해석':`Succ ${done-1}개 해석`);
}

function drawHom(v){
 const k=+v[0],inc=v[1]==='+k'?k:1,scale=16,base=260;
 let b=text(380,28,'같은 입력 n에서 두 해석 경로의 도착값 비교','heading');
 b+=line(95,base,680,base,'muted-edge')+line(95,base,95,45,'muted-edge');
 for(let n=0;n<4;n++){
  const x=155+n*150,a=k*(n+1),c=k*n+inc;
  b+=line(x-22,base,x-22,base-a*scale,'accent-edge')+line(x+22,base,x+22,base-c*scale,'comparison-edge');
  b+=circle(x-22,base-a*scale,7,'accent-fill')+circle(x+22,base-c*scale,7,a===c?'ok-fill':'bad-fill');
  b+=text(x-25,base-a*scale-14,a,'small')+text(x+25,base-c*scale-14,c,'small');
  b+=text(x,base+28,`n=${n}`,'small');
  b+=text(x,base+55,a===c?'같음':'불일치',a===c?'ok-text':'bad-text');
 }
 b+=text(230,345,'왼쪽 막대: h(α(Succ n))','small')+text(535,345,'오른쪽 막대: β(Fh(Succ n))','small');
 return frame(b,375);
}

function drawUnfold(v){
 const n=+v[0],xs=Array.from({length:n},(_,i)=>n-i);let b=text(380,28,'상태 감소로 리스트를 생성하고, 생성한 원소를 합칩니다.','heading');
 for(let i=0;i<=n;i++){
  const x=55+i*100;b+=node(x,95,n-i,i===n?'result':'',20);
  if(i<n)b+=arrow(x+22,95,x+76,95,'γ');
  if(i<n)b+=arrow(x,118,x,170,'원소')+pill(x-22,175,44,n-i);
 }
 b+=text(380,252,n===0?'시작부터 종료 분기 1':'각 출력 원소는 그 상태에서 한 번 생성됩니다.','small');
 const row=list(xs,55,290,{cell:55,label:'unfold 결과 List E'});b+=row.body;
 b+=arrow(380,355,380,403,'fold (+,0)')+pill(330,410,100,xs.reduce((a,x)=>a+x,0),'result');
 return frame(b,470);
}
const drawers={
 natfold: drawNatfold,
 hom: drawHom,
 unfold: drawUnfold
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
