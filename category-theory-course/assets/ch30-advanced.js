(function () {
'use strict';
const calculators = {
 word(v) {const t=v[0]==='ε'?'':v[0],x=v[1]==='ε'?'':v[1],y=v[2]==='ε'?'':v[2],out=[...t].map(c=>c==='x'?x:y).join('');return {rows:[['변수 대입',`x=${x||'ε'}`,`y=${y||'ε'}`],['항의 순서',t||'ε',[...t].map(c=>c==='x'?x||'ε':y||'ε').join(' · ')||'ε'],['모노이드 평가','문자열 연결',out||'ε']],out:`평가 결과=${out||'ε'}. xy=yx는 이론에서 가정하지 않습니다.`};},
 theorylaws(v) {return monoid(v[0]==='덧셈 mod 3');},
 substitute(v) {const cv=s=>s==='ε'?'':s,[t,x,y]=v.map(cv),result=[...t].map(c=>c==='x'?x:y).join('');return {rows:[['치환 튜플',`x↦${x||'ε'}`,`y↦${y||'ε'}`],['원래 항',t,[...t].map(c=>c==='x'?`(${x||'ε'})`:`(${y||'ε'})`).join('')],['합성 사상','동시 치환 결과',result||'ε']],out:`결과 항 ${result||'ε'}. 삽입한 항 내부를 다시 치환하지 않습니다.`};},
};
function monoid(add) {const op=(a,b)=>(a+(add?b:-b)+3)%3;let failures=[],unit=0;for(let a=0;a<3;a++){if(op(0,a)!==a)unit++;if(op(a,0)!==a)unit++;for(let b=0;b<3;b++)for(let c=0;c<3;c++)if(op(op(a,b),c)!==op(a,op(b,c)))failures.push([a,b,c]);}const f=failures[0];return {rows:[['결합법칙 27개',`${27-failures.length}개 통과`,`${failures.length}개 실패`],['좌우 단위 6개',`${6-unit}개 통과`,`${unit}개 실패`],['첫 결합 반례',f?f.join(','):'없음',f?`${op(op(f[0],f[1]),f[2])} ≠ ${op(f[0],op(f[1],f[2]))}`:'유한 운반 전체 통과']],out:!failures.length&&!unit?'이 유한 연산은 모노이드 법칙을 모두 만족합니다.':'같은 연산 타입이어도 모노이드 법칙이 성립하지 않습니다.'};}
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let arrowId='';

const text=(x,y,value,cls='',anchor='middle')=>`<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(value)}</text>`;

const rect=(x,y,w,h,cls='',rx=10)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;

const circle=(x,y,r,cls='')=>`<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;

const line=(x,y,u,v,cls='')=>`<path d="M${x} ${y}L${u} ${v}" class="edge ${cls}"/>`;

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

function opTable(op,x,y,title='연산 표'){
 let b=text(x+100,y,title,'small');
 for(let i=0;i<3;i++){b+=text(x+80+i*46,y+30,i,'small');b+=text(x+25,y+70+i*46,i,'small');for(let j=0;j<3;j++)b+=pill(x+58+j*46,y+47+i*46,43,op(i,j),i===0||j===0?'unit-cell':'');}
 return b;
}

function opTree(a,bnum,c,op,x,y,right=false){
 const inner=right?op(bnum,c):op(a,bnum),result=right?op(a,inner):op(inner,c);
 let b=node(x+90,y,result,'result',22)+node(x+(right?130:50),y+70,inner,'accent',20);
 b+=line(x+90,y+22,x+(right?130:50),y+50);

 // Leaf labels are explicit operands, rather than copies of already evaluated outputs.
 const vals=[a,bnum,c];
 [20,90,160].forEach((dx,i)=>{b+=node(x+dx,y+140,vals[i],'',17);const parent=right?(i===0?[x+90,y+22]:[x+130,y+90]):(i===2?[x+90,y+22]:[x+50,y+90]);b+=line(parent[0],parent[1],x+dx,y+122);});
 return b;
}

function frame(body,height,steps=1,label=''){return {body,height,steps,label};}

function drawWord(v,step){
 const term=v[0]==='ε'?'':v[0],value=c=>(c==='x'?v[1]:v[2])==='ε'?'':(c==='x'?v[1]:v[2]),letters=[...term],evaluated=letters.map(value).join(''),steps=term.length>1?3:term.length?2:1;
 let b=text(380,27,'항의 생성 트리와 대수 해석','heading');
 if(step===2||!term){b+=node(380,150,evaluated||'ε','result',55);b+=text(380,260,'연결 노드를 해석하면 결과 문자열 하나가 남습니다.','small');}
 else{
  const root=term.length>1?'연결':letters[0],positions=letters.map((_,i)=>380+(i-(letters.length-1)/2)*190);
  if(term.length>1){b+=node(380,90,root,'',27);positions.forEach(x=>b+=line(380,118,x,188));}
  letters.forEach((c,i)=>{const x=positions[i];b+=node(x,215,step===0?c:(value(c)||'ε'),step===0?'':`tone${c==='x'?0:1}`,35);if(step===1)b+=text(x,285,`${c}의 해석`,'small');});
  if(step===0)b+=text(380,325,'x와 y는 아직 운반 집합의 값으로 해석하지 않은 변수입니다.','small');
  if(step===1)b+=text(380,325,'변수마다 지정한 문자열로 바꾸고 다음 단계에서 순서대로 연결합니다.','small');
 }
 return frame(b,380,steps,step===0?'변수로 만든 항':step===1?'변수를 문자열로 해석':'연결 연산 접기');
}

function drawTheorylaws(v){
 const add=v[0]==='덧셈 mod 3',op=(a,b)=>(a+(add?b:-b)+3)%3;let bad=[];
 for(let a=0;a<3;a++)for(let c=0;c<3;c++)for(let d=0;d<3;d++)if(op(op(a,c),d)!==op(a,op(c,d)))bad.push([a,c,d]);
 const triple=bad[0]||[0,1,2];let b=text(380,27,'연산 표와 27개 결합법칙 입력의 실제 검사','heading')+opTable(op,35,70,'운반 집합 {0,1,2}');
 b+=text(510,85,'각 칸 = (a,b,c) 한 입력','small');
 for(let i=0;i<27;i++){
  const a=Math.floor(i/9),c=Math.floor(i/3)%3,d=i%3,ok=op(op(a,c),d)===op(a,op(c,d)),x=340+(i%9)*39,y=110+Math.floor(i/9)*48;
  b+=rect(x,y,32,32,ok?'ok-node':'bad-node',4)+text(x+16,y+22,`${a}${c}${d}`,'micro');
 }
 b+=text(375,310,`괄호 비교: a,b,c = ${triple}`,'small');
 b+=opTree(...triple,op,135,360,false)+opTree(...triple,op,445,360,true);
 b+=text(225,548,'(a⋆b)⋆c','small')+text(535,548,'a⋆(b⋆c)','small');
 b+=text(380,590,bad.length?`결합 반례 ${bad.length}개. 같은 함수 타입만으로 법칙은 보장되지 않습니다.`:'27개 입력 전체에서 결합법칙 성립. 표의 0행·0열은 단위 법칙도 보여 줍니다.',bad.length?'bad-text':'ok-text');
 return frame(b,625);
}

function drawSubstitute(v){
 const term=v[0],cv=s=>s==='ε'?'':s,x=cv(v[1]),y=cv(v[2]),letters=[...term],positions=letters.map((_,i)=>380+(i-(letters.length-1)/2)*205);
 let b=text(380,27,'치환은 변수의 위치마다 대입 항의 구조를 복제합니다.','heading');
 b+=node(380,80,'연결','',25);positions.forEach((px,i)=>{const c=letters[i],replacement=c==='x'?x:y;b+=line(380,105,px,135)+node(px,160,c,`tone${c==='x'?0:1}`,22);
  if(!replacement){b+=line(px,185,px,255)+node(px,280,'ε','muted-node',20);}
  [...replacement].forEach((r,j)=>{const tx=px+(j-(replacement.length-1)/2)*65;b+=line(px,185,tx,257)+node(tx,280,r,`tone${c==='x'?0:1}`,21);});
  b+=text(px,335,`${c} ↦ ${replacement||'ε'}`,'small');
 });
 const out=letters.map(c=>c==='x'?x:y).join('');b+=list([...out],145,390,{cell:60,gap:10,label:'치환 후 새 항: 원소 순서 보존'}).body;
 b+=text(380,490,'삽입한 항 안의 변수는 이번 치환에서 다시 바꾸지 않습니다.','small');
 return frame(b,525);
}
const drawers={
 word: drawWord,
 theorylaws: drawTheorylaws,
 substitute: drawSubstitute
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
