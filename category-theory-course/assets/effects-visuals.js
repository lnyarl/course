(function(){"use strict";window.BEffects={mount:function(CH,configs,compute){
const $=id=>document.getElementById(id),esc=MM.esc;

let activeMarker="";
const txt=(x,y,s,c='')=>`<text x="${x}" y="${y}" text-anchor="middle" class="${c}">${esc(String(s))}</text>`;
const rect=(x,y,w,h,c='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="tile ${c}"/>`;
const line=(x1,y1,x2,y2,label='',c='')=>`<path d="M${x1} ${y1}L${x2} ${y2}" class="flow ${c}" marker-end="url(#${activeMarker})"/>`+(label?txt((x1+x2)/2,(y1+y2)/2-10,label,'small'): '');
const card=(x,y,w,title,value,c='')=>rect(x,y,w,68,c)+txt(x+w/2,y+23,title,'small')+txt(x+w/2,y+48,value);
function cellWidth(items){return Math.max(36,items.length?Math.min(64,260/items.length):70,...items.map(v=>String(v).length*8+14));}
function list(x,y,items,label,c=''){
 let w=cellWidth(items);
 let s=txt(Math.max(160,Math.min(620,x+Math.max(70,items.length*(w+5)+12)/2)),y-12,label,'label');
 s+=rect(x,y,Math.max(70,items.length*(w+5)+12),48,'container '+c);
 if(!items.length)return s+txt(x+35,y+30,'∅','small');
 items.forEach((v,i)=>s+=rect(x+6+i*(w+5),y+5,w,38,'element tone'+i%3)+txt(x+6+i*(w+5)+w/2,y+30,v));return s;
}
function mapped(rows,labels,ops){
 let s='';const ys=rows.length===2?[62,230]:[55,175,295];
 rows.forEach((a,j)=>{s+=list(40,ys[j],a,labels[j]);if(j)for(let i=0;i<a.length;i++){const count=rows[j-1].length,w=Math.max(36,Math.min(64,260/count));s+=line(40+6+i*(w+5)+w/2,ys[j-1]+48,40+6+i*(w+5)+w/2,ys[j]-24,'','thin');}if(j)s+=txt(500,(ys[j-1]+ys[j])/2+20,ops[j-1],'label');});return s;
}
function compare(source,left,right,lLabel,rLabel,details=''){
 const center=245+Math.max(70,source.length*(cellWidth(source)+5)+12)/2;let s=list(245,45,source,'공통 입력');s+=line(center-20,98,175,152,lLabel)+line(center+20,98,595,152,rLabel);
 s+=list(40,180,left,lLabel)+list(435,180,right,rLabel);
 s+=txt(380,285,JSON.stringify(left)===JSON.stringify(right)?'두 경로의 결과 =':'두 경로의 결과 ≠','comparison '+(JSON.stringify(left)===JSON.stringify(right)?'good':'bad'));
 if(details)s+=txt(380,325,details,'small');return s;
}
function functionTable(domain,values,observed,op){
 let s=txt(115,25,'입력 B','label')+txt(365,25,'f : B → A','label')+txt(635,25,'관찰 h : A → X','label');
 domain.forEach((d,i)=>{let y=60+i*95;s+=card(35,y,160,'입력',d,'tone'+i)+card(285,y,160,'f('+d+')',values[i],'tone'+i)+card(555,y,160,'h(f('+d+'))',observed[i],'tone'+i)+line(200,y+34,280,y+34,'f')+line(450,y+34,550,y+34,op);});return s;
}
function counts(a,b){
 const ab=b**a,ba=a**b;let s=card(30,35,210,'|A|',a)+card(510,35,210,'|B|',b);
 const grid=(x,y,count,label)=>{let z=txt(x+150,y-15,label+' = '+count,'label');for(let j=0;j<Math.min(count,30);j++){const xx=x+j%10*29,yy=y+Math.floor(j/10)*31;z+=rect(xx,yy,23,23,'element tone'+j%3);}if(!count)z+=txt(x+150,y+25,'함수 없음','small');if(count>30)z+=txt(x+150,y+125,'처음 30개 표시 · 전체 '+count+'개','small');return z;};
 return s+grid(30,160,ab,'Hom(A,B): '+b+'^'+a)+grid(430,160,ba,'Hom(B,A): '+a+'^'+b);
}
function nested(x,y,groups,label,level=2){
 let s=txt(x+160,y-12,label,'label');let cursor=x+9;
 s+=rect(x,y,320,96,'container');
 groups.forEach((group,j)=>{const values=Array.isArray(group)?group:[group],width=Math.max(45,values.length*43+14);s+=rect(cursor,y+12,width,70,'nested tone'+j%3);values.forEach((v,i)=>{s+=rect(cursor+7+i*43,y+29,36,34,'element')+txt(cursor+25+i*43,y+51,v);});if(!values.length)s+=txt(cursor+width/2,y+54,'∅');cursor+=width+8;});return s;
}
function triple(x,y,n){
 let s=rect(x,y,670,110,'container')+txt(x+335,y-12,'M³(A): 두 바깥 그룹 안에 세 내부 리스트','label');
 s+=rect(x+10,y+12,425,86,'nested tone0')+rect(x+445,y+12,215,86,'nested tone1');
 [n,n+1,n+2].forEach((v,i)=>{const xx=x+25+i*215;s+=rect(xx,y+28,180,54,'nested')+rect(xx+66,y+37,48,36,'element tone'+i)+txt(xx+90,y+62,v);});return s;
}
function state(s,bad=false){
 const next=bad?s:s+1,final=next+1;let out=txt(75,26,'입력 상태','label')+txt(350,26,'첫 발급','label')+txt(650,26,'둘째 발급','label');
 out+=card(15,50,120,'s₀',s)+card(255,50,190,bad?'상태 s₁ (버려짐)':'상태 s₁',s+1)+card(555,50,190,'상태 s₂',final)+line(140,84,250,84,'fresh');if(bad){out+=`<path d="M75 120V145H650V120" class="flow" marker-end="url(#${activeMarker})"/>`+txt(380,170,'오류 경로: 최신 s₁ 대신 원래 s₀를 두 번째 fresh에 전달','small');}else out+=line(450,84,550,84,'새 상태 전달');
 out+=card(255,185,190,'반환 번호 a',s,'tone0')+card(555,185,190,'반환 번호 b',next,bad?'failure':'tone1');
 out+=txt(380,305,'값 a+b = '+(s+next)+'    최종 상태 = '+final,'comparison')+txt(380,345,bad?'중복 번호: 최신 상태를 버린 경로':'서로 다른 번호: s₀ → s₁ → s₂','small');return out;
}
function store(n,average=false){
 let s=txt(380,28,'peek(i)=i² · 초점 n='+n+' · 문맥 함수는 이웃 세 칸을 읽음','label');
 for(let j=-2;j<=2;j++){const i=n+j,x=30+(j+2)*145,selected=Math.abs(j)<=1;s+=rect(x,65,125,125,j===0?'focus':selected?'neighbor':'');s+=txt(x+62,92,'위치 '+i,'small')+txt(x+62,132,i*i,'big')+txt(x+62,169,j===0?'현재 초점':selected?'이웃':'문맥 밖','small');}
 const values=[(n-1)**2,n*n,(n+1)**2],sum=values.reduce((a,b)=>a+b,0),result=average?sum/3:sum;
 s+=txt(380,235,(average?'('+values.join(' + ')+') / 3':values.join(' + ')),'comparison')+txt(380,285,'extend(f)의 현재 값 = '+Number(result.toFixed(3)),'comparison')+txt(380,325,'위치 입력을 바꾸면 초점·이웃·새 값이 함께 바뀝니다.','small');return s;
}
function optionTrace(n,mode){
 const first=n%2===0?n/2:null,second=first===null?null:mode==='half'?(first%2===0?first/2:null):first+1;
 let s=card(20,55,130,'입력',n)+line(155,89,230,89,'half');
 s+=`<polygon points="310,35 385,90 310,145 235,90" class="decision"/>`+txt(310,85,'짝수인가?','small')+txt(310,109,n%2===0?'예':'아니요',n%2===0?'good':'bad');
 s+=line(385,90,510,90,first===null?'실패':'성공')+card(515,55,205,'첫 결과',first===null?'None':'Some('+first+')',first===null?'failure':'tone0');
 s+=line(615,130,615,205,first===null?'다음 함수 건너뜀':mode==='half'?'half':'x ↦ Some(x+1)')+card(515,215,205,'최종 결과',second===null?'None':'Some('+second+')',second===null?'failure':'tone1');
 s+=txt(250,265,first===null?'실패 경로만 선택됨':'성공값 '+first+'를 다음 계산에 전달','small');return s;
}
function visual(k,n,m,r){
 const v=[n,n+2],fmt=a=>JSON.stringify(a);let s='';
 if(CH===15){
  if(k===0){const q=m==='plus'?x=>x+1:x=>2*x;s=mapped([v,v.map(q)],['저장한 v ∈ List(A)','α_X(q)=List(q)(v)'],[m==='plus'?'q(x)=x+1':'q(x)=2x']);s+=list(435,275,v,'같은 가족의 별도 id_A 관찰 → decode');}
  if(k===1){const h=x=>x+1,q=m==='double'?x=>2*x:x=>-x;s=compare(v,v.map(x=>q(h(x))),v.map(h).map(q),'α(k∘h)','List(k)∘α(h)');s+=list(435,335,v.map(h),'중간 α(h)');}
  if(k===2){const a=m==='bad'?1:0;s=compare([n],[2*n+a],[2*(n+a)],'α(k∘id)','List(k)∘α(id)','k(x)=2x · 보정 '+a+'가 map과 교환하는가?');}
 }
 if(CH===16){
  if(k===0){const f=[n,n+1],h=m==='plus'?x=>x+10:x=>2*x;s=functionTable(['false','true'],f,f.map(h),m==='plus'?'+10':'×2');s+=list(245,295,f,'별도 id_A 관찰로 복원한 f의 표');}
  if(k===1){const f=[0,n],g=[0,n+1],h=m==='id'?x=>x:()=>0;s=txt(380,25,'같은 관찰 h를 서로 다른 두 f,g에 적용','label')+list(40,70,f,'f의 출력표')+list(435,70,g,'g의 출력표');s+=line(175,125,175,185,'h')+line(570,125,570,185,'h')+list(40,215,f.map(h),'관찰 h∘f')+list(435,215,g.map(h),'관찰 h∘g')+txt(380,325,fmt(f.map(h))===fmt(g.map(h))?'관찰 결과 같음 · 원래 함수가 같다는 뜻은 아님':'관찰이 두 함수를 구별함','comparison');}
  if(k===2){const a=Number(m),count=a**n;s=txt(380,25,'B의 각 입력에서 A 값을 독립적으로 선택','label');let samples=[];for(let z=0;z<Math.min(count,12);z++){let q=z,row=[];for(let j=0;j<n;j++){row.push(q%a);q=Math.floor(q/a);}samples.push(row);}samples.forEach((row,j)=>{s+=txt(45,64+j*25,'f'+j,'small');row.forEach((value,l)=>s+=rect(95+l*72,47+j*25,58,23,'element tone'+l%3)+txt(124+l*72,64+j*25,value,'small'));});s+=card(470,75,250,'Hom(B,A) ↔ Nat(H_A,H_B)',count)+txt(595,200,n===0?'빈 입력표 하나':'각 표는 자연 전처리 변환 하나','small')+txt(595,240,count>12?'12개 표만 표시 · 전체 '+count+'개':'가능한 표 '+count+'개 모두 표시','small');}
 }
 if(CH===17){
  if(k===0){const a=[n,n+1],f=x=>x+1,g=m==='double'?x=>2*x:x=>x*x;s=mapped([a,a.map(f),a.map(f).map(g)],['원본','map f: 각 원소 +1','map g: '+(m==='double'?'두 배':'제곱')],['f','g']);s+=list(435,295,a.map(x=>g(f(x))),'map(g∘f)의 독립 결과');}
  if(k===1){const a=Array.from({length:n},(_,j)=>j),b=a.map(m==='plus'?x=>x+10:()=>0);s=mapped([a,b],['길이 '+n+'인 원본','원소는 바뀌어도 슬롯 수는 '+n],[m==='plus'?'+10':'항상 0']);s+=card(440,100,240,'원본 length = 변환 length',n);}
  if(k===2)s=counts(n,Number(m));
 }
 if(CH===18){
  if(k===0){const val=m==='sum'?n+3:n*3;s=card(35,45,190,'먼저 받은 a',n)+card(35,210,190,'나중에 받은 s',3)+card(335,45,350,'Curry(f)(a): 남은 인자를 기다리는 함수',m==='sum'?'s ↦ '+n+'+s':'s ↦ '+n+'×s')+line(230,79,330,79,'a 고정')+line(225,244,440,254,'s=3 공급')+line(510,115,560,215,'함수 적용')+card(445,220,240,'평가 결과 = f(a,3)',val);}
  if(k===1){const q=Number(m);s=card(20,50,200,'원래 쌍 (a,s)','('+n+','+q+')')+card(300,50,420,'Lη(a,s)=(η(a),s)','(t ↦ ('+n+',t), '+q+')')+line(225,84,295,84,'Lη')+line(510,125,510,215,'ε: 함수에 같은 s 공급')+card(390,225,280,'복원한 쌍','('+n+','+q+')')+txt(205,285,'원래 쌍 = 복원한 쌍','comparison');}
  if(k===2){const q=m==='double'?x=>2*x:x=>-x,val=q(n+4);s=compare([n],[val],[val],'Curry(q∘f∘L(p))','R(q)∘Curry(f)∘p','p(a)=a+1, f(a,s)=a+s, s=3');s+=txt(380,370,'입력 변경과 출력 변경이 커링 왕복과 호환됩니다.','small');}
 }
 if(CH===19){
  if(k===0){const a=[n,3,n],res=m==='sum'?String(2*n+3):a.join('');s=mapped([['a','b','a'],a],['순서를 보존한 자유 단어','생성자별 해석 k'],['k(a)='+n+', k(b)=3']);s+=card(435,230,285,'왼쪽부터 '+(m==='sum'?'덧셈':'문자열 연결'),res)+txt(380,350,'목표 항등: '+(m==='sum'?'0':'빈 문자열')+' · 생성자 순서를 유지합니다.','small');}
  if(k===1){const b=Number(m);s=nested(35,65,[[n,b],[n]],'u와 v의 경계',2)+list(435,65,[n+b,n],'각 그룹을 먼저 fold');s+=line(190,170,190,235,'연결 후 fold')+line(590,130,590,235,'목표 +');s+=card(40,245,250,'fold(u++v)',2*n+b)+card(435,245,285,'fold(u)+fold(v)',2*n+b);}
  if(k===2){const a=m==='bad'?1:0,h=x=>n*x+a;s=card(35,35,280,'단위 보존: h(0) vs 0',h(0)+' vs 0',a?'failure':'tone0')+card(435,35,280,'후보 h(x)',n+'x'+(a?'+1':''))+list(245,145,[2,3],'합 보존의 공통 입력');s+=line(320,200,175,255,'합한 뒤 h')+line(370,200,580,255,'각 h 후 합')+card(40,270,250,'h(2+3)',h(5))+card(435,270,285,'h(2)+h(3)',h(2)+h(3))+txt(380,380,h(5)===h(2)+h(3)?'연산 보존 =':'연산 보존 ≠','comparison');}
 }
 if(CH===20){
  if(k===0)s=optionTrace(n,m);
  if(k===1){const start=m==='none'?null:n,half=x=>x%2===0?x/2:null,res=start===null?null:half(start)===null?null:half(start)+3,a=res===null?'None':'Some('+res+')';s=compare([start===null?'None':'Some('+start+')'],[a],[a],'(m ≫= half) ≫= add','m ≫= (half 다음 add)','중간 Option: '+(start===null||half(start)===null?'None':'Some('+half(start)+')'));}
  if(k===2){const result=m==='bad'?n+1:n;s=compare(['Some('+n+')'],['Some('+result+')'],['Some('+n+')'],'bind(m,pure)','원래 m','pure는 값을 그대로 넣음 · bind가 보정하면 항등 실패');}
 }
 if(CH===21){
  if(k===0)s=state(n,m==='bad');
  if(k===1){const val=2+n,final=val*2;s=txt(45,30,'값','label')+card(75,45,170,'초기',2)+card(320,45,170,'add',val)+card(565,45,170,'double',final)+line(250,79,315,79,'+'+n)+line(495,79,560,79,'×2');s+=txt(45,205,'로그','label')+list(90,190,[],'시작')+list(355,190,['add;'],'첫 로그')+list(485,295,m==='forward'?['add;','double;']:['double;','add;'],'최종 로그 순서');s+=txt(250,350,m==='forward'?'기존 로그 뒤에 새 로그':'역순 연결은 실행 순서와 다름','small');}
  if(k===2){const env=Number(m);s=card(255,20,260,'읽기 전용 환경 E',env,'focus')+line(335,92,185,160,'같은 e')+line(435,92,595,160,'같은 e')+card(45,180,280,'첫 계산: e+n',env+n)+card(435,180,280,'다음 계산: a×e',(env+n)*env)+line(330,215,430,215,'값 a 전달')+txt(380,315,'환경은 갱신하지 않고 양쪽에 공유합니다.','comparison');}
 }
 if(CH===22){
  if(k===0){s=triple(35,45,n)+nested(20,230,m==='outer'?[[n],[n+1],[n+2]]:[[n,n+1],[n+2]],m==='outer'?'먼저 바깥 경계 제거: μ_MA':'먼저 안쪽 경계 제거: Mμ_A')+list(435,255,[n,n+1,n+2],'남은 경계 제거: 같은 최종 M(A)')+line(200,158,180,205,'첫 중첩 제거')+line(345,278,430,278,'μ_A');}
  if(k===1){const a=[n,n+1],groups=m==='outer'?[a]:a.map(x=>[x]);s=list(35,60,a,'원래 M(A)')+nested(400,60,groups,m==='outer'?'η_MA: 전체를 한 번 감쌈':'Mη_A: 각 원소를 따로 감쌈')+line(560,175,560,240,'μ_A: 경계 제거')+list(435,275,a,'원래 슬롯으로 복원');}
  if(k===2){const a=[[n],[n+1,n+2]],h=m==='double'?x=>2*x:x=>x+10;s=nested(20,50,a,'원래 M²(A)')+nested(410,50,a.map(x=>x.map(h)),'경계를 유지한 map(map(h))');s+=line(180,160,180,245,'μ_A 후 map(h)')+line(570,160,570,245,'μ_B');s+=list(40,280,a.flat().map(h),'아래 경로 결과')+list(435,280,a.flat().map(h),'위 경로 결과');}
 }
 if(CH===23){
  if(k===0)s=store(n,m==='average');
  if(k===1){const t=Number(m);s=txt(380,24,'같은 Store w=(peek, '+n+')에서 두 법칙을 따로 관찰','label');for(let row=0;row<3;row++){let yy=75+row*100;s+=txt(120,yy+30,['원래 w','extract ∘ duplicate','map(extract) ∘ duplicate'][row],'small');for(let j=-1;j<=1;j++){const pos=n+j,xx=310+(j+1)*130;s+=rect(xx,yy,110,66,j===0?'focus':'')+txt(xx+55,yy+23,'키 '+pos,'small')+txt(xx+55,yy+48,'값 '+pos*pos,'small');}}s+=txt(380,405,'현재 초점 '+n+' 유지 · 별도 peek('+t+') = '+t*t+'로 양 경로 동일','comparison');}
  if(k===2){const a=Array.from({length:n},(_,j)=>j+1);s=list(80,85,a,'입력 리스트 · 첫 슬롯이 초점 후보');if(n)s+=`<path d="M104 65V35" class="flow"/>`+txt(105,25,'extract','label')+card(435,90,280,'첫 값',1,'focus');else s+=card(435,90,280,'현재 슬롯 없음',m==='fallback'?'별도 int 기본값 0':'extract 정의 불가','failure');s+=txt(380,255,n?'첫 값은 존재하지만 코모나드 법칙 전체의 증명은 아님':'비어 있는 List(A)는 어떤 A 값도 제공하지 않음','comparison')+txt(380,305,n?'빈 리스트 입력과 직접 비교하세요.':'임의 0은 A=int의 별도 정책이며 일반 extract가 아닙니다.','small');}
 }
 return s;
}
configs.forEach((cfg,k)=>{
 const p='b'+(k+1),input=$(p+'-input'),mode=$(p+'-mode'),stage=$(p+'-diagram'),output=$(p+'-output');
 function draw(){
 const raw=input.value,noneInput=CH===20&&k===1&&mode.value==='none',n=noneInput?0:Number(raw);
 input.disabled=noneInput;
 input.title=noneInput?'None에는 계산할 값이 없습니다. Some을 선택하면 값을 바꿀 수 있습니다.':'';
 const valid=noneInput||(raw.trim()!==''&&Number.isInteger(n)&&n>=cfg.min&&n<=cfg.max);
 mode.disabled=CH===23&&k===2&&valid&&n>0;
 mode.title=mode.disabled?'빈 리스트일 때만 실패 정책을 비교합니다.':'';
 if(!valid){stage.textContent='입력 오류';output.textContent=`정수 ${cfg.min}…${cfg.max} 범위의 값을 입력하세요.`;return;}
 const r=compute(k,n,mode.value),height=(CH===23&&k===1)?440:410;
 activeMarker=p+'-arrow';stage.innerHTML=`<svg viewBox="0 0 760 ${height}" role="img" aria-label="${esc(cfg.title+' · '+r.result)}"><title>${esc(cfg.title)}</title><defs><marker id="${activeMarker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="arrowhead"/></marker></defs>${visual(k,n,mode.value,r)}</svg>`;
 output.textContent=r.result+'\n'+r.explain;
 }
 input.addEventListener('input',draw);mode.addEventListener('change',draw);draw();
});}};})();
