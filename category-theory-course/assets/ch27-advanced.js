(function () {
'use strict';
const calculators = {
 ran(v) {const [a,b,f,g]=v.map(Number);if(f>=a||g>=b)return {rows:[['입력 검사',`f=${f},g=${g}`,`범위: f<${a}, g<${b}`]],out:'입력 오류: 함수값이 해당 집합 안에 있어야 합니다.'};return {rows:[['원뿔 성분',`f(x)=${f}, g(x)=${g}`,'X={x}'],['유일 σ',`x ↦ (${f},${g})`,`A×B: ${a*b}개`],['ε∘σ',`π₁=${f}`,`π₂=${g}`]],out:'사영 두 개가 σ의 두 좌표를 강제로 정하므로 매개 함수가 유일합니다.'};},
 lan(v) {return {rows:[['A의 첫 주입','Left(a0)',`σ=${v[0]}`],['A의 둘째 주입','Left(a1)',`σ=${v[1]}`],['B의 주입','Right(b0)',`σ=${v[2]}`]],out:'이 세 출력이 서로소 합 전체의 함수 σ를 유일하게 정합니다. σ∘η=η′입니다.'};},
 kanposet(v) {const [l,u,x]=v.map(Number);if(l>u)return {rows:[['D의 함자성',`D0=${l},D2=${u}`,'l≤u 실패']],out:'입력 오류: 0→2를 보존하려면 l≤u여야 합니다.'};let ok=l<=x&&x<=u;return {rows:[['허용 가운데 값',`${l}…${u}`,`${u-l+1}개`],['Lan→후보',`${l} ≤ ${x}`,l<=x?'사상 1개':'사상 0개'],['후보→Ran',`${x} ≤ ${u}`,x<=u?'사상 1개':'사상 0개']],out:`후보 F의 단조성: ${ok?'성립':'실패'}. Lan(1)=${l}, Ran(1)=${u}.`};},
};
function monoid(add) {const op=(a,b)=>(a+(add?b:-b)+3)%3;let failures=[],unit=0;for(let a=0;a<3;a++){if(op(0,a)!==a)unit++;if(op(a,0)!==a)unit++;for(let b=0;b<3;b++)for(let c=0;c<3;c++)if(op(op(a,b),c)!==op(a,op(b,c)))failures.push([a,b,c]);}const f=failures[0];return {rows:[['결합법칙 27개',`${27-failures.length}개 통과`,`${failures.length}개 실패`],['좌우 단위 6개',`${6-unit}개 통과`,`${unit}개 실패`],['첫 결합 반례',f?f.join(','):'없음',f?`${op(op(f[0],f[1]),f[2])} ≠ ${op(f[0],op(f[1],f[2]))}`:'유한 운반 전체 통과']],out:!failures.length&&!unit?'이 유한 연산은 모노이드 법칙을 모두 만족합니다.':'같은 연산 타입이어도 모노이드 법칙이 성립하지 않습니다.'};}
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let arrowId='';

const text=(x,y,value,cls='',anchor='middle')=>`<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(value)}</text>`;

const rect=(x,y,w,h,cls='',rx=10)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;

const circle=(x,y,r,cls='')=>`<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;

const arrow=(x,y,u,v,label='',cls='')=>`<path d="M${x} ${y}L${u} ${v}" class="edge ${cls}" marker-end="url(#${arrowId})"/>`+(label?text((x+u)/2,(y+v)/2-9,label,'tiny'): '');

const curve=(d,cls='')=>`<path d="${d}" class="edge ${cls}" marker-end="url(#${arrowId})"/>`;

const node=(x,y,label,cls='',r=23)=>circle(x,y,r,'node '+cls)+text(x,y+5,label,'node-label');

function pill(x,y,w,value,cls=''){return rect(x,y,w,36,'token '+cls,7)+text(x+w/2,y+24,value,'token-label');}

function frame(body,height,steps=1,label=''){return {body,height,steps,label};}

function drawRan(v){
 const [a,b,f,g]=v.map(Number),valid=f<a&&g<b;let s=text(380,27,'곱의 좌표 격자와 유일한 매개 사상','heading');
 const x0=360,y0=110,cell=85;
 s+=text(220,100,'B 좌표','small')+text(445,65,'A 좌표','small');
 for(let x=0;x<a;x++){s+=text(x0+x*cell,85,`a${x}`,'small');for(let y=0;y<b;y++)s+=node(x0+x*cell,y0+y*cell,`(${x},${y})`,valid&&x===f&&y===g?'result':'',25);}
 for(let y=0;y<b;y++)s+=text(287,y0+y*cell+5,`b${y}`,'small');
 s+=node(100,195,'x','accent',26)+text(100,145,'X={x}','small');
 if(valid)s+=arrow(132,195,x0+f*cell-29,y0+g*cell,'σ')+text(170,300,`π₁σ(x)=${f}, π₂σ(x)=${g}`,'small');
 else s+=text(150,285,'입력값이 집합 밖입니다.','bad-text');
 s+=text(380,405,valid?'두 사영값을 지정하면 격자의 교점 한 개만 남습니다.':'오류: f(x)∈A, g(x)∈B 조건을 확인하세요.','small');
 return frame(s,445);
}

function drawLan(v){
 let b=text(380,27,'서로소 합의 태그는 남고, 처리 결과는 겹칠 수 있습니다.','heading');
 b+=rect(45,65,225,280,'set-boundary',18)+text(155,52,'A+B','small');
 const labels=['Left(a0)','Left(a1)','Right(b0)'];
 labels.forEach((label,i)=>{b+=pill(70,90+i*80,175,label,`tone${i%2}`);const y=113+i*80,ty=113+(+v[i])*80;b+=curve(`M248 ${y}C365 ${y} 480 ${ty} 570 ${ty}`,`tone${i%2}-edge`);});
 b+=rect(565,65,130,280,'set-boundary',18)+text(630,52,'결과 집합 X','small');
 [0,1,2].forEach(x=>b+=node(630,113+x*80,x,'',20));
 b+=text(380,395,'각 태그의 처리값이 σ:A+B→X 전체를 유일하게 정합니다.','small');
 return frame(b,435);
}

function drawKanposet(v){
 const [l,u,x]=v.map(Number),dataOk=l<=u,ok=dataOk&&l<=x&&x<=u;
 let b=text(380,27,'양끝을 고정한 순서 함자의 허용 가운데 값','heading');
 [0,1,2].forEach(i=>b+=node(180+i*200,85,i,'',20));b+=arrow(205,85,352,85,'K가 추가한 가운데 객체')+arrow(405,85,552,85);
 const y=245,start=125,dx=100;
 if(dataOk)b+=rect(start+l*dx-24,y-48,(u-l)*dx+48,96,'allowed-band',20);
 for(let i=0;i<=5;i++){if(i<5)b+=arrow(start+i*dx+17,y,start+(i+1)*dx-17,y,'≤','muted-edge');b+=node(start+i*dx,y,i,dataOk&&i>=l&&i<=u?'allowed':'',15);}
 const coords=[[180,l,'D(0)=l'],[380,x,'F(1)=x'],[580,u,'D(2)=u']];
 coords.forEach(([from,to,label],i)=>{b+=arrow(from,110,start+to*dx,207,label,i===1&&!ok?'bad-edge':'accent-edge');});
 b+=text(start+l*dx,326,`Lan=${l}`,'small')+text(start+u*dx,355,`Ran=${u}`,'small');
 b+=text(380,409,!dataOk?'D(0)≤D(2)가 깨져 원래 데이터가 함자가 아닙니다.':ok?`l≤x≤u: 허용 후보 ${u-l+1}개, 가운데 x=${x}`:`x=${x}는 허용 구간 밖: 확장의 단조성 실패`,ok?'ok-text':'bad-text');
 return frame(b,450);
}
const drawers={
 ran: drawRan,
 lan: drawLan,
 kanposet: drawKanposet
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
