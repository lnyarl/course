(function () {
'use strict';
const calculators = {
 end(v) {let a=[...v[0]].map(Number),b=[...v[1]].map(Number),ok=a.every(x=>x===b[0]);let count=0;for(let x=0;x<4;x++)for(let y=0;y<4;y++)if(Math.floor(x/2)===Math.floor(y/2) && x%2===Math.floor(y/2))count++;return {rows:[['x=0',`Gf(τa(0))=${a[0]}`,`τb(Ff(0))=${b[0]}`],['x=1',`Gf(τa(1))=${a[1]}`,`τb(Ff(1))=${b[0]}`],['엔드의 원소',ok?'선택한 가족 포함':'선택한 가족 제외',`전체 ${count}가족`]],out:`자연성 ${ok?'성립':'실패'}: Ff는 상수 0, Gf는 항등입니다.`};},
 coend(v) {const flip=v[0]==='뒤집기',b0=flip?1:0,b1=flip?0:1;return {rows:[['x=0의 생성 관계','a0',`b${b0}`],['x=1의 생성 관계','a1',`b${b1}`],['몫의 동치류',`{a0,b${b0}}`,`{a1,b${b1}}`]],out:'서로소 합 4개 표현 → 2개 동치류. 두 관계 사이에는 추가 연결이 없습니다.'};},
 prof(v) {const [p,q,r,s]=v.map(Number),n=p*q+r*s;return {rows:[['d₀ 경유',`${q} × ${p}`,`${p*q}개 증거쌍`],['d₁ 경유',`${s} × ${r}`,`${r*s}개 증거쌍`],['서로소 합',`${p*q} + ${r*s}`,`${n}개`]],out:`합성 프로함자의 해당 성분 크기=${n}. 이산 가운데 범주라 경유 태그를 식별하지 않습니다.`};},
};
function monoid(add) {const op=(a,b)=>(a+(add?b:-b)+3)%3;let failures=[],unit=0;for(let a=0;a<3;a++){if(op(0,a)!==a)unit++;if(op(a,0)!==a)unit++;for(let b=0;b<3;b++)for(let c=0;c<3;c++)if(op(op(a,b),c)!==op(a,op(b,c)))failures.push([a,b,c]);}const f=failures[0];return {rows:[['결합법칙 27개',`${27-failures.length}개 통과`,`${failures.length}개 실패`],['좌우 단위 6개',`${6-unit}개 통과`,`${unit}개 실패`],['첫 결합 반례',f?f.join(','):'없음',f?`${op(op(f[0],f[1]),f[2])} ≠ ${op(f[0],op(f[1],f[2]))}`:'유한 운반 전체 통과']],out:!failures.length&&!unit?'이 유한 연산은 모노이드 법칙을 모두 만족합니다.':'같은 연산 타입이어도 모노이드 법칙이 성립하지 않습니다.'};}
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let arrowId='';

const text=(x,y,value,cls='',anchor='middle')=>`<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(value)}</text>`;

const rect=(x,y,w,h,cls='',rx=10)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;

const circle=(x,y,r,cls='')=>`<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;

const line=(x,y,u,v,cls='')=>`<path d="M${x} ${y}L${u} ${v}" class="edge ${cls}"/>`;

const arrow=(x,y,u,v,label='',cls='')=>`<path d="M${x} ${y}L${u} ${v}" class="edge ${cls}" marker-end="url(#${arrowId})"/>`+(label?text((x+u)/2,(y+v)/2-9,label,'tiny'): '');

const curve=(d,cls='')=>`<path d="${d}" class="edge ${cls}" marker-end="url(#${arrowId})"/>`;

const node=(x,y,label,cls='',r=23)=>circle(x,y,r,'node '+cls)+text(x,y+5,label,'node-label');

function pill(x,y,w,value,cls=''){return rect(x,y,w,36,'token '+cls,7)+text(x+w/2,y+24,value,'token-label');}

function frame(body,height,steps=1,label=''){return {body,height,steps,label};}

function drawEnd(v){
 const ta=[...v[0]].map(Number),tb=[...v[1]].map(Number);let b=text(380,27,'네 집합 사이의 실제 원소 대응과 자연성','heading');
 const sets=[{x:160,y:110,label:'F(a)'},{x:580,y:110,label:'G(a)'},{x:160,y:300,label:'F(b)'},{x:580,y:300,label:'G(b)'}];
 sets.forEach(s=>{b+=rect(s.x-70,s.y-52,140,104,'set-boundary',30)+text(s.x,s.y-65,s.label,'small');[0,1].forEach(i=>b+=node(s.x-32+64*i,s.y,i,'',15));});
 [0,1].forEach(i=>{
  b+=curve(`M${160-32+64*i} 95Q370 ${40+i*20} ${580-32+64*ta[i]} 95`,`tone${i}-edge`);
  b+=arrow(160-32+64*i,130,128,280,'',`tone${i}-edge`);
  b+=arrow(580-32+64*i,130,580-32+64*i,280,'','muted-edge');
  b+=curve(`M${160-32+64*i} 315Q370 ${355+i*25} ${580-32+64*tb[i]} 315`,`tone${i}-edge`);
 });
 b+=text(365,84,'τ_a','small')+text(90,210,'Ff: 상수 0','small')+text(657,210,'Gf: 항등','small')+text(365,275,'τ_b','small');
 [0,1].forEach(i=>{const ok=ta[i]===tb[0];b+=pill(180+i*225,405,200,`입력 ${i}: ${ta[i]} ${ok?'=':'≠'} ${tb[0]}`,ok?'ok-node':'bad-node');});
 return frame(b,475);
}

function drawCoend(v){
 const flip=v[0]==='뒤집기',target=i=>flip?1-i:i;
 let b=text(380,27,'생성 관계를 따라 태그가 다른 표현을 식별합니다.','heading');
 b+=rect(45,65,280,185,'set-boundary',20)+text(185,52,'대각 집합들의 서로소 합','small');
 for(let i=0;i<2;i++){
  b+=node(110,110+i*90,`a${i}`,`tone${i}`,24)+node(260,110+i*90,`b${i}`,`tone${flip?1-i:i}`,24);
  b+=line(135,110+i*90,235,110+target(i)*90,'relation-edge');
 }
 b+=text(185,285,flip?'a0∼b1, a1∼b0':'a0∼b0, a1∼b1','small');
 b+=rect(450,65,255,240,'set-boundary',20)+text(575,52,'코엔드: 동치류 2개','small');
 for(let i=0;i<2;i++){
  b+=rect(475,90+i*100,205,70,`quotient-class tone${i}`,32)+text(577,132+i*100,`[a${i}, b${target(i)}]`,'small');
  b+=curve(`M135 ${110+i*90}Q330 ${i===0?25:310} 475 ${125+i*100}`,`quotient-map tone${i}-edge`);
  const sourceClass=flip?1-i:i;
  b+=curve(`M285 ${110+i*90}C350 ${110+i*90} 400 ${125+sourceClass*100} 475 ${125+sourceClass*100}`,`quotient-map tone${sourceClass}-edge`);
 }
 b+=text(380,360,'선을 한 번 그리는 것에서 끝나지 않고 동치관계의 폐포로 몫을 만듭니다.','small');
 return frame(b,395);
}

function drawProf(v){
 const [p,q,r,s]=v.map(Number),counts=[[p,q],[r,s]];let b=text(380,27,'가운데 객체별로 증거쌍을 만들고 서로소 합을 취합니다.','heading');
 counts.forEach(([a,c],d)=>{
  const x=40+d*365;b+=rect(x,65,325,265,'set-boundary',18)+text(x+160,92,`d${d}: Q ${c}개 × P ${a}개`,'small');
  if(a===0||c===0)b+=text(x+160,205,'곱에 원소 없음','muted');
  for(let i=0;i<a;i++)for(let j=0;j<c;j++)b+=pill(x+25+i*95,125+j*58,82,`(q${j},p${i})`,`tone${d}`);
  b+=text(x+160,313,`${a*c}개 경유 증거쌍`,'small');
 });
 b+=text(380,375,`${p*q} + ${r*s} = ${p*q+r*s}개. 이산 가운데 범주라 다른 d의 태그를 합치지 않습니다.`,'small');
 return frame(b,410);
}
const drawers={
 end: drawEnd,
 coend: drawCoend,
 prof: drawProf
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
