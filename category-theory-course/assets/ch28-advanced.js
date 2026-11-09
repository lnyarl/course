(function () {
'use strict';
const calculators = {
 triangle(v) {const [a,b,c]=v.map(Number),ok=c<=a+b;return {rows:[['경유 경로',`dxy=${a} + dyz=${b}`,`${a+b}`],['직접 경로',`dxz=${c}`,`${c}`],['V의 합성 사상',`${a+b} ≥ ${c}`,ok?'존재':'존재하지 않음']],out:`표시한 삼각부등식 ${ok?'성립':'실패'}. 완전한 거리 행렬은 모든 삼중쌍을 검사해야 합니다.`};},
 boolenrich(v) {const [a,b,c]=v.map(x=>x==='true'),need=a&&b;return {rows:[['Hom 텐서',`${a} ∧ ${b}`,`${need}`],['합성 목적지','C(x,z)',`${c}`],['기저 사상',`${need} ≤ ${c}`,!need||c?'존재':'없음']],out:!need||c?'반사 간선을 포함한 이 세 점 방향 관계는 추이적입니다.':'실패: x≤y와 y≤z이면 x≤z가 필요합니다.'};},
 nonexpand(v) {const k=+v[0],rows=[[0,2],[2,5],[0,5]].map(([a,b])=>[`${a}→${b}`,`기존 ${b-a}`,`새 거리 ${(b-a)*k}`]);return {rows,out:`모든 점 쌍에서 새 거리≤기존: ${k<=1?'성립':'실패'}. 객체 함수 F(t)=${k}t.`};},
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

function frame(body,height,steps=1,label=''){return {body,height,steps,label};}

function drawTriangle(v){
 const [a,b,c]=v.map(Number),ok=c<=a+b;
 let s=text(380,27,'가중 경로와 삼각부등식: 직접 비용 ≤ 경유 비용','heading');
 s+=node(130,190,'x','',22)+node(380,85,'y','',22)+node(630,190,'z','',22);
 s+=arrow(150,173,355,98,`d(x,y)=${a}`)+arrow(405,98,609,173,`d(y,z)=${b}`)+arrow(160,207,600,207,`d(x,z)=${c}`,ok?'ok-edge':'bad-edge');
 s+=text(380,255,'위는 연결 관계의 개략도입니다. 아래 막대 길이가 수치에 비례합니다.','small');
 const unit=48;
 s+=text(125,310,'경유 x→y→z','small');
 s+=rect(235,283,a*unit,34,'cost-a',2)+rect(235+a*unit,283,b*unit,34,'cost-b',2)+text(250+(a+b)*unit,306,a+b,'small','start');
 s+=text(125,365,'직접 x→z','small')+rect(235,338,c*unit,34,ok?'cost-good':'cost-bad',2)+text(250+c*unit,361,c,'small','start');
 s+=text(380,419,`${c} ${ok?'≤':'>'} ${a}+${b} = ${a+b}: ${ok?'합성 사상 존재':'삼각부등식 실패'}`,ok?'ok-text':'bad-text');
 return frame(s,455);
}

function drawBoolenrich(v){
 const [a,b,c]=v.map(x=>x==='true'),need=a&&b,ok=!need||c;
 let s=text(380,27,'반사 간선 + 선택한 관계에서 합성 간선이 필요한가','heading');
 const pts=[[130,170,'x'],[380,85,'y'],[630,170,'z']];pts.forEach(([x,y,l])=>{s+=node(x,y,l,'',24)+curve(`M${x-15} ${y-22}C${x-55} ${y-85} ${x+55} ${y-85} ${x+18} ${y-22}`,'muted-edge');});
 if(a)s+=arrow(156,159,352,96,'참');else s+=line(156,159,352,96,'absent-edge');
 if(b)s+=arrow(408,96,604,159,'참');else s+=line(408,96,604,159,'absent-edge');
 if(c)s+=arrow(160,190,600,190,'x≤z','ok-edge');else if(need)s+=arrow(160,190,600,190,'필수인데 없음','bad-edge dashed');
 s+=rect(235,275,290,70,'logic-gate',22)+text(380,317,`${a} ∧ ${b} = ${need}`,'small');
 s+=text(380,390,ok?'합성 요구를 만족합니다. 반대칭성은 별도 조건입니다.':'두 단계 경로가 있으므로 직접 관계를 추가해야 합니다.',ok?'ok-text':'bad-text');
 return frame(s,430);
}

function drawNonexpand(v){
 const k=+v[0],points=[0,2,5],sx=x=>100+x*52;
 let b=text(380,27,'객체의 실제 위치 이동과 거리의 증감','heading');
 b+=line(80,115,660,115,'muted-edge')+line(80,315,660,315,'muted-edge');
 b+=text(75,90,'원래','small')+text(75,355,'F 이후','small');
 points.forEach(p=>{b+=node(sx(p),115,p,'',18);b+=arrow(sx(p),140,sx(p*k),290,`F(${p})`,'muted-edge');});
 [...new Set(points.map(p=>p*k))].forEach(p=>b+=node(sx(p),315,p,k<=1?'ok-node':'bad-node',20));
 if(k===0)b+=text(200,365,'세 점의 상이 같은 점으로 합쳐집니다.','small');
 const before=5,after=5*k;b+=line(sx(0),65,sx(5),65,'accent-edge')+text((sx(0)+sx(5))/2,51,`d(0,5)=${before}`,'small');
 b+=line(sx(0),395,sx(5*k),395,k<=1?'ok-edge':'bad-edge')+text((sx(0)+sx(5*k))/2,424,`d(F0,F5)=${after} ${k<=1?'≤':'>'} ${before}`,k<=1?'ok-text':'bad-text');
 return frame(b,460);
}
const drawers={
 triangle: drawTriangle,
 boolenrich: drawBoolenrich,
 nonexpand: drawNonexpand
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
