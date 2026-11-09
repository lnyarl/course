(function () {
'use strict';
const calculators = {
 monadalg(v) {const xs=[[[1,2],[],[3]],[[2],[4,5]],[[],[]]][['[[1,2],[],[3]]','[[2],[4,5]]','[[],[]]'].indexOf(v[0])], sum=a=>a.reduce((s,x)=>s+x,0),a=v[1]==='Sum'?sum:x=>x.length, flat=xs.flat(),inner=xs.map(a),l=a(flat),r=a(inner);return {rows:[['입력 T(T A)',JSON.stringify(xs),'두 경로 시작'],['μ 후 a',JSON.stringify(flat),String(l)],['T a 후 a',JSON.stringify(inner),String(r)]],out:`중첩 법칙: ${l===r?'일치':'실패'} (${l} 대 ${r}). 단위 [7]→${a([7])}: ${a([7])===7?'성립':'실패'}`};},
 alghom(v) {let k=+v[0],b=+v[1],rows=[[],[1],[1,2]].map(xs=>['리스트 ['+xs+']',`h(Sum)=${k*xs.reduce((s,x)=>s+x,0)+b}`,`Sum(Map h)=${xs.reduce((s,x)=>s+k*x+b,0)}`]);return {rows,out:b===0?'준동형 성립: 분배법칙과 h(0)=0.':'실패: 공백 리스트에서 h(0)≠0.'};},
 lens(v) {const a=+v[0],s=+v[1],bad=v[2]!== '정상',set=(_,x)=>x+(bad?1:0),gp=set(a,a),pg=set(a,s),pp=set(set(a,s),2),last=set(a,2);return {rows:[['get-put',`set(${a},get)=${gp}`,gp===a?'원본 보존':'원본 변경'],['put-get',`get(set(${a},${s}))=${pg}`,pg===s?'요청 값 일치':'요청 값 불일치'],['put-put',`${pp} 대 ${last}`,pp===last?'마지막 쓰기 일치':'불일치']],out:'이름 필드는 보존됩니다. 세 법칙은 각각 따로 확인해야 합니다.'};},
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

function list(values,x,y,{cell=43,gap=7,pad=12,cls='',label=''}={}) {
 const width=Math.max(50,values.length*(cell+gap)-gap+2*pad);
 let body=rect(x,y,width,58,'boundary '+cls,10);
 if(label)body+=text(x,y-10,label,'small','start');
 values.forEach((v,i)=>{body+=pill(x+pad+i*(cell+gap),y+11,cell,v,cls);});
 if(!values.length)body+=text(x+width/2,y+35,'[]','muted');
 return {body,width};
}

function nestedMeasure(value,scale=1){return Array.isArray(value)?Math.max(35, value.reduce((s,v)=>s+nestedMeasure(v,scale)+5,0)+13):30*scale;}

function nestedList(value,x,y,scale=1,depth=0){
 if(!Array.isArray(value))return {body:pill(x,y,30*scale,value,`depth${depth%3}`),width:30*scale,height:36};
 const width=nestedMeasure(value,scale),height=Array.isArray(value[0])?108:65;
 let body=rect(x,y,width,height,`boundary depth${depth%3}`,9),cx=x+9;
 value.forEach(v=>{const child=nestedList(v,cx,y+17,scale,depth+1);body+=child.body;cx+=child.width+5;});
 if(!value.length)body+=text(x+width/2,y+37,'[]','tiny');
 return {body,width,height};
}

function frame(body,height,steps=1,label=''){return {body,height,steps,label};}

function drawMonadalg(v,step){
 const xs=[[[1,2],[],[3]],[[2],[4,5]],[[],[]]][['[[1,2],[],[3]]','[[2],[4,5]]','[[],[]]'].indexOf(v[0])];
 const a=v[1]==='Sum'?xs=>xs.reduce((s,x)=>s+x,0):xs=>xs.length;
 let b=text(380,27,'중첩 경계를 지우기와 안쪽 대수로 줄이기','heading');
 const top=nestedList(xs,230,55);b+=top.body;
 b+=text(190,205,'μ: 내부 리스트 경계 제거','small')+text(565,205,`T a: 내부 ${v[1]} 계산`,'small');
 b+=arrow(300,170,190,220)+arrow(480,170,565,220);
 if(step>=1){const l=list(xs.flat(),60,235,{cell:39,label:'먼저 flatten'}),r=list(xs.map(a),455,235,{cell:45,label:'먼저 내부 평가'});b+=l.body+r.body;}
 else b+=text(190,267,'아직 경계를 유지','muted')+text(565,267,'아직 안쪽을 평가하지 않음','muted');
 if(step>=2){const l=a(xs.flat()),r=a(xs.map(a));b+=arrow(190,305,190,350,`a=${v[1]}`)+arrow(565,305,565,350,`a=${v[1]}`);b+=node(190,390,l,l===r?'ok-node':'bad-node',30)+node(565,390,r,l===r?'ok-node':'bad-node',30)+text(380,395,l===r?'=':'≠',l===r?'big ok-text':'big bad-text');}
 return frame(b,450,3,['입력의 두 겹 경계','경계 제거 / 내부 평가','남은 대수 적용'][step]);
}

function drawAlghom(v){
 const k=+v[0],bias=+v[1],h=x=>k*x+bias,inputs=[[],[1],[1,2]];
 let b=text(380,27,'같은 입력 리스트에서 두 평가 경로가 갈라집니다.','heading');
 inputs.forEach((xs,i)=>{
  const y=100+i*180,source=list(xs,30,y,{cell:37,label:i===0?'공백 리스트':'입력 xs'}),mapped=xs.map(h),a=h(xs.reduce((s,x)=>s+x,0)),c=mapped.reduce((s,x)=>s+x,0),start=30+source.width;
  b+=rect(15,y-45,730,175,'comparison-band',12)+source.body;
  b+=curve(`M${start+5} ${y+29}C210 ${y+29} 220 ${y-10} 622 ${y-10}`,'accent-edge');
  b+=text(380,y-22,'h ∘ Sum','small')+node(650,y-10,a,a===c?'ok-node':'bad-node',23);
  b+=curve(`M${start+5} ${y+29}C230 ${y+29} 240 ${y+91} 325 ${y+91}`,'comparison-edge');
  b+=text(245,y+67,'Map h','small');
  const target=list(mapped,330,y+62,{cell:42});b+=target.body;
  b+=arrow(335+target.width,y+91,622,y+91,'Sum','comparison-edge')+node(650,y+91,c,a===c?'ok-node':'bad-node',23);
  b+=text(710,y+48,a===c?'=':'≠',a===c?'big ok-text':'big bad-text');
 });
 b+=text(380,650,`h(x)=${k}x+${bias}. 공백 입력의 두 경로는 h(0)와 0을 비교합니다.`,'small');
 return frame(b,680);
}

function drawLens(v){
 const old=+v[0],requested=+v[1],bad=v[2]!== '정상',actual=requested+(bad?1:0);
 let b=text(380,27,'렌즈는 선택한 좌표만 갱신합니다.','heading');
 const x0=150,dx=100,y0=120,dy=100;
 ['Kim','Lee'].forEach((name,r)=>{b+=text(75,y0+r*dy+5,name,'small');for(let s=0;s<=3;s++){b+=circle(x0+s*dx,y0+r*dy,10,'grid-dot');if(r===0)b+=text(x0+s*dx,70,s,'small');}});
 b+=text(350,55,'점수 좌표','small')+text(72,280,'이름 좌표는 유지','small');
 b+=circle(x0+requested*dx,y0,27,'target-ring')+text(x0+requested*dx,165,'요청','small');
 b+=node(x0+old*dx,y0,'전','accent',16);
 if(old!==actual)b+=curve(`M${x0+old*dx} ${y0-20}Q${(x0+old*dx+x0+actual*dx)/2} 30 ${x0+actual*dx} ${y0-20}`,bad?'bad-edge':'ok-edge');
 b+=node(x0+actual*dx,y0,bad?'오류':'후',bad?'bad-node':'ok-node',18);
 const checks=[['get-put',!bad],['put-get',!bad],['put-put',true]];
 checks.forEach(([label,ok],i)=>{const x=150+i*215;b+=circle(x,350,30,ok?'ok-node':'bad-node')+text(x,355,ok?'✓':'×','big')+text(x,402,label,'small');});
 return frame(b,435);
}
const drawers={
 monadalg: drawMonadalg,
 alghom: drawAlghom,
 lens: drawLens
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
