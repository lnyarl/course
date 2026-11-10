/* Linux 6.18: IRQ, concurrency and memory. Geometry illustrates causal state, not measured time. */
(function(D,A){
'use strict';
const R=D.rect,T=D.text,L=D.line,C=D.circle;
const wrap=(value,width)=>{let lines=[''],used=0;for(const ch of String(value)){if(ch==='\n'){lines.push('');used=0;continue;}const cost=ch.charCodeAt(0)>255?16:9;if(used+cost>width&&lines.at(-1)){lines.push('');used=0;}lines[lines.length-1]+=ch;used+=cost;}return lines.join('\n');};
const box=(k,x,y,w,h,value,tone='blue')=>{const title=wrap(value,w-20),count=title.split('\n').length;return[R(k,x,y,w,h,tone),T(k+'-label',x+w/2,y+h/2+6-(count-1)*11.2,title,16,'middle')];};
const headings=(shapes,keys)=>{for(const key of keys){const r=shapes.find(s=>s.key===key),t=shapes.find(s=>s.key===key+'-label');if(r&&t){t.attrs.x=r.attrs.x+12;t.attrs.y=r.attrs.y+24;t.attrs['text-anchor']='start';}}};
const dot=(k,x,y,label,tone='blue',r=20)=>[C(k,x,y,r,tone),T(k+'-label',x,y+5,label,15,'middle')];
const arrow=(k,x,y,u,v,tone='muted',dash='')=>L(k,x,y,u,v,tone,true,dash);
const label=(k,x,y,value,tone='ink')=>T(k,x,y,value,16,'start',tone);
const figure=(after,title,caption,height,shapes)=>({after,title,caption,width:900,height,shapes});
const options=(label,a,b)=>[{id:'scenario',label,value:a[0],options:[{value:a[0],label:a[1]},{value:b[0],label:b[1]}]}];
const lane=(k,y,name)=>[label(k+'-name',24,y+25,name),L(k+'-line',150,y+31,866,y+31,'muted',false,'5 5')];
const cellRow=(key,x,y,n,w,h,labels,tone)=>Array.from({length:n},(_,i)=>box(key+i,x+i*w,y,w-5,h,labels[i]??'',typeof tone==='function'?tone(i):tone||'blue')).flat();

A[9]={figures:[
 figure(1,'같은 CPU, 서로 다른 커널 진입 원인','가로축은 실행 순서입니다. syscall은 요청, fault는 현재 명령의 예외, IRQ는 외부 장치의 알림입니다. 시간 길이는 실측이 아닙니다.',330,[
  ...lane('u',45,'사용자 코드'),...lane('k',160,'커널'),
  ...box('u1',165,45,150,54,'계산','blue'),...box('u2',365,45,150,54,'주소 접근','blue'),...box('u3',665,45,150,54,'다른 계산','blue'),
  ...box('sys',185,175,130,50,'서비스 처리','purple'),...box('fault',390,175,150,50,'fault 해결','orange'),...box('irq',675,175,150,50,'장치 핸들러','green'),
  arrow('s1',220,99,220,175,'purple'),label('sl',160,140,'의도한 syscall','purple'),arrow('f1',440,99,440,175,'orange'),label('fl',370,140,'접근에서 예외','orange'),
  arrow('i1',850,270,780,225,'green'),label('il',615,288,'장치 사건 → 현재 명령과 별개','green'),arrow('back',315,200,345,80,'purple')]),
 figure(2,'큐·인터럽트 벡터·CPU의 연결','장치 큐가 여러 벡터를 제공할 수 있습니다. IRQ affinity와 task affinity는 서로 다른 연결을 제한합니다.',350,[
  label('dev',30,30,'NIC 수신 큐'),...cellRow('q0',30,60,4,48,40,['0','1','2','3'],'blue'),...cellRow('q1',30,165,4,48,40,['4','5','6','7'],'purple'),
  label('q0l',35,130,'큐 0'),label('q1l',35,235,'큐 1'),...box('controller',350,80,170,130,'IRQ 컨트롤러','muted'),
  arrow('q0v',225,80,350,105,'blue'),arrow('q1v',225,185,350,180,'purple'),label('v0',245,65,'벡터 A'),label('v1',245,215,'벡터 B'),
  ...box('cpu0',675,50,170,65,'CPU 0','blue'),...box('cpu1',675,175,170,65,'CPU 1','purple'),arrow('vc0',520,110,675,83,'blue'),arrow('vc1',520,180,675,208,'purple'),
  label('aff',550,280,'IRQ를 받을 CPU 집합'),label('task',30,315,'task의 실행 CPU 제한은 별도 정책입니다.')]),
 figure(5,'패킷 8개와 IRQ 2번은 모순이 아니다','원은 패킷, 세로 화살표는 알림입니다. 묶음 처리는 알림 비용을 줄이지만 첫 항목의 대기 시간이 늘 수 있습니다.',320,[
  label('batch1',30,35,'묶음 1: 패킷 0–3'),label('batch2',470,35,'묶음 2: 패킷 4–7'),
  R('br1',25,48,390,80,'blue'),R('br2',465,48,390,80,'purple'),
  ...Array.from({length:8},(_,i)=>dot('front'+i,70+(i<4?i:i-4)*90+(i<4?0:440),85,''+i,i<4?'blue':'purple')).flat(),
  arrow('irq1',220,130,220,200,'blue'),arrow('irq2',660,130,660,200,'purple'),...box('handler1',130,200,180,55,'알림 1회','blue'),...box('handler2',570,200,180,55,'알림 1회','purple'),
  label('sum',170,295,'처리량 8패킷 ≠ IRQ 카운터 증가 2회')]),
 figure(10,'응답 지연을 네 구간으로 분리','40+5+10+15=70이라는 개념 예시입니다. 장치 처리만 절반으로 줄여도 전체는 50으로 줄 뿐입니다.',300,[
  label('axis',30,35,'사건 시작 → 사용자 코드 재개'),
  ...box('device',30,65,440,70,'장치 40','blue'),...box('irqwait',470,65,60,70,'5','orange'),...box('defer',530,65,110,70,'10','purple'),...box('runq',640,65,165,70,'15','green'),
  arrow('irqwl',500,140,500,190,'orange'),label('iw',405,220,'IRQ 진입 대기'),arrow('dwl',585,140,660,190,'purple'),label('dw',620,245,'후속 처리 대기'),arrow('rwl',735,140,795,190,'green'),label('rw',700,220,'CPU 재획득'),
  label('speed',30,270,'장치 최적화 이후: 20 + 5 + 10 + 15 = 50')])],
 scene:{after:9,title:'IRQ가 pending에 남았다가 CPU로 전달되는 순간',intro:'로컬 마스킹을 비교하며 장치 알림과 실행 task가 서로 다른 경로로 움직이는 것을 보세요.',width:900,height:460,
 controls:options('로컬 IRQ 상태',['masked','잠시 마스킹 후 해제'],['open','처음부터 허용']),
 build(v){const delayed=v.scenario==='masked',enter=delayed?5:3;return Array.from({length:8},(_,f)=>{
  const pos=f===0?[85,115]:f<enter?[370,115]:f===enter?[620,115]:[765,240];
  const handling=f>=enter&&f<7, task=handling?[720,375]:[725,115];
  const shapes=[...box('device',20,60,160,110,'장치','blue'),...box('pending',285,60,180,110,'pending','orange'),...box('cpu',585,45,270,260,'CPU','muted'),
   label('userlane',600,78,'사용자 실행'),label('irqlane',600,205,'IRQ 핸들러'),L('split',590,175,850,175,'muted',false,'5 5'),
   ...box('saved',625,320,225,80,'보존된 task 상태','purple'),arrow('route1',180,115,285,115),arrow('route2',465,115,585,115),
   ...dot('irq-token',pos[0],pos[1],'IRQ',f>=enter?'green':'orange',24),...dot('task-token',task[0],task[1],'A','blue',23),
   label('masklabel',270,220,delayed&&f<enter?'로컬 IRQ 마스크 닫힘':'로컬 IRQ 마스크 열림',delayed&&f<enter?'red':'green')];
  headings(shapes,['device','pending','saved']);const cpuTitle=shapes.find(s=>s.key==='cpu-label');cpuTitle.attrs.x=825;cpuTitle.attrs.y=70;cpuTitle.attrs['text-anchor']='end';
  if(delayed&&f<enter)shapes.push(R('gate',520,82,10,66,'red'));
  if(f===7){for(const shape of shapes)if(shape.key==='irq-token'||shape.key==='irq-token-label')shape.attrs.opacity=0;}
  if(f===7)shapes.push(label('done',30,420,'핸들러 종료 → 보존한 실행을 재개','green'));
  return {label:['장치에서 사건 발생','컨트롤러에 도착',delayed?'알림을 보류':'CPU 전달 준비',delayed?'CPU는 A 실행 지속':'핸들러 진입',delayed?'마스크 해제 직전':'장치 상태 처리',delayed?'마스크 해제·진입':'후속 처리 예약','핸들러 완료 준비','사용자 실행 재개'][f],note:delayed&&f<enter?'장치 사건이 존재해도 로컬 CPU가 아직 처리하지 않습니다. 장치 자체가 멈춘다는 뜻은 아닙니다.':handling?'IRQ token이 핸들러로 들어오고 A의 실행 상태를 보존합니다. 다른 task로의 전환을 반드시 뜻하지 않습니다.':'한 알림의 경로입니다. 실제 장치의 합침·누락·큐 정책은 별도입니다.',shapes,stats:[['pending',f>0&&f<enter?'1':'0'],['CPU 실행',handling?'IRQ handler':'task A']]};});},observe:['IRQ 마스킹은 현재 CPU의 전달 조건입니다.','알림이 보류되는 동안 task A와 장치는 서로 다른 상태를 가집니다.'],assumptions:'마스킹 가능한 IRQ 하나가 유지되는 비 RT 개념 모델. NMI·중첩·다른 CPU와 실제 장치별 알림 손실 정책은 생략합니다.'}}
;

A[10]={figures:[
 figure(2,'실행 문맥과 sleep 가능한 구간','시간 줄의 빈 구간은 대기입니다. hardirq/softirq에서 일반적인 블로킹 sleep을 허용한다고 해석하지 않습니다.',330,[
  ...lane('hard',40,'hard IRQ'),...lane('soft',125,'softirq'),...lane('worker',210,'worker'),
  ...box('hardrun',160,40,170,45,'짧은 처리','orange'),...box('softrun',160,125,300,45,'후속 처리','purple'),...box('workrun1',160,210,180,45,'준비','blue'),...box('workrun2',620,210,180,45,'재개','green'),
  L('sleep',345,232,615,232,'muted',false,'8 8'),label('sleepl',410,285,'조건 대기: CPU 양보'),label('hno',380,72,'sleep 불가 · 비 RT 기준','red'),label('sno',510,155,'일반 sleep 불가','red')]),
 figure(4,'논리 큐와 worker pool은 다른 층','서로 다른 workqueue가 worker pool을 공유할 수 있습니다. 큐 하나가 곧 전용 스레드 하나라는 뜻은 아닙니다.',350,[
  label('qa',30,30,'논리 큐 A'),...cellRow('a',30,50,3,65,42,['A1','A2','A3'],'blue'),label('qb',30,155,'논리 큐 B'),...cellRow('b',30,175,3,65,42,['B1','B2','B3'],'purple'),
  R('pool',390,30,465,245,'muted'),label('pooll',410,60,'공유 worker pool'),...box('w0',425,95,170,70,'worker 0','green'),...box('w1',650,95,170,70,'worker 1','green'),
  arrow('queueA-worker0',230,72,425,125,'blue'),arrow('queueB-worker1',230,197,650,140,'purple'),label('bind',420,225,'binding·동시성·순서 옵션은 별도'),label('bh',30,315,'BH workqueue는 이 worker-thread 그림과 다른 softirq 문맥입니다.')]),
 figure(5,'동기 취소도 락 의존성을 만든다','종료 경로가 L을 가진 채 W의 종료를 기다리고, W가 L을 기다리면 순환입니다. 작업 취소 API만 호출해도 자동 해결되지 않습니다.',350,[
  ...box('teardown',45,70,240,110,'종료 경로','blue'),...box('work',615,70,240,110,'work W','purple'),...box('lock',345,220,210,65,'락 L','orange'),
  arrow('owns',270,180,365,220,'blue'),label('ownsl',205,220,'보유'),arrow('await',620,185,535,220,'purple'),label('awaitl',590,220,'획득 대기'),arrow('finish',285,100,615,100,'red'),label('finishl',345,75,'W 완료 대기','red'),
  label('cycle',160,325,'종료 경로 → W 종료 → L 해제 → 종료 경로: 순환 의존성')]),
 figure(7,'예약 시각·실행 가능 시각·실제 시작','delayed work의 지연 조건이 끝나도 worker를 기다릴 수 있습니다. 콜백 실행 시간과 큐 대기를 나누어 측정합니다.',280,[
  L('axis',60,150,850,150,'muted',true),...box('delay',80,85,280,45,'타이머 지연','blue'),...box('queuewait',360,85,200,45,'worker 대기','orange'),...box('worktime',560,85,250,45,'콜백 실행','green'),
  ...[80,360,560,810].map((x,i)=>L('tick'+i,x,135,x,175,'ink')),label('t0',50,210,'예약'),label('t1',300,210,'지연 조건 충족'),label('t2',525,240,'실제 시작'),label('t3',780,210,'완료')])],
 scene:{after:5,title:'작업이 참조하는 객체는 언제 해제할 수 있을까',intro:'work W를 예약한 뒤 장치 객체 D를 정리합니다. 먼저 해제하는 경로와 완료를 기다리는 경로를 비교하세요.',width:900,height:480,
 controls:options('종료 순서',['safe','새 등록 차단 → 완료 → 해제'],['early','queued 상태에서 먼저 해제']),
 build(v){const safe=v.scenario==='safe';return Array.from({length:8},(_,f)=>{
  const x=[75,245,330,420,535,650,735,790][f],y=f<4?120:f<6?260:380;
  const freed=safe?f>=7:f>=3, using=f===4||f===5;
  const shapes=[label('producerlabel',25,40,'새 작업 등록'),...box('producer',20,65,150,100,'producer','blue'),R('queue',215,65,280,100,'muted'),label('queuelabel',250,95,'대기 큐'),
   ...box('worker',540,205,315,110,'worker','purple'),...box('done',650,340,200,80,'완료 영역','green'),...box('memory',40,265,390,140,'객체 저장 공간','muted'),
   ...box('object',125,310,210,60,freed?'반환된 공간':'객체 D',freed?'red':'green'),...dot('work-token',x,y,'W',!safe&&using?'red':'blue',23),arrow('toref',x,y+24,230,310,freed?'red':'green','5 4'),
   label('closed',20,215,f>=2?'새 등록 차단됨':'등록 가능',f>=2?'orange':'green')];
  headings(shapes,['producer','worker','done','memory']);
  if(f>=6){const ref=shapes.findIndex(s=>s.key==='toref');if(ref>=0)shapes.splice(ref,1);}
  if(freed)shapes.push(L('cross1',125,310,335,370,'red'),L('cross2',125,370,335,310,'red'));
  return {label:['W 생성','큐에 W 등록','종료 시작·새 등록 차단',safe?'D를 유지하며 W 대기':'D를 먼저 해제',safe?'W가 D를 사용':'해제 후 D 접근 위험',safe?'W 사용 종료':'이미 수명 계약 위반','W 완료 확인',safe?'이제 D 해제':'정상 완료로 복구되지 않음'][f],note:!safe&&f>=3?'W의 포인터 값이 남아 있어도 D의 수명은 끝났습니다. 이 모델은 위험 지점을 표시하며 실제 오류 결과는 예측하지 않습니다.':'큐 등록과 객체 수명은 별도입니다. 작업이 D 사용을 끝낸 뒤 해제하고 재등록 경로도 차단해야 합니다.',shapes,stats:[['D 수명',freed?'종료':'유지'],['W',f<4?'queued':f<6?'running':'completed']]};});},observe:['점선 참조가 남아 있는데 객체 공간이 해제되는 순간을 찾으세요.','동기 취소·대기를 할 때 W가 필요로 하는 락을 보유하지 않아야 합니다.'],assumptions:'하나의 work와 참조 객체를 사용한 개념 수명 모델. 실제 cancel·flush API의 경합과 반환 의미는 해당 API 계약을 확인합니다.'}}
;
A[11]={figures:[
 figure(1,'보호 대상은 count 하나가 아니라 관계','리스트 항목 수와 count가 같다는 불변식을 함께 보호합니다. 중간 상태를 독자가 보지 않도록 갱신 범위를 정합니다.',340,[
  R('critical',35,45,570,220,'blue'),label('critlabel',55,77,'하나의 임계 구역'),...box('n0',75,115,110,65,'노드 A','green'),...box('n1',255,115,110,65,'노드 B','green'),...box('n2',435,115,110,65,'노드 C','green'),
  arrow('next0',185,147,255,147),arrow('next1',365,147,435,147),...box('count',665,100,170,85,'count = 3','orange'),arrow('relation',545,212,665,155,'orange'),label('reltext',265,240,'실제 항목 수 = count'),
  label('danger',40,305,'count만 atomic이어도 리스트 공개 순서·수명은 별도입니다.')]),
 figure(2,'두 증가가 하나로 사라지는 interleaving','세로축은 순서입니다. 두 CPU의 로컬 읽기 값이 모두 0이면 서로 다른 계산이 같은 1을 덮어씁니다.',380,[
  label('a',80,30,'CPU A'),label('m',390,30,'공유 count'),label('b',725,30,'CPU B'),L('al',120,50,120,315),L('ml',450,50,450,315),L('bl',780,50,780,315),
  arrow('readA',450,80,120,100,'blue'),label('ra',180,78,'0 읽기'),arrow('readB',450,125,780,145,'purple'),label('rb',535,122,'0 읽기'),
  arrow('writeA',120,190,450,210,'blue'),label('wa',190,185,'1 쓰기'),arrow('writeB',780,250,450,270,'purple'),label('wb',545,245,'1 쓰기'),
  ...box('end',345,315,210,45,'최종 1 ≠ 기대 2','red')]),
 figure(5,'ABBA: 보유 간선과 대기 간선','실선은 보유, 점선은 획득 대기입니다. CPU 수가 늘어도 이 순환 의존성은 사라지지 않습니다.',360,[
  ...dot('a',170,95,'A','blue',40),...dot('b',730,255,'B','purple',40),...box('l1',625,60,170,65,'락 L1','orange'),...box('l2',85,220,170,65,'락 L2','orange'),
  arrow('ownA',215,95,625,95,'blue'),label('oa',355,78,'A가 보유'),arrow('waitB',730,210,730,125,'purple','6 5'),label('wb',765,175,'대기'),arrow('ownB',685,255,255,255,'purple'),label('ob',350,287,'B가 보유'),arrow('waitA',170,140,170,220,'blue','6 5'),label('wa',70,185,'대기'),
  label('cycle',315,335,'A → L2 → B → L1 → A')]),
 figure(6,'우선순위가 높아도 락 소유자가 진행해야 한다','H는 L의 락을 기다립니다. 중간 우선순위 M이 L을 밀어내면 H도 기다리는 구간이 길어질 수 있습니다.',330,[
  ...lane('h',40,'높음 H'),...lane('m',130,'중간 M'),...lane('l',220,'낮음 L'),...box('hwait',250,40,570,45,'락 대기 → CPU 우선순위만 높여도 해결되지 않음','red'),
  ...box('mrun',280,130,410,45,'M 실행','orange'),...box('lfirst',160,220,120,45,'L 획득','blue'),...box('llast',690,220,130,45,'L 해제','green'),
  arrow('hlock',250,85,250,220,'red','5 4'),label('explain',200,310,'필요한 진행: L이 실행되어 락을 해제해야 H도 진행')])],
 scene:{after:2,title:'로컬 읽기 값이 공유 카운터로 돌아오는 과정',intro:'같은 read-modify-write를 mutex로 묶었을 때 B가 읽는 값 자체가 바뀌는지 확인하세요.',width:900,height:470,
 controls:options('증가 보호',['unlocked','보호 없는 interleaving'],['locked','증가 전체를 mutex로 보호']),
 build(v){const locked=v.scenario==='locked';return Array.from({length:8},(_,f)=>{
  const shared=locked?(f===7?2:f>=4?1:0):(f>=4?1:0);
  const ax=[680,240,240,415,680,610,610,610][f],ay=f>=5?385:f>=1&&f<=3?112:190;
  const bx=locked?[820,820,140,140,140,240,415,820][f]:[820,820,240,240,240,415,820,820][f];
  const by=locked?(f>=2&&f<=6?292:210):(f>=2&&f<=5?292:210);
  const av=f>=3?1:0,bv=locked?(f>=6?2:f>=5?1:0):(f>=5?1:0);
  const shapes=[...lane('a',80,'실행 A'),...lane('b',260,'실행 B'),...box('memory',650,140,200,100,'공유 count','muted'),T('value',760,215,''+shared,28,'middle','ink'),
   ...box('localA',185,60,300,90,'A의 로컬 계산','blue'),...box('localB',185,240,300,90,'B의 로컬 계산','purple'),
   ...dot('a-value',ax,ay,'A:'+av,'blue',29),...dot('b-value',bx,by,'B:'+bv,locked&&f>=2&&f<=4?'orange':'purple',29),
   label('mutex',30,385,locked?(f>=1&&f<=3?'mutex 소유: A':f>=5&&f<=6?'mutex 소유: B':'mutex 해제'):'mutex 없음',locked?'green':'red'),
   label('outcome',330,430,f===7?'최종 count = '+shared+' / 의도한 증가 2회':'읽기 → 로컬 +1 → 공유 값 쓰기',f===7&&shared!==2?'red':'ink')];
  headings(shapes,['memory','localA','localB']);
  return {label:['공유 count = 0','A가 0을 읽음',locked?'B는 mutex 앞에서 대기':'B도 0을 읽음','A 로컬 값 +1','A가 1을 씀',locked?'A 해제 후 B가 1을 읽음':'B 로컬 값 +1',locked?'B 로컬 값은 2':'B가 1을 덮어씀',locked?'B가 2를 씀':'갱신 하나가 사라짐'][f],note:locked?'보호 범위는 쓰기 한 줄이 아니라 읽기부터 쓰기까지입니다. B가 읽는 시점을 바꾸어 다른 결과를 만듭니다.':'명시적 읽기·쓰기의 추상 interleaving입니다. 실제 락 없는 C 데이터 경쟁의 가능한 결과 전체를 예측하지 않습니다.',shapes,stats:[['공유값',String(shared)],['B 대기',locked&&f>=2&&f<=4?'예':'아니오']]};});},observe:['토큰 안의 값은 각 실행 주체가 읽은 로컬 사본입니다.','mutex 경로에서는 B가 0이 아니라 1을 읽습니다.'],assumptions:'두 task가 각 1회 증가하는 순서 모델. 실제 C의 데이터 경쟁은 undefined behavior이며 이 숫자가 그 결과 범위를 보장하지 않습니다.'}}
;
A[12]={figures:[
 figure(2,'준비 데이터와 ready 게시의 순서','release 게시와 그 게시를 관찰한 acquire가 필요한 순서를 연결합니다. 캐시 일관성만으로 여러 위치의 순서가 자동 해결되지는 않습니다.',350,[
  label('p',95,30,'생산자 P'),label('c',630,30,'소비자 C'),L('pl',175,50,175,285),L('cl',715,50,715,285),
  ...box('data',65,65,220,50,'data = 42','blue'),...box('release',65,165,220,50,'ready = 1 · release','purple'),...box('acquire',595,165,240,50,'ready 관찰 · acquire','purple'),...box('read',595,260,240,50,'그다음 data 읽기','green'),
  arrow('order1',175,120,175,160,'blue'),arrow('pub',285,190,595,190,'purple'),label('publ',340,165,'이 게시를 관찰'),arrow('order2',715,220,715,255,'green')]),
 figure(3,'서로 다른 변수도 같은 캐시 라인을 공유한다','왼쪽은 두 CPU가 한 라인의 소유권을 경쟁하는 배치입니다. 오른쪽 패딩은 경합을 줄이는 대신 공간을 더 사용합니다.',350,[
  ...box('cpuA',35,40,150,55,'CPU A','blue'),...box('cpuB',285,40,150,55,'CPU B','purple'),R('line',35,160,400,70,'orange'),...box('x',50,175,100,40,'X','blue'),...box('y',155,175,100,40,'Y','purple'),label('unused',285,203,'같은 라인'),arrow('ax',110,95,100,175,'blue'),arrow('by',355,95,210,175,'purple'),
  label('shared',45,265,'소유권 A ↔ B 이동 가능'),...box('lineX',515,95,330,60,'라인 1: X + 패딩','blue'),...box('lineY',515,205,330,60,'라인 2: Y + 패딩','purple'),label('pad',515,315,'별도 라인: 공간·캐시 풋프린트 증가')]),
 figure(6,'목록 연결 제거와 객체 해제는 다른 사건','새 탐색은 B를 건너뛰어도 기존 reader가 B를 읽을 수 있습니다. 점선은 제거 후에도 남은 읽기 참조입니다.',350,[
  ...box('a',40,80,140,75,'A','blue'),...box('b',350,80,140,75,'B · 옛 노드','orange'),...box('c',690,80,140,75,'C','green'),arrow('oldAB',180,115,350,115,'muted','5 5'),arrow('oldBC',490,115,690,115,'muted','5 5'),
  L('top1',110,75,110,35,'green'),L('top2',110,35,760,35,'green'),arrow('top3',760,35,760,75,'green'),label('newlink',280,25,'갱신 후 A.next = C','green'),
  ...dot('reader',420,270,'R','purple',30),arrow('refB',420,235,420,155,'purple','6 4'),label('keep',495,270,'R이 끝날 때까지 B 유지'),label('end',40,325,'제거 → 기존 읽기 구간 종료 확인 → 회수')]),
 figure(9,'낮은 읽기 비용과 옛 버전의 메모리 수명','세로 막대는 회수를 기다리는 옛 객체입니다. 갱신이 계속되는 동안 grace period가 길면 보유 메모리가 늘 수 있습니다.',350,[
  L('axisx',75,280,835,280,'ink',true),L('axisy',75,280,75,45,'ink',true),label('yl',20,25,'대기 객체'),label('xl',735,320,'개념 시간'),
  ...Array.from({length:6},(_,i)=>[R('bar'+i,125+i*110,280-(i+1)*30,65,(i+1)*30,'orange'),T('num'+i,157+i*110,270-(i+1)*30,''+(i+1),16,'middle')]).flat(),
  label('formula',150,55,'도착률 × 평균 보유 시간 ≈ 대기 객체 수'),label('note',140,345,'실제 RCU 구현의 회수율·지연 예측 그래프는 아닙니다.')])],
 scene:{after:5,title:'포인터를 교체해도 기존 reader의 객체는 남는다',intro:'기존 reader가 빨리 끝나는 경우와 오래 읽는 경우를 비교합니다. 새 reader는 새 버전을 읽어도 옛 객체는 즉시 해제하지 않습니다.',width:900,height:480,
 controls:options('기존 reader',['slow','기존 reader가 오래 유지'],['fast','기존 reader가 일찍 종료']),
 build(v){const end=v.scenario==='fast'?4:6;return Array.from({length:8},(_,f)=>{
  const published=f>=2,oldReading=f>=1&&f<end,reclaimed=f>=end+1;
  const r1x=f===0?70:f<end?300:100,r1y=f===0?100:f<end?200:395;
  const r2x=f<3?70:f<7?690:790,r2y=f<3?300:f<7?200:395;
  const shapes=[...box('pointer',355,35,190,60,published?'현재 → 새 버전':'현재 → 옛 버전','purple'),...box('old',190,150,220,100,reclaimed?'회수된 옛 공간':'옛 객체 O',reclaimed?'muted':'orange'),...box('new',570,150,220,100,'새 객체 N','green'),
   arrow('current-ref',450,95,published?680:300,150,'purple'),...box('exit',30,355,830,75,'읽기 구간 종료 영역','muted'),...dot('reader-old',r1x,r1y,'R1','blue',25),...dot('reader-new',r2x,r2y,'R2','purple',25),
   label('grace',210,310,reclaimed?'기존 reader 종료 확인 뒤 회수':oldReading?'기존 R1이 아직 O를 읽음':'필요한 기존 읽기 구간 종료',reclaimed?'green':'orange')];
  headings(shapes,['old','new']);
  if(oldReading)shapes.push(arrow('old-ref',r1x,r1y+26,345,240,'blue','5 4'));
  if(f>=3&&f<7)shapes.push(arrow('new-ref',r2x,r2y+26,735,240,'purple','5 4'));
  if(reclaimed)shapes.push(L('reclaimedx',205,160,395,240,'red'));
  return {label:['갱신 전','R1이 옛 포인터를 얻음','새 객체 게시','R2는 새 객체 읽기',fAt(4,end),fAt(5,end),fAt(6,end),'회수 후에도 새 읽기는 가능'][f],note:oldReading?'현재 포인터를 바꿔도 R1이 얻은 옛 포인터는 사라지지 않습니다. O를 아직 해제하면 안 됩니다.':reclaimed?'필요한 기존 읽기 구간이 끝난 뒤 회수하는 모델입니다. 미래의 모든 reader가 사라질 때까지 기다리는 것이 아닙니다.':'reader 종료와 회수 가능성 확인은 게시와 별도입니다.',shapes,stats:[['현재 버전',published?'N':'O'],['옛 객체',reclaimed?'회수':'유지']]};});},observe:['R1과 R2가 서로 다른 객체를 동시에 읽는 구간을 보세요.','reader가 오래 유지되면 객체 회수 시점도 뒤로 이동합니다.'],assumptions:'reader 2개·갱신 1회의 RCU 수명 개념 모델. 실제 grace period는 RCU flavor·CPU·선점 상태 등 구현 조건을 따릅니다.'}}
;
function fAt(f,end){return f<end?'기존 reader 진행 중':f===end?'R1 읽기 구간 종료':'기존 reader 종료 뒤 회수';}

A[13]={figures:[
 figure(2,'VMA는 영역의 정책, PTE는 페이지별 연결','왼쪽의 연속 가상 구간이 오른쪽의 모든 물리 페이지를 이미 확보했다는 뜻은 아닙니다. 빈 PTE가 있는 유효한 VMA도 가능합니다.',400,[
  label('vmal',30,30,'프로세스 가상 주소'),label('ptl',345,30,'페이지 테이블'),label('raml',695,30,'물리 프레임'),
  ...box('code',40,60,220,65,'코드 · r-x','purple'),...box('heap',40,145,220,120,'익명 영역 · rw-','blue'),...box('gap',40,285,220,65,'미매핑 구간','muted'),
  ...cellRow('pte0',335,75,1,210,48,['VPN 0 → PFN 7'],'green'),...cellRow('pte1',335,145,1,210,48,['VPN 1 → 미배치'],'orange'),...cellRow('pte2',335,215,1,210,48,['VPN 2 → PFN 3'],'green'),
  ...box('pf7',670,65,180,65,'PFN 7','purple'),...box('pf3',670,215,180,65,'PFN 3','blue'),arrow('vmcode',260,90,335,99,'purple'),arrow('vmheap',260,180,335,169,'blue'),arrow('vmmore',260,225,335,239,'blue'),
  arrow('map0',545,99,670,95,'green'),arrow('map2',545,239,670,247,'green'),label('none',580,180,'아직 없음','orange'),label('foot',40,385,'구간 존재·접근 권한·물리 매핑 상태는 서로 다른 질문입니다.')]),
 figure(4,'malloc의 작은 요청은 기존 빈 블록에서 처리될 수 있다','크기별 재사용 구조를 단순화했습니다. 재사용 성공이면 brk/mmap 없이 사용자 공간에서 끝날 수 있으며 정책은 libc별로 다릅니다.',370,[
  label('app',40,35,'응용 요청: 48 B'),...box('request',45,65,170,60,'malloc(48)','blue'),...box('allocator',320,50,220,90,'libc 할당자','purple'),arrow('req',215,95,320,95,'blue'),
  label('cache',35,190,'재사용 가능한 블록'),...cellRow('bin',40,215,5,95,55,['64','64','64','128','256'],i=>i<3?'green':'muted'),arrow('pick',370,140,182,215,'green'),
  L('boundary',600,30,600,325,'muted',false,'6 6'),label('kernell',640,45,'커널 경계'),...box('newmap',635,180,215,80,'brk / mmap','orange'),arrow('fallback',540,110,635,205,'orange','6 5'),label('ifnone',625,300,'재사용 실패 시 후보 경로'),label('note',40,340,'64 B는 이 그림의 예시 관리 단위이며 실제 glibc 크기 정책이 아닙니다.')]),
 figure(5,'예약한 4페이지와 실제로 만진 2페이지','위는 가상 주소 범위, 아래는 준비된 물리 페이지입니다. 예약 크기와 resident 크기가 같은 시점에 늘지 않을 수 있습니다.',350,[
  label('vl',35,35,'가상 영역: 4페이지 예약'),...cellRow('virtual',40,65,4,200,65,['V0','V1','V2','V3'],'blue'),
  ...box('p0',75,225,130,60,'물리 P0','green'),...box('p1',675,225,130,60,'물리 P1','green'),arrow('touch0',137,130,140,225,'green'),arrow('touch3',737,130,740,225,'green'),
  label('untouched',300,190,'V1·V2: 아직 접근하지 않음','orange'),label('assume',60,330,'유효한 익명 매핑·개별 기본 페이지를 가정한 first-touch 모델')]),
 figure(6,'free의 세 가지 서로 다른 의미','객체 사용 종료, 할당자 재사용, 커널 반환은 같은 순간이 아닙니다. 내부 빈 공간이 있어도 매핑과 RSS가 남을 수 있습니다.',370,[
  label('before',35,30,'① 사용 중'),label('freed',335,30,'② free 후 재사용 가능'),label('returned',635,30,'③ 커널 반환 가능 부분'),
  ...Array.from({length:3},(_,col)=>[R('arena'+col,35+col*300,60,230,180,'muted'),...cellRow('slots'+col,50+col*300,85,3,65,55,col===0?['A','B','C']:col===1?['A','빈칸','C']:['A','빈칸','C'],i=>i===1&&col>0?'green':'blue'),...box('tail'+col,50+col*300,160,195,55,col===2?'반환된 페이지':'allocator 보유',col===2?'white':'orange')]).flat(),
  label('l0',35,285,'live 객체 3개'),label('l1',335,285,'live 객체 2개'),label('l2',635,285,'정책·정렬·수명 조건 필요'),label('rss',80,345,'live 객체 바이트 ≠ allocator 보유량 ≠ 현재 RSS ≠ 최고 RSS')])],
 scene:{after:3,title:'주소 토큰이 TLB hit와 page fault 경로를 지나간다',intro:'같은 유효한 가상 주소를 접근합니다. 준비된 변환을 쓰는 경우와 첫 접근으로 페이지를 준비하는 경우를 비교하세요.',width:900,height:520,
 controls:options('변환 상태',['fault','유효 VMA, 아직 PTE 미배치'],['hit','TLB와 물리 페이지 준비됨']),
 build(v){const hit=v.scenario==='hit';return Array.from({length:8},(_,f)=>{
  const valid=hit||f>=5,allocated=hit||f>=4;
  const path=hit?[[100,125],[310,125],[310,220],[650,220],[825,290],[650,220],[310,220],[100,125]]:[[100,125],[310,125],[540,125],[540,325],[825,445],[540,125],[310,125],[825,290]];
  const xy=path[f];const shapes=[...box('cpu',25,60,150,110,'CPU 접근','blue'),...box('tlb',245,60,135,110,'TLB','purple'),...box('pte',445,60,190,110,hit?'PTE · 이번 접근 생략':valid?'PTE → P7':'PTE 미배치',hit?'muted':valid?'green':'orange'),
   ...box('fault',425,260,210,105,'커널 fault 처리',hit?'muted':'orange'),...box('physical',680,205,180,110,allocated?'사용 프레임 P7':'물리 매핑 없음',allocated?'green':'muted'),...box('freepool',680,380,180,95,'빈 프레임 pool','muted'),
   arrow('lookup1',175,110,245,110),arrow('lookup2',380,110,445,110),arrow('pteToRam',635,110,750,205,valid?'green':'muted',valid?'':'5 4'),arrow('kernel',540,170,540,260,'orange'),
   ...dot('address-token',xy[0],xy[1],'VA','blue',23),...box('page-token',705,allocated?240:410,130,40,'P7',allocated?'green':'muted'),label('state',35,435,valid?'변환이 준비되어 접근 재개 가능':'VMA 권한 확인 후 매핑 준비 필요',valid?'green':'orange')];
  headings(shapes,['cpu','tlb','pte','fault','physical','freepool']);
  if(hit){for(let j=shapes.length-1;j>=0;j--)if(['lookup2','pteToRam','kernel'].includes(shapes[j].key))shapes.splice(j,1);shapes.push(L('cached-down',310,170,310,220,'purple'),L('cached-across',310,220,650,220,'purple'),arrow('cached',650,220,705,260,'purple'));}
  return {label:hit?['가상 주소 접근','TLB 조회','캐시된 변환 확보','페이지 테이블 탐색 우회','물리 페이지 접근','접근 결과 반환','사용자 실행으로 복귀','fault 처리 없이 계속'][f]:['가상 주소 접근','TLB miss','PTE not present','VMA·권한·원인 확인','물리 페이지 준비','PTE 설치·변환 갱신','명령 재시도','물리 페이지 접근'][f],note:hit?'TLB의 캐시된 변환을 사용하여 회색 PTE·fault 상자를 우회합니다. 아래쪽 통로는 경로 구분용이며 실제 하드웨어 배치를 뜻하지 않습니다.':'아직 준비되지 않은 유효 매핑의 first-touch 사례입니다. 모든 TLB miss가 이 경로로 가는 것은 아닙니다.',shapes,stats:[['PTE',valid?'present':'not present'],['물리 페이지',allocated?'준비':'미준비']]};});},observe:['fault 경로에서는 물리 페이지 토큰이 free pool에서 사용 영역으로 이동합니다.','유효 PTE가 있는 TLB miss는 별도의 숫자 실험에서 비교합니다.'],assumptions:'유효 VMA·허용된 접근·페이지 1개의 개념 모델. 실제 페이지 테이블 단계·fault 실패·THP·TLB shootdown 비용은 생략합니다.'}}
;

A[14]={figures:[
 figure(2,'물리 메모리에는 node와 zone 제약이 있다','총 여유 페이지 수가 같아도 요청 가능한 node·zone 안의 가용성이 다를 수 있습니다. 구체적인 zone 구성은 플랫폼마다 다릅니다.',350,[
  R('node0',30,40,400,245,'blue'),R('node1',470,40,400,245,'purple'),label('n0',50,75,'NUMA node 0'),label('n1',490,75,'NUMA node 1'),
  ...box('zone00',55,110,135,130,'zone A','green'),...box('zone01',210,110,195,130,'zone B','orange'),...box('zone10',495,110,135,130,'zone A','muted'),...box('zone11',650,110,195,130,'zone B','green'),
  label('limit',70,325,'위치·주소 범위·요청 문맥 조건을 만족하는 블록이 필요합니다.')]),
 figure(3,'8페이지를 4페이지와 2페이지 단위로 분할','가지가 나뉘면 더 작은 buddy 블록이 됩니다. 병합에는 같은 크기와 올바른 buddy 위치가 필요합니다.',380,[
  ...box('root',325,30,250,55,'order 3 · 8페이지','blue'),...box('left',115,145,250,55,'order 2 · 4페이지','green'),...box('right',545,145,250,55,'order 2 · 4페이지','blue'),
  ...box('r0',470,280,170,55,'order 1 · 2페이지','orange'),...box('r1',680,280,170,55,'order 1 · 2페이지','green'),
  arrow('branchL',405,85,240,145),arrow('branchR',495,85,670,145),arrow('split0',635,200,555,280),arrow('split1',705,200,765,280),label('allocated',125,240,'왼쪽 블록은 그대로 사용 가능'),label('merge',50,370,'인접한 임의의 블록을 크기와 상관없이 합치는 방식이 아닙니다.')]),
 figure(4,'빈 칸 8개와 연속 빈 칸 8개는 다르다','상단의 교차 배치에는 8페이지 연속 공간이 없습니다. 하단은 같은 총 여유량으로 8페이지 요청을 받을 수 있습니다.',330,[
  label('fr',30,30,'조각난 배치: 사용·빈칸 교차'),...cellRow('fragment',30,60,16,53,55,Array.from({length:16},(_,i)=>i%2?'빈':'사용'),i=>i%2?'green':'orange'),
  label('co',30,170,'모인 배치: 오른쪽 8페이지가 연속'),...cellRow('compact',30,200,16,53,55,Array.from({length:16},(_,i)=>i<8?'사용':'빈'),i=>i<8?'orange':'green'),
  L('bracket',455,275,873,275,'green'),L('bl',455,262,455,286,'green'),L('br',873,262,873,286,'green'),label('n',540,315,'order 3 요청 가능')]),
 figure(5,'SLUB은 페이지를 객체 슬롯으로 나눈다','작은 객체를 매번 한 페이지씩 받지 않고 슬롯을 재사용합니다. 일부 슬롯이 비어도 전체 slab 페이지를 바로 반환할 수 있는 것은 아닙니다.',360,[
  label('cache',30,30,'같은 크기 객체의 cache'),R('slab0',30,60,390,215,'blue'),R('slab1',480,60,390,215,'purple'),label('s0',50,90,'slab A · 부분 사용'),label('s1',500,90,'slab B · 빈 슬롯 많음'),
  ...Array.from({length:8},(_,i)=>box('slotA'+i,50+(i%4)*88,115+Math.floor(i/4)*65,76,50,i<6?'객체':'빈',i<6?'orange':'green')).flat(),
  ...Array.from({length:8},(_,i)=>box('slotB'+i,500+(i%4)*88,115+Math.floor(i/4)*65,76,50,i<2?'객체':'빈',i<2?'orange':'green')).flat(),label('pool',90,325,'객체 슬롯의 재사용과 기반 페이지 반환은 다른 단계입니다.')])],
 scene:{after:10,title:'분할한 buddy 블록은 언제 다시 합쳐지는가',intro:'8페이지 블록에서 4페이지와 2페이지를 사용합니다. 마지막 2페이지 사용자가 남으면 전체 8페이지로 합칠 수 없습니다.',width:900,height:470,
 controls:options('마지막 객체 수명',['released','모든 사용 블록 해제'],['held','2페이지 사용자가 계속 보유']),
 build(v){const held=v.scenario==='held';return Array.from({length:8},(_,f)=>{
  const merged=f===7&&!held;
  const leftUsed=f>=2&&f<5,rightUsed=f>=4&&(held||f<6);
  const blocks=f===0||merged?[[0,8,'빈 8','green']]:f===1?[[0,4,'빈 4','green'],[4,4,'빈 4','green']]:f<3?[[0,4,'사용 A','orange'],[4,4,'빈 4','green']]:[[0,4,leftUsed?'사용 A':'빈 4',leftUsed?'orange':'green'],[4,2,rightUsed?'사용 B':'빈 2',rightUsed?'orange':'green'],[6,2,'빈 2','green']];
  const shapes=[label('addr',30,45,'물리 페이지 주소 →'),...cellRow('cells',45,265,8,100,50,Array.from({length:8},(_,i)=>'P'+i),'muted'),label('request',35,385,f<3?'요청 A: 4페이지':f<5?'요청 B: 2페이지':'사용자 해제와 buddy 병합 검사'),
   ...dot('request-token',f<2?90+f*155:f<4?290+(f-2)*200:f<6?540:held?540:450,f<2?110:f<6?145:350,f<3?'A':'B',held&&f>=6?'orange':'blue',23)];
  blocks.forEach(([start,n,name,tone],i)=>shapes.push(...box('block'+i,45+start*100,195,n*100-5,60,name,tone)));
  if(f===6&&!held)shapes.push(label('mergecandidate',445,150,'두 2페이지 buddy → 4페이지','green'));
  if(f===7)shapes.push(label('result',70,440,held?'B가 남아 있으므로 8페이지 병합 불가':'올바른 buddy들이 비어 8페이지 블록으로 복구',held?'orange':'green'));
  return {label:['8페이지 빈 블록','4 + 4로 분할','A가 왼쪽 4 사용','오른쪽을 2 + 2로 분할','B가 2페이지 사용','A의 4페이지 해제',held?'B는 계속 사용':'B의 2페이지 해제',held?'전체 병합 불가':'2→4→8 병합'][f],note:'블록 폭은 물리 연속 페이지 수입니다. 같은 총 여유량이어도 크기와 buddy 관계가 다르면 받을 수 있는 요청이 달라집니다.',shapes,stats:[['사용 페이지',String((leftUsed?4:0)+(rightUsed?2:0))],['최대 빈 블록',String(Math.max(0,...blocks.filter(b=>b[3]==='green').map(b=>b[1])))+'페이지']]};});},observe:['블록 사각형이 실제로 나뉘고 폭이 바뀝니다.','B가 남은 시나리오는 빈 4페이지와 빈 2페이지가 있어도 8페이지가 되지 않습니다.'],assumptions:'8페이지·하나의 zone인 단순 buddy 모델. CPU별 캐시·이동성 분류·회수·compaction·동시 할당은 생략합니다.'}}
;

A[15]={figures:[
 figure(1,'파일 캐시는 사용자 버퍼와 저장 장치 사이에 있다','같은 캐시 페이지를 여러 read가 재사용할 수 있습니다. cache hit라도 사용자 버퍼 복사와 CPU 처리는 남을 수 있습니다.',380,[
  ...box('bufA',35,45,240,70,'프로세스 A 버퍼','blue'),...box('bufB',625,45,240,70,'프로세스 B 버퍼','purple'),R('cache',220,180,460,100,'green'),label('cachelabel',245,210,'공유 page cache'),
  ...cellRow('cachepage',250,225,5,80,40,['P0','P1','P2','P3','P4'],'green'),arrow('copyA',300,180,190,115,'blue'),arrow('copyB',600,180,745,115,'purple'),label('copyAL',50,160,'복사'),label('copyBL',780,160,'복사'),
  ...box('disk',345,320,210,45,'파일 저장소','orange'),arrow('readin',450,320,450,280,'orange'),label('miss',565,340,'miss일 때 데이터 준비')]),
 figure(3,'기본 페이지 네 개를 묶은 folio 예시','folio는 하나 이상의 기본 페이지를 함께 관리합니다. 모든 folio가 큰 페이지라는 뜻은 아니며 실제 크기는 경로와 정책에 달립니다.',330,[
  label('one',35,35,'order 0 folio 네 개'),...Array.from({length:4},(_,i)=>[R('onefolio'+i,35+i*210,60,190,80,'blue'),...box('singlepage'+i,50+i*210,82,160,40,'기본 페이지 '+i,'green')]).flat(),
  label('many',35,205,'하나의 다중 페이지 folio'),R('bigfolio',35,225,820,75,'purple'),...cellRow('part',55,242,4,195,40,['기본 P0','기본 P1','기본 P2','기본 P3'],'green'),label('metadata',470,205,'묶음 전체의 상태·수명을 함께 다룸')]),
 figure(4,'read의 복사와 mmap의 매핑 연결','위는 사용자 버퍼에 복사하는 경로, 아래는 페이지 테이블로 파일 캐시를 연결하는 경로입니다. mmap도 fault·TLB·관리 비용이 있습니다.',370,[
  label('readl',30,35,'buffered read'),...box('readcache',40,65,215,65,'캐시 데이터','green'),...box('usercopy',610,65,245,65,'사용자 버퍼 사본','blue'),arrow('memcpy',255,98,610,98,'blue'),label('memcpyl',350,80,'바이트 복사'),
  label('mmapl',30,210,'파일 mmap'),...box('vma',40,240,215,65,'사용자 가상 페이지','blue'),...box('pte',340,240,180,65,'PTE','purple'),...box('filepage',640,240,215,65,'캐시의 같은 페이지','green'),arrow('vpt',255,272,340,272,'purple'),arrow('ptfile',520,272,640,272,'purple'),label('same',310,350,'준비된 매핑에서는 같은 데이터를 주소로 접근')]),
 figure(6,'읽기 가시성과 writeback 완료를 분리','메모리의 최신 값 S가 읽혀도 저장소는 아직 A일 수 있습니다. 일반 write 성공과 전원 장애 내구성을 같은 사건으로 보지 않습니다.',370,[
  label('step',30,30,'단계'),label('cacheh',315,30,'page cache'),label('diskh',650,30,'저장소'),
  ...['초기','사용자 변경','캐시에서 재읽기','writeback 완료'].map((s,i)=>[label('step'+i,30,90+i*75,s),...box('cache'+i,300,55+i*75,180,50,i===0?'A · clean':'S · '+(i<3?'dirty':'clean'),i===0||i===3?'green':'orange'),...box('disk'+i,635,55+i*75,180,50,i<3?'A':'S',i<3?'muted':'green')]).flat(),
  arrow('wb',480,305,635,305,'green'),label('separate',490,200,'아직 다름','red')])],
 scene:{after:5,title:'PRIVATE 쓰기는 사본으로, SHARED 쓰기는 캐시로',intro:'같은 파일의 A를 매핑한 뒤 값을 바꿉니다. 사용자 주소의 참조 대상과 파일 캐시·저장소 값이 각각 언제 바뀌는지 보세요.',width:900,height:510,
 controls:options('매핑 정책',['private','MAP_PRIVATE: P로 수정'],['shared','MAP_SHARED: S로 수정']),
 build(v){const priv=v.scenario==='private';return Array.from({length:8},(_,f)=>{
  const modified=f>=4,copied=priv&&f>=3,flushed=!priv&&f>=7;
  const cacheValue=!priv&&modified?'S':'A',privateValue=modified?'P':'A';
  const target=copied?[470,340]:[470,130];
  const points=priv?[[100,130],[250,130],[470,130],[470,340],[470,340],[250,340],[100,130],[100,130]]:[[100,130],[250,130],[470,130],[470,130],[470,130],[550,130],[670,130],[775,130]];
  const xy=points[f];
  const shapes=[...box('usermap',25,70,200,120,'사용자 VMA','blue'),...box('cache',365,70,210,120,'파일 캐시 '+cacheValue,!priv&&modified&&!flushed?'orange':'green'),...box('storage',685,70,190,120,'저장소 '+(flushed?'S':'A'),flushed?'green':'muted'),
   ...box('private-copy',365,285,210,110,copied?'사적 사본 '+privateValue:'사적 사본 없음',copied?'purple':'muted'),
   arrow('mapref',225,150,target[0]-105,target[1],'blue'),label('mapref-label',35,255,copied?'쓰기 후 사적 페이지를 참조':'파일 캐시 페이지를 참조','blue'),
   ...dot('data-token',xy[0],xy[1],modified?(priv?'P':'S'):'A',priv?'purple':'orange',24),
   label('readresult',35,440,'일반 파일 read 결과: '+cacheValue,'green'),label('persist',405,440,priv?'파일 캐시·저장소는 A 유지':flushed?'모델의 데이터 writeback 완료':'dirty 상태에서는 저장소가 A일 수 있음',priv?'purple':'orange')];
  headings(shapes,['usermap','cache','storage','private-copy']);
  if(!priv&&f>=5)shapes.push(arrow('writeback',575,160,685,160,'orange'));
  return {label:['A인 파일을 매핑','메모리 접근','공유 캐시 데이터 A',priv?'COW 사본 준비':'공유 매핑 그대로 사용',priv?'사적 사본에 P 쓰기':'캐시에 S 쓰고 dirty',priv?'read 파일은 A':'writeback 요청',priv?'사적 변경만 관찰':'데이터 저장 중',priv?'파일 내용은 바뀌지 않음':'writeback 완료 S'][f],note:priv?'사적 변경은 원본 파일의 공유 변경이 아닙니다. 사용자 주소가 사적 페이지를 참조하도록 바뀝니다.':'다른 read가 S를 볼 수 있는 시점과 저장소 반영은 다릅니다. 실제 내구성은 fsync·오류·메타데이터·장치 계약을 함께 확인합니다.',shapes,stats:[['캐시',cacheValue],['저장소',flushed?'S':'A'],['변경',priv?'사적':'공유']]};});},observe:['PRIVATE에서는 참조 화살표가 아래 사본으로 바뀝니다.','SHARED에서는 캐시 값이 먼저 바뀌고 저장소가 나중에 바뀝니다.'],assumptions:'한 페이지·동시 변경·I/O 오류 없는 개념 모델. writeback 완료 표시로 파일 이름·디렉터리까지의 crash durability를 보장하지 않습니다.'}}
;

A[16]={figures:[
 figure(1,'free와 회수 가능한 메모리는 다르다','막대의 전체 길이는 같은 RAM입니다. 파일 캐시는 재사용 가치와 회수 비용을 함께 가지므로 단순 낭비로 보지 않습니다.',320,[
  label('ram',30,35,'개념 RAM 배분'),...box('anon',30,75,320,80,'익명 메모리','blue'),...box('cache',350,75,300,80,'파일 캐시','green'),...box('kernel',650,75,150,80,'커널','purple'),...box('free',800,75,70,80,'free','muted'),
  arrow('reclaim',500,160,500,235,'green'),label('reclaiml',300,265,'일부는 회수 후보 · 재접근 비용 고려'),label('available',40,310,'MemAvailable은 추정치이며 모든 크기·zone·cgroup 요청의 성공 보증이 아닙니다.')]),
 figure(2,'내용을 보존하는 방법이 회수 비용을 바꾼다','깨끗한 파일은 원본에서 재구성할 수 있지만 dirty·익명·핀된 페이지는 다른 조건을 가집니다. 실제 회수는 추가 정책을 따릅니다.',390,[
  ...box('clean',40,35,190,70,'clean 파일','green'),...box('dirty',250,35,190,70,'dirty 파일','orange'),...box('anon',460,35,190,70,'익명 내용','blue'),...box('pinned',670,35,190,70,'pin된 페이지','purple'),
  arrow('cleanout',135,105,135,205,'green'),arrow('dirtyout',345,105,345,205,'orange'),arrow('anonout',555,105,555,205,'blue'),L('pinout',765,105,765,180,'red'),L('pinstop',725,180,805,180,'red'),
  ...box('drop',40,205,190,80,'버리고 재읽기','green'),...box('wb',250,205,190,80,'writeback 필요','orange'),...box('swap',460,205,190,80,'swap 등 보존','blue'),...box('hold',670,205,190,80,'수명·이동 제약','red'),
  label('cost',55,350,'회수 가능 여부 ≠ 지금 회수하는 비용이 낮음 ≠ 곧 다시 쓰지 않음')]),
 figure(4,'사용 이력을 세대로 묶어 보는 관점','왼쪽은 오래 관찰되지 않은 집합, 오른쪽은 최근 사용된 집합입니다. MGLRU의 정확한 구현·교체 순서를 재현한 도식은 아닙니다.',360,[
  ...Array.from({length:4},(_,g)=>[R('gen'+g,30+g*220,65,195,210,g===0?'orange':g===3?'green':'blue'),label('glabel'+g,45+g*220,95,['오래됨','이전','최근','가장 최근'][g]),...Array.from({length:3},(_,i)=>dot('page'+g+'-'+i,75+g*220+(i%2)*85,145+Math.floor(i/2)*75,'P'+(g*3+i),g===0?'orange':g===3?'green':'blue')).flat()]).flat(),
  arrow('age',60,315,830,315,'muted'),label('agel',315,345,'접근 관찰과 세대 갱신'),label('victim',35,35,'회수 후보는 상태·범위·정책도 함께 고려')]),
 figure(8,'NUMA: 실행 CPU와 데이터 위치를 함께 보기','실선은 로컬, 점선은 원격 접근입니다. CPU affinity만 설정해도 메모리 위치가 자동으로 따라온다고 가정하지 않습니다.',360,[
  R('node0',30,40,390,250,'blue'),R('node1',480,40,390,250,'purple'),label('n0',45,70,'node 0'),label('n1',495,70,'node 1'),
  ...box('cpu0',70,100,140,60,'CPU 0','blue'),...box('mem0',230,200,150,60,'메모리 0','green'),...box('cpu1',520,100,140,60,'CPU 1','purple'),...box('mem1',680,200,150,60,'메모리 1','green'),
  arrow('local0',145,160,230,230,'blue'),arrow('local1',595,160,680,230,'purple'),arrow('remote',210,125,680,205,'orange','6 5'),label('remotel',335,120,'원격 접근','orange'),label('firsttouch',95,335,'첫 접근·정책·task 이동·메모리 이동을 함께 확인합니다.')])],
 scene:{after:5,title:'같은 접근열도 메모리 한 칸 차이로 재읽기가 생긴다',intro:'A→B→C→D→E→A→B를 접근합니다. 네 칸과 다섯 칸에서 resident 집합과 재읽기 수가 어떻게 달라지는지 보세요.',width:900,height:500,
 controls:options('파일 캐시 예산',['four','4페이지 유지'],['five','5페이지 유지']),
 build(v){const cap=v.scenario==='five'?5:4,seq=['A','B','C','D','E','A','B'];let cache=Array(cap).fill(null),fifo=[],reads=0;const history=[{cache:[...cache],reads:0,access:'-',hit:false,evicted:''}];
  seq.forEach(access=>{const hit=cache.includes(access);let evicted='';if(!hit){reads++;let slot=cache.indexOf(null);if(slot<0){slot=fifo.shift();evicted=cache[slot];}cache[slot]=access;fifo.push(slot);}history.push({cache:[...cache],reads,access,hit,evicted});});
  return history.map((st,f)=>{const shapes=[label('filelabel',30,35,'원본 파일 데이터 · clean 캐시 페이지를 다시 만들 수 있음'),...cellRow('source',40,65,5,165,55,['A','B','C','D','E'],'muted'),label('ramlabel',30,245,'RAM 캐시 슬롯: '+cap+'개'),
   ...cellRow('ram',40,280,cap,165,75,Array.from({length:cap},(_,i)=>st.cache[i]?'':'빈칸'),i=>st.cache[i]?'green':'muted'),label('trace',40,420,'접근열: '+seq.slice(0,f).join(' → ')),label('result',40,465,f===0?'아직 접근 전':st.hit?'캐시 hit: 재읽기 없음':st.evicted?st.evicted+' 회수 후 '+st.access+' 재읽기':st.access+' 읽어 캐시 준비',st.hit?'green':st.evicted?'orange':'ink')];
   ['A','B','C','D','E'].forEach((p,i)=>{const index=st.cache.indexOf(p),resident=index>=0;const item=dot('resident-'+p,resident?120+index*165:120+i*165,resident?320:92,p,resident?'green':'muted',23);item.forEach(s=>s.attrs.opacity=resident?1:0);shapes.push(...item);});
   return {label:f===0?'빈 캐시':st.access+' 접근 · '+(st.hit?'hit':'miss'),note:st.evicted?'clean 파일 페이지를 버리고 필요할 때 원본에서 다시 읽습니다. 토큰의 원본 쪽 복귀는 캐시 상실의 표시이며 writeback을 뜻하지 않습니다.':'이 장면은 FIFO라는 명시적인 단순 정책으로 working set을 설명합니다. 실제 MGLRU가 이 순서로 회수한다는 뜻은 아닙니다.',shapes,stats:[['데이터 읽기',st.reads+'회'],['resident',st.cache.filter(Boolean).length+'/'+cap],['현재 접근',st.access]]};});},observe:['다섯 칸에서는 E까지 읽은 뒤 A·B가 hit입니다.','네 칸에서는 사용량이 계속 네 칸이어도 추가 재읽기가 발생합니다.'],assumptions:'clean 파일 페이지·FIFO·페이지 5개의 교육 모델. 실제 MGLRU·익명 swap·OOM·I/O 지연·readahead는 재현하지 않습니다.'}}
;

})(globalThis.KernelDrawing, globalThis.KernelAtlas ||= {});
