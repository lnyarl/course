(function () {
'use strict';
const calculators = {
 span(v) {let a=[['idA','A','A'],['f','A','B'],['idB','B','B']];if(v[0]==='추가')a.push(['g','B','A']);const pairs=[];for(const f of a)for(const g of a)if(f[2]===g[1])pairs.push([`${f[0]} 뒤 ${g[0]}`,`${f[1]}→${f[2]}→${g[2]}`,a.find(h=>h[1]===f[1]&&h[2]===g[2])[0]]);return {rows:pairs,out:`Ar×_Ob Ar = ${pairs.length}쌍. 전체 ${a.length*a.length}쌍 중 ${a.length*a.length-pairs.length}쌍 제외. 표시는 f 후 g, 결과는 g∘f입니다.`};},
 spanmonoid(v) {return monoid(v[0]==='덧셈 mod 3');},
 flatten3(v) {const x=JSON.parse(v[0]),l=x.map(a=>a.flat()),r=x.flat(),out=x.flat(2);return {rows:[['입력 T³',JSON.stringify(x),'μ 두 경로'],['T μ 먼저',JSON.stringify(l),JSON.stringify(l.flat())],['μ T 먼저',JSON.stringify(r),JSON.stringify(r.flat())],['최종 T',JSON.stringify(out),'원소 순서 보존']],out:'두 경로의 결과가 같습니다. μ는 자연변환의 해당 리스트 성분입니다.'};}
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

function drawSpan(v){
 const a=[['idA','A','A'],['f','A','B'],['idB','B','B']];if(v[0]==='추가')a.push(['g','B','A']);
 let b=text(380,27,'같은 중간 끝점에 연결되는 두 화살표만 합성합니다.','heading');
 b+=text(120,65,'첫 화살표 f','small')+text(380,65,'중간 객체','small')+text(635,65,'다음 화살표 g','small');
 a.forEach(([name,dom,cod],i)=>{const yy=110+i*78,cy=cod==='A'?155:290,dy=dom==='A'?155:290;b+=pill(35,yy-17,170,`${name}: ${dom}→${cod}`)+pill(550,yy-17,170,`${name}: ${dom}→${cod}`);b+=curve(`M205 ${yy}C285 ${yy} 285 ${cy} 350 ${cy}`,cod==='A'?'tone0-edge':'tone1-edge')+curve(`M550 ${yy}C475 ${yy} 475 ${dy} 410 ${dy}`,dom==='A'?'tone0-edge':'tone1-edge');});
 b+=node(380,155,'A','tone0',28)+node(380,290,'B','tone1',28);
 const pairs=[];for(const f of a)for(const g of a)if(f[2]===g[1])pairs.push({label:`${f[0]},${g[0]}`,middle:f[2]});
 b+=text(380,442,`당김 Ar×_Ob Ar: ${pairs.length}쌍 (표시는 f, g 순서)`,'small');
 pairs.forEach((p,i)=>{b+=pill(32+(i%4)*182,470+Math.floor(i/4)*52,168,p.label,p.middle==='A'?'tone0':'tone1');});
 b+=text(380,615,'중간 객체가 다른 쌍은 연결 경로 자체가 없습니다.','small');
 return frame(b,650);
}

function drawSpanmonoid(v){
 const add=v[0]==='덧셈 mod 3',op=(a,b)=>(a+(add?b:-b)+3)%3;
 let b=text(380,27,'객체 하나이면 모든 화살표 쌍이 합성 가능합니다.','heading');
 b+=node(175,180,'*','',30);
 [0,1,2].forEach((a,i)=>{const shift=i*50;b+=curve(`M150 ${160-i*3}C${10+shift} ${80-i*20} ${345-shift} ${80-i*20} 200 ${160-i*3}`,`tone${i%2}-edge`)+text(175,98-i*20,`화살표 ${a}`,'small');});
 b+=opTable(op,390,85,'화살표 합성 g⋆f');
 let first=null;for(let a=0;a<3;a++)for(let c=0;c<3;c++)for(let d=0;d<3;d++)if(!first&&op(op(a,c),d)!==op(a,op(c,d)))first=[a,c,d];
 const t=first||[0,1,2];b+=opTree(...t,op,135,340,false)+opTree(...t,op,445,340,true)+text(380,345,first?'≠':'=',first?'big bad-text':'big ok-text');
 b+=text(225,535,'(a⋆b)⋆c','small')+text(535,535,'a⋆(b⋆c)','small');
 b+=text(380,590,first?`반례 ${t}: 쌍은 합성 가능하지만 모나드 결합법칙은 실패합니다.`:'한 객체 위의 화살표와 이 합성은 모노이드를 이룹니다.',first?'bad-text':'ok-text');
 return frame(b,625);
}

function drawFlatten3(v){
 const x=JSON.parse(v[0]),left=x.map(a=>a.flat()),right=x.flat(),out=x.flat(2);
 let b=text(380,27,'같은 원소를 두고 제거하는 리스트 경계만 달라집니다.','heading');
 const top=nestedList(x,220,60);b+=top.body;
 b+=arrow(305,190,180,240,'T μ: 안쪽 경계 제거')+arrow(455,190,555,240,'μ T: 바깥 경계 제거');
 const l=nestedList(left,45,260),r=nestedList(right,440,260);b+=l.body+r.body;
 b+=arrow(180,390,315,455,'μ')+arrow(555,390,450,455,'μ');
 b+=list(out,245,475,{cell:47,label:'같은 List A'}).body;
 b+=text(380,590,'색 테두리 하나가 리스트 한 층입니다. 경계가 사라져도 원소 순서는 유지됩니다.','small');
 return frame(b,625);
}
const drawers={
 span: drawSpan,
 spanmonoid: drawSpanmonoid,
 flatten3: drawFlatten3
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
