/* Linux 6.18 teaching atlas: I/O, isolation and evidence. Geometry is conceptual. */
(function(D,A){
 'use strict';
 const R=D.rect, X=D.text, L=D.line, C=D.circle;
 const B=(k,x,y,w,h,title,tone='blue')=>[R(k,x,y,w,h,tone),X(k+'-label',x+w/2,y+h/2+5,title,16,'middle')];
 const T=(k,x,y,label,tone='blue',r=21)=>[C(k,x,y,r,tone),X(k+'-label',x,y+5,label,15,'middle')];
 const arrow=(k,x,y,xx,yy,tone='muted')=>L(k,x,y,xx,yy,tone,true);
 const slots=(k,x,y,n,labels=[],tone='blue',w=65,h=42)=>Array.from({length:n},(_,i)=>B(k+i,x+i*(w+5),y,w,h,labels[i]??String(i),Array.isArray(tone)?tone[i]:tone)).flat();
 const fig=(after,title,caption,shapes,height=360)=>({after,title,caption,width:900,height,shapes});
 const scene=(after,title,intro,choices,build,observe,assumptions,height=480)=>({after,title,intro,width:900,height,controls:[{id:'scenario',label:'비교할 조건',value:choices[0][0],options:choices.map(([value,label])=>({value,label}))}],build,observe,assumptions});
 const frame=(label,note,shapes,stats)=>({label,note,shapes,stats});
 const title=(k,s)=>X(k,40,35,s,19);
 const band=(k,y,label,tone='muted',h=72)=>[R(k,35,y,830,h,tone),X(k+'-name',50,y+24,label,16)];
 const ruler=(k,x,y,n=8,w=70)=>[L(k+'-axis',x,y,x+n*w,y),...Array.from({length:n+1},(_,i)=>[L(k+'-tick'+i,x+i*w,y-6,x+i*w,y+6),X(k+'-num'+i,x+i*w,y+28,String(i),15,'middle')]).flat()];
 const lifeline=(k,x,label,y1=80,y2=395)=>[X(k+'-name',x,48,label,17,'middle'),L(k+'-life',x,y1,x,y2,'muted',false,'5 5')];

 A[17]={figures:[
  fig(1,'번호, 열린 상태, 파일 정체성은 별개다','fd 3·4는 같은 열린 파일 F1을 참조합니다. 새 open으로 얻은 fd 5는 F2를 참조하지만 파일의 inode는 같습니다.',[
   title('title','프로세스 fd 테이블 → 열린 파일 설명 → inode'),...B('table',40,70,170,245,'','muted'),...slots('fd',60,90,1,['fd 3'],'blue',130),...slots('fb',60,155,1,['fd 4'],'blue',130),...slots('fc',60,220,1,['fd 5'],'purple',130),...B('f1',360,95,220,75,'F1 · pos = 3','blue'),...B('f2',360,225,220,75,'F2 · pos = 0','purple'),...B('inode',715,155,140,90,'inode I','green'),arrow('a',190,111,360,125,'blue'),arrow('b',190,176,360,145,'blue'),arrow('c',190,241,360,260,'purple'),arrow('d',580,130,715,185),arrow('e',580,260,715,215)
  ]),
  fig(3,'VFS는 같은 read를 다른 연산에 연결한다','위쪽은 공통 fd 인터페이스입니다. 아래 세 가지 파일 연산은 데이터와 대기 방식이 다르므로 read 호출 수가 디스크 요청 수는 아닙니다.',[
   ...B('fd',350,30,200,55,'read(fd, buf, n)'),...B('ops',320,120,260,55,'struct file · f_op','purple'),arrow('a',450,85,450,120),...B('file',50,245,220,70,'일반 파일\npage cache','green'),...B('pipe',340,245,220,70,'파이프\n바이트 버퍼','orange'),...B('socket',630,245,220,70,'소켓\n프로토콜 수신 큐','blue'),arrow('b',380,175,160,245),arrow('c',450,175,450,245),arrow('d',520,175,740,245)
  ],380),
  fig(5,'같은 바이트 열, 두 개의 파일 위치','A와 dup(A)의 커서는 F1에 하나만 존재합니다. 독립 open의 F2 커서는 A의 read 때문에 이동하지 않습니다.',[
   title('t','read(A, 3) 이후의 위치'),...slots('bytes',160,80,8,['A','B','C','D','E','F','G','H'],'muted'),...ruler('r',160,165,8,70),X('l1',45,230,'F1 · 공유',16),X('l2',45,300,'F2 · 독립',16),arrow('p1',370,235,370,135,'blue'),arrow('p2',160,300,160,135,'purple'),...T('cursor1',370,230,'3','blue'),...T('cursor2',160,300,'0','purple'),X('note',490,285,'위치가 바뀌는 객체를 추적하세요.',17)
  ]),
  fig(8,'이름을 지워도 열린 참조는 남는다','unlink는 디렉터리의 이름 연결을 끊습니다. 열린 파일 참조가 살아 있으면 데이터 수명은 끝나지 않을 수 있습니다.',[
   ...B('name',45,60,220,70,'디렉터리: app.log','muted'),...B('open',45,215,220,70,'서비스의 열린 fd','blue'),...B('inode',390,140,180,80,'inode I','green'),...B('data',690,140,150,80,'데이터 블록','green'),L('deleted',265,95,390,160,'red',false,'6 6'),X('cut',312,85,'unlink',16,'middle','red'),L('x1',305,113,330,138,'red'),L('x2',330,113,305,138,'red'),arrow('alive',265,250,390,190,'blue'),arrow('storage',570,180,690,180),X('note',405,285,'마지막 참조의 종료를 확인',17)
  ])],
 scene:scene(6,'읽기가 파일 위치를 움직이는 장면','fd A의 두 번의 읽기 뒤 fd B가 어디에서 시작하는지 관찰합니다.',[['dup','B = dup(A)'],['open','B = 별도 open']],v=>{
  const shared=v.scenario==='dup';const apos=[0,0,2,2,3,3,3,3],bpos=shared?[0,0,2,2,3,3,5,5]:[0,0,0,0,0,0,2,2];
  return Array.from({length:8},(_,i)=>{const a=shared&&i>=6?5:apos[i],b=bpos[i];return frame(['열기','A 읽기 준비','A: AB','A 다시 읽기','A: C','B 읽기 준비','B 읽기 완료','관계 확인'][i],i>=6?(shared?'B는 D·E를 읽었습니다. 공유 위치가 5가 되어 A에도 반영됩니다.':'B는 A·B를 읽었습니다. B의 독립 위치만 2로 바뀌었습니다.'):'숫자 fd가 아니라 열린 파일 설명에 위치가 저장됩니다.',[
   ...band('bytes-bg',55,'파일 바이트'),...slots('byte',220,83,8,['A','B','C','D','E','F','G','H'],'muted'),...B('a',45,180,130,55,'fd A','blue'),...B('b',45,315,130,55,'fd B','purple'),...B('f1',240,180,180,55,'F1 · pos '+a,'blue'),...B('f2',240,315,180,55,shared?'F1을 공유':'F2 · pos '+b,shared?'blue':'purple'),arrow('ar',175,207,240,207,'blue'),arrow('br',175,342,240,342,shared?'blue':'purple'),...ruler('ra',460,213,5,65),...ruler('rb',460,348,5,65),...T('cursor-a',460+a*65,190,String(a),'blue'),...T('cursor-b',460+b*65,325,String(b),'purple'),X('shared',450,420,shared?'같은 열린 상태: 한쪽 read가 양쪽에 보인다.':'서로 다른 열린 상태: 같은 inode여도 위치는 독립.',17)
  ],[['A의 현재 위치',String(a)],['B의 현재 위치',String(b)],['열린 파일 설명',shared?'1개':'2개']]);});
 },['B가 읽은 바이트가 왜 다른지 설명하세요.','dup 시나리오에서 B의 read 뒤 A의 커서도 이동하는지 보세요.'],'고정된 8바이트 일반 파일의 성공한 순차 read 모형입니다. 파일 내용의 동시 변경과 오류·stdio 버퍼링은 생략합니다.')};

 A[18]={figures:[
  fig(1,'write 완료와 영속 저장 사이의 층','위쪽 메모리의 새 데이터 B와 아래 장치의 이전 데이터 A가 동시에 존재할 수 있습니다. 내려가는 화살표마다 다른 완료 조건이 있습니다.',[
   ...band('u',45,'사용자 공간', 'purple',65),...B('ub',520,57,220,40,'새 데이터 B','purple'),...band('k',145,'커널 page cache','blue',65),...B('kb',520,157,220,40,'B · dirty','orange'),...band('d',245,'저장 장치','green',65),...B('db',520,257,220,40,'이전 데이터 A','green'),arrow('copy',630,97,630,157),X('write',335,132,'write: 받아들임',16),arrow('wb',630,197,630,257),X('flush',335,232,'writeback · flush',16)
  ]),
  fig(2,'저널과 본래 위치는 두 저장 영역이다','저널 commit과 본래 위치 반영은 다른 단계입니다. 이 그림은 메타데이터 복구 구조이며 사용자 업무 전체의 트랜잭션을 뜻하지 않습니다.',[
   title('t','ext4 메타데이터 변경의 개념적 저장 구조'),...B('ram',45,85,200,100,'메모리의 변경\ninode · 할당 정보','blue'),...B('journal',350,65,210,140,'저널 영역\n기록 + commit','orange'),...B('home',660,85,190,100,'본래 위치\n메타데이터','green'),arrow('j',245,130,350,130,'orange'),arrow('h',560,130,660,130,'green'),...slots('records',340,245,4,['J1','J2','J3','commit'],['orange','orange','orange','green'],100,48),X('cap',350,325,'완료된 commit을 기준으로 복구',16)
  ]),
  fig(5,'장애 시점이 바꾸는 복구 질문','세로 절단선은 장애를 가정한 시점입니다. 각 단계에서 이름의 가시성과 저장된 내용이 같은 상태인 것은 아닙니다.',[
   title('t','임시 파일을 사용하는 이름 교체'),L('axis',65,125,845,125,'ink',true),...['write','파일 fsync','rename','디렉터리 fsync'].flatMap((s,i)=>[C('pt'+i,125+i*205,125,8,'blue'),X('tx'+i,125+i*205,85,s,16,'middle')]),...['내용 보존?','이름은 아직 이전','이름 영속성?'].flatMap((s,i)=>[L('cut'+i,220+i*205,110,220+i*205,290,'red',false,'5 5'),X('q'+i,220+i*205,320,s,16,'middle','red')]),X('l',60,210,'메모리의 B',16),X('m',60,260,'디스크의 A/B',16),L('r1',220,210,835,210,'orange'),L('r2',425,260,835,260,'green')
  ]),
  fig(8,'묶음 동기화는 비용과 기다림을 바꾼다','상단은 매 요청의 fsync, 하단은 네 요청의 묶음 fsync입니다. 고정 비용은 나눌 수 있지만 첫 요청은 묶음이 준비되기를 기다립니다.',[
   X('a',40,60,'요청마다 동기화',17),...Array.from({length:4},(_,i)=>[...B('w'+i,230+i*155,40,35,50,'W','blue'),...B('f'+i,265+i*155,40,105,50,'fsync','orange')]).flat(),X('b',40,170,'네 요청 묶기',17),...slots('batch',230,145,4,['W1','W2','W3','W4'],'blue',60,50),...B('bf',510,145,210,50,'한 번의 fsync','orange'),arrow('wait',245,260,510,260,'purple'),X('wt',375,295,'첫 요청의 배치 대기',16,'middle'),X('note',40,340,'막대 길이는 비용 비교를 위한 개념값이며 장치 실측이 아닙니다.',16)
  ],380)],
 scene:scene(7,'새 내용이 어느 층까지 이동했는가','같은 파일 교체에서 디렉터리 fsync까지 수행한 경우와 rename 직후 장애를 비교합니다.',[['sync','끝까지 동기화'],['crash','rename 뒤 장애']],v=>Array.from({length:8},(_,i)=>{const crash=v.scenario==='crash'&&i>=6;const stages=['준비','write','dirty 상태','파일 fsync','rename 준비','rename 완료','디렉터리 fsync','복구 관점'];const x=[160,340,520,680,680,680,680,680][i],y=[90,90,190,290,290,290,290,290][i];return frame(crash?'장애: 이름 보존 미확인':stages[i],crash?'새 내용의 파일 fsync는 끝났지만 이름 변경의 영속성은 이 절차로 확인하지 못했습니다.':'내용의 저장과 디렉터리 이름 연결의 저장을 따로 확인합니다.',[
   ...band('user',50,'사용자 버퍼','purple',65),...band('cache',150,'page cache','blue',65),...band('disk',250,'저장 장치','green',65),...B('old',90,265,140,40,'기존 A','green'),...B('new',590,265,170,40,i>=3?'':'아직 없음',i>=3?'green':'muted'),X('new-title',675,245,'임시 파일',16,'middle'),...B('directory',100,360,260,60,crash?'config → ?':i>=5?'config → B':'config → A',crash?'orange':'blue'),...T('data',x,y,'B',i>=3?'green':'orange'),...(crash?[L('link',230,360,160,305,'orange',true,'6 5'),L('link-unknown',360,390,680,305,'orange',true,'6 5')]:[arrow('link',i<5?230:360,i<5?360:390,i<5?160:680,305,'green')]),X('durable',445,405,i>=6&&!crash?'이름까지 동기화 성공':crash?'장애 후 이름 연결: 미확인':'이름 연결의 동기화 대기',16),...(crash?[L('crash-cut',450,35,450,445,'red',false,'7 5'),X('crash-label',450,465,'장애 경계',16,'middle','red')]:[])
  ],[['내용 fsync',i>=3?'완료':'미완료'],['rename',i>=5?'완료':'미완료'],['디렉터리 fsync',i>=6&&!crash?'완료':'미완료']]);}),['B가 page cache에 있을 때와 장치에 있을 때를 구분하세요.','rename 뒤 장애에서 확정하지 못하는 보장은 무엇인가요?'],'로컬 파일 시스템의 정상 성공 호출을 단순화했습니다. 실제 장애 후 복구 결과는 파일 시스템·저장 장치 계약에 달려 있으며 특정 결과를 예언하지 않습니다.',510)};

 A[19]={figures:[
  fig(1,'파일 범위가 블록 요청으로 분할된다','논리적으로 이어진 파일 범위도 장치의 위치와 제약 때문에 나뉠 수 있습니다. read, bio, request는 일대일 관계가 아닙니다.',[
   X('l',40,65,'파일 논리 범위',17),...slots('logical',260,40,6,['0','1','2','3','4','5'],'blue',80),X('p',40,185,'장치 블록 위치',17),...slots('physical',260,160,6,['20','21','90','91','92','93'],['green','green','purple','purple','purple','purple'],80),...B('r1',280,265,160,55,'요청 A','green'),...B('r2',530,265,280,55,'요청 B','purple'),arrow('a1',300,82,300,160),arrow('a2',470,82,470,160),arrow('b1',345,202,360,265,'green'),arrow('b2',640,202,670,265,'purple')
  ]),
  fig(2,'멀티큐는 제출 경로의 경쟁을 나눈다','각 CPU 근처의 소프트웨어 제출 경로가 하드웨어 큐에 연결됩니다. 큐 수와 실제 장치 병렬 처리 능력은 다른 개념입니다.',[
   ...[0,1,2,3].flatMap((i)=>[...B('cpu'+i,35,35+i*75,110,45,'CPU '+i,'purple'),...slots('q'+i,245,35+i*75,3,['r','r','r'],'blue',45,45),arrow('a'+i,145,57+i*75,245,57+i*75),arrow('b'+i,395,57+i*75,580,100+Math.floor(i/2)*150)]),...B('h0',580,65,235,70,'하드웨어 큐 0','green'),...B('h1',580,215,235,70,'하드웨어 큐 1','green')
  ]),
  fig(6,'대기 슬롯과 서비스 슬롯은 다르다','여덟 요청 중 네 개만 실제 처리 중입니다. 제출량을 늘려도 오른쪽 서비스 폭이 그대로면 대기만 늘 수 있습니다.',[
   title('t','제출 깊이 8 · 병렬 처리 폭 4'),...slots('wait',60,95,4,['R5','R6','R7','R8'],'orange',75,55),X('wl',215,190,'대기 중 4개',17,'middle'),...Array.from({length:4},(_,i)=>B('lane'+i,570,55+i*65,240,48,'서비스 '+(i+1)+' · R'+(i+1),'green')).flat(),arrow('feed',385,122,550,122),X('cap',40,335,'큐 길이 ≠ 동시에 진행하는 작업 수',18)
  ]),
  fig(10,'사용자 지연은 블록 지연보다 넓다','위쪽 read 구간에는 블록 제출 전과 완료 후의 시간도 포함됩니다. 아래 구간만 짧다고 사용자 응답 전체가 짧다는 뜻은 아닙니다.',[
   X('r',35,65,'사용자 read',17),...B('all',220,40,610,45,'호출 시작 → 반환','blue'),X('b',35,160,'블록 요청',17),...B('q',340,135,160,45,'장치 큐 대기','orange'),...B('svc',500,135,180,45,'서비스','green'),X('c',35,255,'완료 후',17),...B('wake',680,230,150,45,'CPU 배정 대기','purple'),L('t1',340,95,340,310,'muted',false,'5 5'),L('t2',680,95,680,310,'muted',false,'5 5'),X('submit',340,340,'issue 전후를 구분',16,'middle'),X('done',680,340,'complete ≠ read 반환',16,'middle')
  ],380)],
 scene:scene(6,'큐에서 장치 서비스로 들어가는 요청','같은 여섯 요청을 한 서비스 슬롯 또는 세 슬롯으로 처리합니다.',[['one','서비스 폭 1'],['three','서비스 폭 3']],v=>{
  const lanes=v.scenario==='three'?3:1;
  return Array.from({length:8},(_,i)=>{const completed=Math.min(6,Math.max(0,i-1)*lanes),active=i===0?0:Math.min(lanes,6-completed);const shapes=[title('t','제출된 요청 6개 · 동일한 개념적 서비스 단계'),R('queue',35,100,245,300,'orange'),X('queue-label',157,80,'제출 큐',17,'middle'),...Array.from({length:3},(_,j)=>[...B('lane'+j,345,110+j*95,245,65,'',j<lanes?'green':'muted'),X('lane-name'+j,465,102+j*95,j<lanes?'서비스 슬롯 '+(j+1):'비활성 슬롯',16,'middle')]).flat(),R('done',665,100,195,300,'green'),X('done-label',762,80,'완료 큐',17,'middle'),arrow('in',280,250,345,250),arrow('out',590,250,665,250)];
   for(let j=0;j<6;j++){let x=95+(j%2)*110,y=150+Math.floor(j/2)*90,tone='orange';if(j<completed){x=710+(j%2)*100;y=150+Math.floor(j/2)*90;tone='green';}else if(i>0&&j<completed+active){x=465;y=142+(j-completed)*95;tone='blue';}shapes.push(...T('req'+j,x,y,'R'+(j+1),tone));}
   return frame(i===0?'모든 요청 대기':completed===6?'모든 요청 완료':'서비스와 완료 진행','큐의 요청이 실제 서비스 슬롯을 얻어야 진행합니다. 서비스 폭을 넘는 제출은 대기 상태입니다.',shapes,[['서비스 폭',String(lanes)],['완료',completed+'/6'],['이번 처리',String(active)]]);
  });
 },['세 슬롯에서 실제로 함께 움직이는 요청을 찾으세요.','서비스 폭을 고정한 채 요청만 더 쌓으면 어떤 비용이 늘까요?'],'동일한 서비스 비용의 여섯 요청 모형입니다. 실제 blk-mq의 병합·태그·장치 내부 스케줄링·시간은 구현하지 않습니다.')};

 A[20]={figures:[
  fig(2,'NIC 수신 링의 소유권이 바뀐다','장치가 채운 슬롯을 커널이 소비하고 다시 사용할 수 있게 돌려줍니다. 링은 무한하지 않으며 처리와 도착 속도의 차이가 backlog를 만듭니다.',[
   ...Array.from({length:8},(_,i)=>{const a=i*Math.PI/4,x=360+140*Math.cos(a),y=180+125*Math.sin(a);return B('slot'+i,x-40,y-25,80,50,'RX '+i,i<3?'orange':'muted');}).flat(),...B('nic',40,130,140,70,'NIC · DMA','purple'),...B('poll',680,130,170,70,'NAPI poll','blue'),arrow('fill',180,165,240,165,'purple'),arrow('consume',540,165,680,165,'blue'),X('own',360,175,'소유권',18,'middle'),X('rot',360,205,'순환',18,'middle'),X('note',650,285,'주황: 소비할 수신 데이터\n회색: 재사용 가능한 슬롯',16)
  ],370),
  fig(3,'sk_buff는 데이터의 위치와 참조를 설명한다','메타데이터와 payload를 분리해 그렸습니다. 데이터가 항상 하나의 연속 영역에 있다고 가정하지 않습니다.',[
   ...B('skb',45,65,210,220,'sk_buff\n헤더 위치\n길이·참조','purple'),...B('head',385,55,440,60,'선형 head 영역','blue'),...slots('headers',385,135,4,['L2','IP','TCP','data'],'blue',105,50),...B('f1',440,245,150,55,'fragment 1','green'),...B('f2',665,245,150,55,'fragment 2','green'),arrow('h',255,110,385,85),arrow('frag',255,235,440,270),arrow('next',590,270,665,270),X('cap',45,335,'객체 복제와 payload 전체 복사는 같은 동작이 아닐 수 있습니다.',16)
  ],380),
  fig(4,'네 개의 큐를 구분해야 병목이 보인다','도착한 바이트가 어디에 쌓였는지에 따라 조사할 주체가 달라집니다. 높이는 개념적 대기량이며 실제 측정값이 아닙니다.',[
   ...[['NIC ring',3,'purple'],['커널 수신',2,'blue'],['socket Recv-Q',5,'orange'],['사용자 작업',1,'green']].flatMap(([s,n,t],i)=>[X('name'+i,135+i*210,45,s,16,'middle'),R('bin'+i,65+i*210,75,140,230,'muted'),...Array.from({length:n},(_,j)=>R('packet'+i+'-'+j,80+i*210,270-j*35,110,27,t)),X('cnt'+i,135+i*210,335,n+'개 대기',16,'middle')])
  ],380),
  fig(7,'전체 평균이 숨기는 한 큐의 포화','한 흐름이 한 RX 큐와 CPU에 집중되는 예입니다. 다른 CPU의 여유가 해당 흐름의 처리 능력으로 자동 전환되지 않습니다.',[
   ...Array.from({length:4},(_,i)=>[X('c'+i,65,65+i*70,'CPU '+i,17),R('bg'+i,200,40+i*70,600,40,'muted'),R('use'+i,200,40+i*70,i===0?570:60,40,i===0?'orange':'green'),X('percent'+i,825,65+i*70,i===0?'95%':'10%',16,'middle')]).flat(),X('why',205,345,'흐름 해시 → RX 큐 → 실행 CPU의 대응을 확인',17)
  ],380)],
 scene:scene(6,'한 번에 얼마만큼 poll할 것인가','여덟 패킷이 대기 중일 때 수신 예산 2와 4를 비교합니다.',[['small','poll 예산 2'],['large','poll 예산 4']],v=>{
  const budget=v.scenario==='large'?4:2;return Array.from({length:9},(_,i)=>{const rounds=Math.floor((i+1)/2),done=Math.min(8,Math.floor(i/2)*budget),moving=i%2===1?Math.min(budget,8-done):0;const s=[...B('nic',35,50,235,55,'NIC RX backlog','purple'),...B('poll',340,50,230,55,'NAPI · budget '+budget,'blue'),...B('sock',650,50,215,55,'socket 수신 큐','green'),R('rx-area',35,125,235,300,'muted'),R('poll-area',340,125,230,300,'blue'),R('sock-area',650,125,215,300,'green')];for(let j=0;j<8;j++){let x=90+(j%2)*115,y=165+Math.floor(j/2)*70,t='orange';if(j<done){x=700+(j%2)*110;t='green';}else if(j<done+moving){x=395+((j-done)%2)*115;y=190+Math.floor((j-done)/2)*95;t='blue';}s.push(...T('pkt'+j,x,y,'P'+(j+1),t));}return frame(i===0?'수신 패킷 대기':moving?'poll이 패킷 소비':'소켓 큐로 전달','poll 예산은 한 번에 처리하는 작업량을 제한합니다. 소켓에 전달되어도 사용자 recv가 끝난 것은 아닙니다.',s,[['poll 예산',String(budget)],['소켓 전달',done+'/8'],['현재 poll',String(moving)],['처리 기회',String(rounds)]]);});
 },['poll 영역으로 동시에 이동하는 패킷 수를 비교하세요.','소켓 큐 도착과 애플리케이션 소비가 다른 시점임을 설명하세요.'],'새 패킷 도착, Tx 완료, GRO, 다른 NAPI 인스턴스와 실제 시간 예산을 생략한 Rx 배치 모형입니다.')};
 A[21]={figures:[
  fig(1,'준비 알림과 완료 결과의 왕복이 다르다','왼쪽 epoll은 준비를 알린 뒤 애플리케이션이 read합니다. 오른쪽 io_uring의 단발 read 완료는 작업 결과를 전달합니다.',[
   ...lifeline('eu',100,'사용자',75,315),...lifeline('ek',340,'커널',75,315),...lifeline('iu',570,'사용자',75,315),...lifeline('ik',810,'커널',75,315),X('e',220,30,'epoll',18,'middle'),X('i',690,30,'io_uring',18,'middle'),arrow('e1',100,105,340,105),X('e1t',220,95,'관심 등록',15,'middle'),arrow('e2',340,175,100,175,'orange'),X('e2t',220,165,'읽기 준비',15,'middle'),arrow('e3',100,240,340,240),X('e3t',220,230,'read 실행',15,'middle'),arrow('e4',340,300,100,300,'green'),arrow('i1',570,105,810,105),X('i1t',690,95,'read 요청 제출',15,'middle'),...B('work',750,145,115,95,'작업\n진행','blue'),arrow('i2',810,300,570,300,'green'),X('i2t',690,285,'완료 결과',15,'middle')
  ],370),
  fig(2,'남은 바이트와 알림 정책을 분리한다','두 방식 모두 버퍼에는 60바이트가 남았습니다. LT의 지속 준비와 ET의 새로운 변화 알림을 혼동하지 않아야 합니다.',[
   title('t','100B 도착 뒤 40B만 읽은 경우'),X('lt',45,120,'LT',20),X('et',45,240,'ET',20),...B('lt-read',180,80,240,55,'읽은 40B','muted'),...B('lt-left',420,80,360,55,'남은 60B','blue'),...B('et-read',180,200,240,55,'읽은 40B','muted'),...B('et-left',420,200,360,55,'남은 60B','orange'),X('lt-note',180,170,'준비 상태가 유지되면 다시 알릴 수 있음',16),X('et-note',180,290,'새 edge만 기다리지 말고 EAGAIN까지 소비',16)
  ]),
  fig(3,'SQ와 CQ는 요청 설명과 결과를 교환한다','큰 payload 자체와 링 항목은 다른 데이터입니다. user_data로 완료를 원래 요청 상태와 연결합니다.',[
   ...band('user',35,'사용자 공간','purple',65),...slots('sq',160,140,4,['R1','R2','R3','빈칸'],['blue','blue','blue','muted'],110,50),X('sql',45,170,'SQ',20),...slots('cq',160,240,4,['R2✓','R1✓','빈칸','빈칸'],['green','green','muted','muted'],110,50),X('cql',45,270,'CQ',20),...B('kernel',700,145,150,140,'커널\n작업 실행','blue'),arrow('submit',620,165,700,165,'blue'),arrow('complete',700,265,620,265,'green'),arrow('produce',250,100,250,140,'purple'),arrow('consume',510,240,510,100,'green'),X('order',160,335,'제출 순서와 완료 순서가 같다고 가정하지 않는다.',16)
  ],380),
  fig(7,'버퍼 수명은 제출 뒤에도 이어진다','취소 요청은 원래 작업의 메모리 참조가 즉시 끝났다는 증거가 아닙니다. 완료 계약을 확인한 뒤 버퍼를 반환합니다.',[
   ...ruler('axis',150,85,7,95),X('time',40,88,'단계',16),...B('life',150,140,570,60,'버퍼를 유지해야 하는 구간','blue'),...B('free',720,140,95,60,'반환','green'),...['준비','제출','진행','취소 요청','결과 확인','완료 회수','해제'].flatMap((s,i)=>[L('mark'+i,150+i*95,200,150+i*95,260,'muted'),X('label'+i,150+i*95,290,s,15,'middle')]),L('wrong',435,120,435,230,'red',false,'5 5'),X('bad',435,335,'취소 요청만 보고 해제하지 않음',16,'middle','red')
  ],380)],
 scene:scene(8,'알림을 받은 다음에 누가 데이터를 읽는가','동일한 읽기 요청에서 readiness 모델과 completion 모델의 이동을 비교합니다.',[['epoll','epoll readiness'],['uring','io_uring 단발 read']],v=>{
  const ur=v.scenario==='uring';const pos=ur?[[130,90],[330,180],[500,255],[735,350],[500,255],[650,175],[730,90],[730,90]]:[[130,90],[330,180],[500,255],[735,350],[330,180],[130,90],[500,255],[730,90]];
  return Array.from({length:8},(_,i)=>frame((ur?['요청 준비','SQE 제출','커널 진행','데이터 준비','read 수행','CQE 기록','완료 회수','버퍼 사용']:['관심 준비','epoll 등록','이벤트 대기','데이터 준비','ready 등록','준비 알림 수신','사용자가 read','데이터 사용'])[i],ur?'CQE 결과를 확인한 뒤 요청 상태와 버퍼를 처리합니다.':'준비 알림 뒤 실제 read를 호출해 결과를 확인해야 합니다.',[
   ...band('user',45,'사용자 프로그램','purple',90),...band('kernel',210,'커널 I/O 경로','blue',90),...band('device',330,'읽을 데이터의 원천','green',80),...B('sq',240,155,180,50,'','blue'),X('sq-title',330,145,ur?'SQ · 요청':'epoll 관심',16,'middle'),...B('cq',570,155,200,50,'','orange'),X('cq-title',670,145,ur?'CQ · 결과':'ready 목록',16,'middle'),...T('operation',pos[i][0],pos[i][1],ur?(i>=5?'CQE':'R'):(i===5?'알림':'R'),'blue'),...T('payload',i<3?735:i<6?650:730,i<3?370:i<6?270:110,'D','green'),X('boundary',45,455,ur?'완료에는 성공·오류·짧은 읽기의 결과가 담깁니다.':'알림 자체가 사용자 버퍼를 채우지는 않습니다.',17)
  ],[['방식',ur?'completion':'readiness'],['현재 단계',String(i+1)+'/8'],['사용자 데이터',i>=7||ur&&i>=6?'사용 가능':'아직 결과 확인 전']]));
 },['준비 알림 토큰과 데이터 토큰을 구분하세요.','사용자가 read를 호출하는 시점이 두 경로에서 어떻게 다른가요?'],'일반적인 성공 단발 read를 단순화했습니다. io_uring의 poll opcode·multishot·취소 경합·짧은 결과는 별도 계약입니다.')};

 A[22]={figures:[
  fig(1,'요청자의 자격과 대상의 속성을 비교한다','권한은 사용자 이름 하나가 아니라 요청자·대상·동작·정책의 관계입니다. 경로의 디렉터리 권한도 대상 접근에 영향을 줍니다.',[
   ...B('task',40,70,245,180,'요청자 credentials\nUID · GID\ncapability','purple'),...B('target',615,70,245,180,'대상 inode\n소유자 · mode\nACL · 보안 문맥','green'),...B('check',350,125,200,70,'요청한 동작\nread / write','blue'),arrow('a',285,160,350,160),arrow('b',615,160,550,160),X('cap',105,310,'“누가”',18,'middle'),X('cap2',450,310,'“무엇을 하는가”',18,'middle'),X('cap3',735,310,'“어느 대상에”',18,'middle')
  ]),
  fig(3,'여러 검사는 서로 다른 경계에 있다','세 문은 개념적 검사 역할입니다. 실제 호출별 검사 경로와 순서는 구현을 확인해야 하며, 하나의 허용이 전체 허용은 아닙니다.',[
   ...B('user',25,130,135,75,'시스템 콜','purple'),...['seccomp','DAC','LSM'].flatMap((s,i)=>[R('gate'+i,245+i*210,65,65,225,i===2?'orange':'blue'),X('glabel'+i,277+i*210,45,s,18,'middle'),R('opening'+i,245+i*210,150,65,65,'white')]),arrow('path',160,185,850,185,'green'),X('s',240,330,'호출·인자',16),X('d',450,330,'소유·접근',16),X('l',660,330,'추가 정책',16)
  ],380),
  fig(7,'capability 집합은 하나의 root 비트가 아니다','칸은 서로 다른 capability를 상징합니다. effective가 현재 활성인 집합이고 다른 집합은 획득·상속 등의 규칙과 연결됩니다.',[
   ...[['permitted',[1,1,1,0,0],'blue'],['effective',[1,0,1,0,0],'green'],['bounding',[1,1,1,1,0],'purple']].flatMap(([s,b,t],r)=>[X('name'+r,35,85+r*90,s,17),...slots('bits'+r,230,55+r*90,5,b.map(x=>x?'허용':'없음'),b.map(x=>x?t:'muted'),110,50)]),X('note',230,350,'각 행의 의미가 다르며 단순한 포함 그림만으로 exec 규칙을 설명하지 않습니다.',15)
  ],390),
  fig(9,'검사한 이름과 사용한 객체가 달라질 수 있다','왼쪽 검사와 오른쪽 open 사이에서 공격자가 이름 연결을 바꾸는 TOCTOU 예입니다. 안전한 해결은 실제 사용할 객체와 탐색 제약을 기준으로 설계합니다.',[
   ...B('check',40,50,210,60,'1. access(path)','blue'),...B('use',650,50,210,60,'3. open(path)','blue'),...B('name',340,140,220,55,'path 이름','purple'),...B('safe',100,260,230,65,'검사 당시 객체 A','green'),...B('other',580,260,230,65,'교체된 객체 B','orange'),arrow('c',250,80,340,165),arrow('u',650,80,560,165),L('old',390,195,220,260,'muted',false,'6 5'),arrow('new',510,195,690,260,'orange'),X('switch',450,235,'2. 이름 연결 교체',17,'middle','red')
  ],380)],
 scene:scene(5,'거부 지점을 따라가는 요청','기본 접근은 허용된 파일 읽기에서 LSM도 허용하는 경우와 LSM이 거부하는 경우를 비교합니다.',[['allow','모든 검사 허용'],['deny','LSM 정책 거부']],v=>{
  const denied=v.scenario==='deny';const pos=denied?[[90,180],[245,180],[390,180],[540,180],[650,180],[540,320],[300,320],[90,320]]:[[90,180],[245,180],[390,180],[540,180],[650,180],[800,180],[800,320],[90,320]];
  return Array.from({length:8},(_,i)=>frame(['요청 생성','호출 필터','자격 참조','기본 접근 검사','LSM 검사',denied?'거부 결과 생성':'파일 열기',denied?'errno 반환':'fd 결과 생성','사용자 결과 확인'][i],denied&&i>=4?'mode가 허용해도 추가 정책이 거부할 수 있습니다. 실패한 경계의 증거를 조사합니다.':'허용된 호출도 대상과 자격, 정책의 조건을 각각 만족해야 합니다.',[
   ...B('caller',35,65,130,55,'호출자','purple'),...B('target',735,65,130,55,'파일','green'),...['seccomp','credentials','DAC','LSM'].flatMap((s,j)=>[R('gate'+j,220+j*140,145,50,90,j===3&&denied?'red':'blue'),X('name'+j,245+j*140,135,s,15,'middle')]),L('route',90,180,800,180,'muted'),L('return',90,320,800,320,'muted'),...T('request',pos[i][0],pos[i][1],i>=5?(denied?'ERR':'fd'):'R',i>=4&&denied?'red':'green'),X('return-label',450,370,i>=5?(denied?'거부된 호출: 실제 errno·정책 로그 확인':'허용된 호출: 생성한 fd를 반환'):'검사 결과를 기다리는 호출자',17,'middle'),X('note',40,440,'검사 역할을 위한 단순화: 모든 호출의 실제 훅 순서를 재현하지 않습니다.',16)
  ],[['기본 접근','허용'],['LSM 정책',denied?'거부':'허용'],['최종 상태',i<5?'진행 중':denied?'거부':'성공']]));
 },['거부 경계에서 토큰이 대상 파일로 가지 않고 반환되는지 보세요.','같은 실패라도 필요한 정책 증거가 왜 다른지 설명하세요.'],'파일 읽기의 개념적 검사 관계입니다. 실제 시스템 콜별 훅 순서, capability 예외, ACL과 LSM 정책 전체는 생략합니다.')};

 A[23]={figures:[
  fig(1,'하나의 task가 여러 이름 공간에서 보인다','호스트 PID와 컨테이너 PID는 같은 task를 다른 범위에서 가리킬 수 있습니다. namespace는 CPU를 따로 예약하는 기능이 아닙니다.',[
   R('host',40,40,820,270,'blue'),X('hl',60,70,'호스트 PID namespace',18),R('container',360,105,440,165,'purple'),X('cl',380,135,'컨테이너 PID namespace',17),...T('task',570,205,'T','green',35),X('hostpid',95,170,'호스트 PID 12000',17),X('guestpid',570,265,'컨테이너 PID 1',16,'middle'),arrow('same',275,170,535,200),X('note',40,350,'서로 다른 프로세스 두 개가 아니라 같은 작업의 식별 범위가 다릅니다.',16)
  ],390),
  fig(2,'CPU quota는 여러 CPU 시간의 합이다','두 CPU가 25ms씩 실행하면 합계 50 CPU-ms를 사용합니다. 남은 벽시계 시간에 호스트가 한가해도 그룹은 제한될 수 있습니다.',[
   X('c0',45,100,'CPU 0',17),X('c1',45,190,'CPU 1',17),...B('run0',180,65,160,50,'25ms 실행','green'),...B('wait0',340,65,480,50,'예산 소진: 75ms 제한','orange'),...B('run1',180,155,160,50,'25ms 실행','green'),...B('wait1',340,155,480,50,'예산 소진: 75ms 제한','orange'),...ruler('time',180,260,4,160).map(s=>s.type==='text'?{...s,text:String(Number(s.text)*25)}:s),X('scale',500,325,'벽시계 0 → 100ms · 합계 quota 50 CPU-ms',17,'middle')
  ],370),
  fig(3,'부모 한도는 자식별 한도의 합과 다르다','각 자식에 2 CPU 상한이 있어도 부모가 합계 2 CPU로 제한하면 둘이 동시에 4 CPU를 보장받는 것이 아닙니다.',[
   ...B('parent',310,35,280,65,'부모 P · 상한 2 CPU','purple'),...B('a',95,195,260,65,'서비스 A · 상한 2 CPU','blue'),...B('b',545,195,260,65,'서비스 B · 상한 2 CPU','green'),arrow('pa',380,100,225,195),arrow('pb',520,100,675,195),...B('budget',310,290,280,45,'A + B ≤ 부모 예산','orange'),L('la',225,260,310,310),L('lb',675,260,590,310)
  ],380),
  fig(10,'VM에는 두 스케줄링 경계가 있다','게스트 작업은 게스트 스케줄러가 고르고 vCPU 실행은 호스트가 배정합니다. 컨테이너의 커널 공유 모델과 다른 경계입니다.',[
   R('host',35,35,830,280,'blue'),X('h',55,65,'호스트 Linux',18),R('vm',85,90,360,165,'purple'),X('g',105,120,'게스트 Linux',17),...B('gt',110,155,125,60,'게스트 task','green'),...B('vcpu',280,155,130,60,'vCPU','purple'),...B('hosttask',560,155,240,60,'호스트 vCPU 스레드','blue'),arrow('gs',235,185,280,185),arrow('hs',410,185,560,185),...B('physical',280,345,330,45,'물리 CPU의 실행 시간','green'),arrow('ph',680,215,500,345)
  ],430)],
 scene:scene(6,'남은 CPU와 제한된 작업','두 작업이 두 CPU에서 동시에 실행하려고 할 때 기간당 합계 quota를 비교합니다.',[['tight','quota 50 / period 100'],['wide','quota 200 / period 100']],v=>{
  const quota=v.scenario==='tight'?50:200,times=[0,10,20,30,45,60,80,100];return times.map((time,i)=>{const used=Math.min(quota,time*2),blocked=time*2>=quota&&quota<200;const x=180+Math.min(time,quota/2)*6;return frame(blocked?'예산 소진: 그룹 제한':used===quota?'해당 기간 실행 완료':'두 CPU에서 실행','두 CPU의 사용 시간은 합산됩니다. namespace 격리 여부와 CPU 예산은 별개입니다.',[
   X('cpu0',40,95,'CPU 0',17),X('cpu1',40,190,'CPU 1',17),R('track0',180,60,600,60,'muted'),R('track1',180,155,600,60,'muted'),R('used0',180,60,Math.min(time,quota/2)*6,60,'green'),R('used1',180,155,Math.min(time,quota/2)*6,60,'green'),...B('wait',240,290,500,75,'',blocked?'orange':'green'),X('wait-caption',490,390,blocked?'그룹 대기: 다음 기간의 예산 필요':used===quota?'해당 기간 실행 완료':'실행 가능: 예산이 남아 있음',16,'middle'),...T('task0',blocked?390:x,blocked?325:90,'A',blocked?'orange':'blue'),...T('task1',blocked?600:x,blocked?325:185,'B',blocked?'orange':'purple'),L('clock',180+time*6,40,180+time*6,240,'red',false,'5 5'),X('clock-label',180+time*6,265,time+'ms',16,'middle','red'),X('sum',450,420,'합계 사용량 '+used+' / '+quota+' CPU-ms',18,'middle')
  ],[['벽시계',time+'ms'],['사용한 CPU 시간',used+' CPU-ms'],['그룹 상태',blocked?'throttled':used===quota?'기간 실행 완료':'실행']]);});
 },['두 실행 막대의 길이를 더해 사용한 CPU 시간을 계산하세요.','빨간 시간선은 움직이는데 작업은 대기 영역에 머무는 구간을 보세요.'],'두 CPU의 고정된 계산 작업을 한 100ms 기간 동안 단순화했습니다. 마지막 프레임은 기간 끝 직전의 상태이며 예산 갱신, 부모 제한, 실제 bandwidth 분배 세부사항은 생략합니다.')};

 A[24]={figures:[
  fig(2,'read의 인자가 콜백의 상태로 연결된다','사용자 버퍼와 커널 상수 버퍼는 서로 다른 주소 공간입니다. count와 pos를 사용해 부분 읽기와 EOF를 처리합니다.',[
   ...band('user',35,'사용자 공간','purple',75),...slots('ub',440,52,5,['?','?','?','?','?'],'purple',65,40),...band('kernel',180,'커널 공간','blue',100),...slots('kb',440,215,5,['H','E','L','L','O'],'green',65,40),arrow('copy',620,215,620,94,'green'),X('api',350,150,'simple_read_from_buffer',18),X('count',55,325,'count: 최대 크기',17),X('pos',340,325,'pos: 다음 읽을 위치',17),X('ret',640,325,'반환: n / 0 / 오류',17)
  ],370),
  fig(3,'초기화 실패는 획득한 자원을 역순으로 돌려준다','층은 자원 획득 순서입니다. 중간 실패에서 아직 획득하지 않은 자원을 해제하지 않고 이미 가진 자원부터 되돌립니다.',[
   X('init',190,35,'초기화',18,'middle'),X('exit',690,35,'실패·종료 정리',18,'middle'),...['메모리','작업·타이머','장치 등록'].flatMap((s,i)=>[...B('acq'+i,65,70+i*80,250,55,s,'blue'),...B('rel'+i,565,70+(2-i)*80,250,55,s+' 해제','orange'),arrow('pair'+i,315,97+i*80,565,97+(2-i)*80,'muted')]),arrow('down',35,90,35,280,'blue'),arrow('up',850,90,850,280,'orange')
  ]),
  fig(4,'참조가 남은 코드와 데이터를 먼저 지우면 안 된다','열린 fd와 비동기 작업은 서로 다른 참조 경로입니다. 실제 제거 코드는 새 진입 차단과 기존 사용 종료를 모두 검토합니다.',[
   ...B('fd',45,55,220,70,'열린 fd 참조','blue'),...B('work',45,235,220,70,'예약된 work / timer','purple'),...B('module',410,95,380,175,'모듈 코드 + 데이터\n아직 사용 중','green'),arrow('f',265,90,410,145,'blue'),arrow('w',265,270,410,215,'purple'),X('owner',280,65,'.owner',16),X('async',280,305,'취소·동기화',16),X('note',410,335,'ref = 0만 보고 모든 비동기 수명을 생략하지 않음',15)
  ],380),
  fig(9,'검증은 한 번의 빌드로 끝나지 않는다','각 열은 다른 실패 경계입니다. 위쪽 결과가 성공해도 오른쪽 단계가 실행되었다는 증거는 아닙니다.',[
   ...['빌드','적재','노드 생성','read / EOF','제거'].flatMap((s,i)=>[R('column'+i,30+i*175,55,155,235,i===0?'blue':'muted'),X('title'+i,107+i*175,90,s,17,'middle'),C('check'+i,107+i*175,145,20,i<2?'green':'orange'),X('result'+i,107+i*175,151,i<2?'✓':'?',17,'middle'),X('evidence'+i,107+i*175,215,['.ko','insmod','/dev','바이트·0','rmmod'][i],16,'middle')]),X('note',40,340,'각 단계의 출력과 실제 실행 여부를 따로 기록합니다.',17)
  ],380)],
 scene:scene(8,'참조가 남았는데 제거를 요청하면','정상 종료 순서와 열린 fd가 있는 동안 제거를 시도하는 경우를 비교합니다.',[['ordered','읽기·작업 종료 뒤 제거'],['early','열린 상태에서 제거 시도']],v=>{
  const early=v.scenario==='early';return Array.from({length:8},(_,i)=>{const refs=i<2?0:i<5?1:0,pending=i>=2&&i<6,removed=i===7;const request=early&&i===3;const pos=[[100,145],[300,90],[520,190],[650,190],[740,90],[370,315],[670,315],[800,315]][i];if(request){pos[0]=230;pos[1]=205;}return frame(['모듈 준비','장치 등록','fd 열기',request?'rmmod 거부: 사용 중':'read 실행','사용자 데이터 수신','fd 닫기','작업 종료 확인','정상 제거'][i],request?'열린 참조가 있는 정상 제거는 거부됩니다. 강제로 제거하지 않고 사용 종료를 기다립니다.':'등록된 연산과 비동기 작업의 수명을 확인한 뒤 코드를 제거합니다.',[
   ...B('user',35,55,200,70,'사용자 프로그램','purple'),...B('device',330,55,210,70,'/dev/kernel_lesson','blue'),...B('module',330,165,480,90,removed?'모듈 제거됨':'모듈 코드·데이터',removed?'muted':'green'),...B('work',330,290,480,70,pending?'비동기 작업 남음':'비동기 작업 없음',pending?'orange':'muted'),arrow('fd-ref',435,125,435,165,refs?'blue':'muted'),arrow('work-ref',700,290,700,255,pending?'purple':'muted'),...T('actor',pos[0],pos[1],i<5?'R':i===7?'끝':'정리',request?'red':'blue'),X('ref',85,200,'열린 참조: '+refs,18),X('pending',85,245,'작업: '+(pending?'남음':'없음'),18),X('state',85,400,request?'사용 중인 코드 보호: 제거 요청 거부':removed?'새 참조와 진행 중 작업이 없어진 뒤 제거':'새 진입 차단과 기존 사용 종료는 별도 책임',17)
  ],[['열린 fd',String(refs)],['비동기 작업',pending?'남음':'없음'],['제거',removed?'완료':request?'거부':'미실행']]);});
 },['rmmod 거부가 수명 보호 동작인 이유를 설명하세요.','fd가 닫힌 뒤에도 남은 작업의 화살표가 있는지 보세요.'],'실제 예제는 비동기 작업이 없는 읽기 전용 miscdevice입니다. 장면의 work는 확장 드라이버의 수명 문제를 설명하기 위한 가정이며 실제 모듈 참조 구현 전체를 재현하지 않습니다.')};
 A[25]={figures:[
  fig(1,'실행 시간축과 샘플은 같은 기록이 아니다','짧은 함수 B가 샘플 사이에 들어가면 실행했어도 표본에 없을 수 있습니다. 샘플 부재만으로 실행 부재를 단정하지 않습니다.',[
   X('exe',35,85,'실제 실행',17),...B('a',200,55,280,45,'함수 A','blue'),...B('b',480,55,70,45,'B','orange'),...B('c',550,55,280,45,'함수 A','blue'),X('samples',35,200,'샘플 시점',17),L('axis',200,180,830,180),...[240,390,600,760].flatMap((x,i)=>[C('sample'+i,x,180,9,'purple'),L('drop'+i,x,100,x,180,'muted',false,'4 4'),X('s'+i,x,220,'A',16,'middle')]),X('miss',515,275,'B 표본 없음 ≠ B 실행 없음',17,'middle','orange'),L('focus',515,100,515,250,'orange',false,'4 4')
  ]),
  fig(3,'flame graph의 가로는 시간 순서가 아니다','폭은 같은 비용 단위로 집계한 양입니다. 아래 부모 경로 위에 자식 경로가 쌓이며 왼쪽에서 오른쪽으로 시간이 흐르지 않습니다.',[
   ...B('root',60,260,780,50,'요청 처리 · 전체 표본','purple'),...B('read',60,205,450,50,'파일 처리','blue'),...B('parse',515,205,325,50,'파싱','orange'),...B('vfs',60,150,300,50,'VFS 경로','blue'),...B('copy',365,150,145,50,'복사','green'),...B('decode',515,150,220,50,'decode','orange'),...B('other',740,150,100,50,'기타','muted'),X('width',450,95,'폭 = 집계 비용 · 위아래 = 호출 관계',18,'middle')
  ]),
  fig(6,'wakeup과 실제 실행 사이를 연결한다','같은 작업 T의 wakeup과 sched_switch-in을 연결해야 runnable 대기를 추정할 수 있습니다. 인접한 로그 두 줄만 빼지 않습니다.',[
   ...lifeline('waker',130,'깨우는 작업',85,310),...lifeline('target',460,'작업 T',85,310),...lifeline('cpu',790,'CPU',85,310),arrow('wake',130,125,460,125,'blue'),X('w',285,105,'10.000ms wakeup',16,'middle'),arrow('switch',790,265,460,265,'green'),X('s',635,245,'10.800ms switch-in',16,'middle'),R('wait',435,130,50,130,'orange'),X('delay',280,210,'0.800ms\n실행 배정 대기',17,'middle'),X('note',450,355,'이 구간에 T가 CPU를 계산에 쓴 것은 아닙니다.',16,'middle')
  ],390),
  fig(8,'원시 이벤트와 map 집계는 다른 양을 전송한다','각 이벤트를 출력하는 대신 커널에서 bucket을 증가시키면 사용자 공간으로 보내는 양을 줄일 수 있습니다. hook과 map 갱신 비용은 남습니다.',[
   ...slots('events',40,60,8,['e','e','e','e','e','e','e','e'],'purple',55,40),X('el',40,135,'많은 원시 사건',17),arrow('agg',300,150,300,210,'blue'),...Array.from({length:5},(_,i)=>[R('hist'+i,80+i*90,320-[35,70,110,60,25][i],65,[35,70,110,60,25][i],'blue'),X('bucket'+i,112+i*90,345,String(i),15,'middle')]).flat(),...B('summary',640,225,210,80,'히스토그램 회수\n집계값만 전달','green'),arrow('send',530,270,640,270,'green'),X('remaining',620,130,'수집 비용 ≠ 0\n키 제한·손실 확인',17)
  ],380)],
 scene:scene(5,'샘플 시점이 짧은 함수를 놓친다','같은 실행 타임라인에서 10ms 간격과 2ms 간격의 샘플을 비교합니다.',[['sparse','10ms 간격 · 위상 8ms'],['dense','2ms 간격 · 위상 0ms']],v=>{
  const dense=v.scenario==='dense',period=dense?2:10,phase=dense?0:8,times=[0,4,8,12,16,20,24,28];return times.map((time,i)=>{const samples=[];for(let t=phase;t<=time;t+=period)samples.push(t);const hit=samples.filter(t=>t>=10&&t<16).length;return frame('관측 시간 '+time+'ms',dense?'짧은 함수 B의 실행 구간 안에도 표본이 생깁니다.':'8ms와 18ms 사이에서 실행된 B는 이 표본 위상에서 빠집니다.',[
   X('exec',35,85,'실행',17),...B('a',170,55,220,60,'A','blue'),...B('b',390,55,132,60,'짧은 B','orange'),...B('a2',522,55,308,60,'A','blue'),X('sample',35,230,'표본',17),L('sample-axis',170,215,830,215),...samples.flatMap((t,j)=>[L('stem'+j,170+t*22,115,170+t*22,215,t>=10&&t<16?'orange':'purple',false,'4 4'),...T('sample'+j,170+t*22,215,t>=10&&t<16?'B':'A',t>=10&&t<16?'orange':'purple',16)]),L('clock',170+time*22,35,170+time*22,270,'red'),X('time',170+time*22,300,time+'ms',16,'middle','red'),...B('count',210,350,250,60,'전체 표본 '+samples.length,'purple'),...B('bcount',500,350,250,60,'B 표본 '+hit,hit?'green':'orange'),...T('cursor',170+time*22,140,'t','red',18)
  ],[['표본 간격',period+'ms'],['전체 표본',String(samples.length)],['B 표본',String(hit)]]);});
 },['B의 폭은 같은데 표본 결과가 달라지는지 보세요.','더 촘촘한 표본이 비용과 데이터 양에 주는 영향을 설명하세요.'],'28ms의 결정적 실행 모형입니다. 실제 perf의 하드웨어 이벤트, 주기 jitter, CPU 이동과 계측 오버헤드는 구현하지 않습니다.')};

 A[26]={figures:[
  fig(1,'100ms를 실행과 기다림으로 나눈다','같은 요청의 서로 겹치지 않는 개념 구간입니다. on-CPU 프로파일은 파란 실행 구간을 주로 설명하고 나머지 대기는 별도 관측이 필요합니다.',[
   X('total',40,60,'요청 전체 100ms',19),...B('cpu',45,110,160,65,'CPU 20','blue'),...B('db',205,110,400,65,'외부 응답 50','green'),...B('runq',605,110,160,65,'runnable 20','orange'),...B('other',765,110,80,65,'기타\n10','purple'),L('axis',45,220,845,220),...[0,20,70,90,100].flatMap((n,i)=>[L('tick'+i,45+n*8,210,45+n*8,230),X('n'+i,45+n*8,260,String(n)+'ms',16,'middle')]),X('question',45,325,'CPU 함수만 최적화하면 어느 구간까지 줄일 수 있을까요?',18)
  ],380),
  fig(2,'사용률과 포화는 다른 질문이다','오른쪽은 CPU가 바쁜 것뿐 아니라 실행할 작업이 기다립니다. 초록은 실행, 주황은 대기이며 실제 평균값이 아닌 상태 비교입니다.',[
   ...B('cpuA',100,105,160,80,'CPU 실행','green'),...T('taskA',180,225,'A','green'),X('labelA',180,55,'바쁘지만 대기 없음',18,'middle'),...B('cpuB',600,105,160,80,'CPU 실행','green'),...T('taskB',680,225,'B','green'),...slots('waiting',460,295,5,['C','D','E','F','G'],'orange',65,40),X('labelB',650,55,'바쁘고 runnable 큐 존재',18,'middle'),arrow('queue-to-cpu',630,295,650,245,'orange'),X('empty',180,310,'큐 0',17,'middle')
  ],390),
  fig(5,'병렬 span을 더하면 벽시계보다 커진다','두 외부 조회는 동시에 시작합니다. 응답은 늦게 끝나는 의존 경로에 맞춰 진행하므로 겹친 시간을 중복 합산하지 않습니다.',[
   X('req',35,60,'요청',17),...B('pre',180,35,120,45,'준비','blue'),...B('end',750,35,100,45,'응답','blue'),X('q1',35,165,'조회 A',17),...B('a',300,140,230,50,'40ms','green'),X('q2',35,260,'조회 B',17),...B('b',300,235,450,50,'80ms','purple'),arrow('fork1',300,65,300,140),arrow('fork2',300,65,300,235),arrow('join1',530,165,750,65),arrow('join2',750,260,750,80),X('note',180,340,'critical path: 준비 → 느린 조회 B → 응답',17)
  ],380),
  fig(10,'성능 비교는 같은 일을 했는지부터 본다','요청 수와 정확성 조건이 같아야 지연 감소를 개선으로 해석할 수 있습니다. 아래는 교육용 비교 축이며 실제 벤치마크가 아닙니다.',[
   ...['완료 요청','p99 지연','오류 수','CPU 시간'].flatMap((s,i)=>[X('metric'+i,80+i*215,55,s,17,'middle'),R('before'+i,35+i*215,95,45,[170,150,20,140][i],'blue'),R('after'+i,90+i*215,95,45,[170,80,20,105][i],'green'),X('b'+i,57+i*215,300,'전',16,'middle'),X('a'+i,112+i*215,300,'후',16,'middle')]),X('note',40,350,'같은 처리량·오류 조건을 유지하면서 지연과 비용을 비교합니다.',17)
  ],390)],
 scene:scene(5,'진행하지 못한 구간을 찾아라','같은 CPU 실행량에서 runnable 대기와 I/O 대기의 위치를 바꿔 봅니다.',[['runq','CPU 배정 대기가 큼'],['io','I/O 대기가 큼']],v=>{
  const io=v.scenario==='io';const xs=[100,220,330,450,570,690,790,790],ys=io?[90,90,230,230,230,90,90,350]:[230,230,230,90,90,230,90,350];
  return Array.from({length:8},(_,i)=>frame(['요청 도착','첫 진행','대기 구간','상태 유지','진행 재개','남은 처리','응답 준비','완료'][i],io?'I/O 대기는 실행할 데이터나 완료를 기다리는 구간입니다.':'runnable 작업은 실행 가능하지만 CPU를 아직 받지 못한 상태입니다.',[
   ...band('cpu',45,'CPU에서 실행','blue',90),...band('wait',185,io?'I/O 완료 대기':'runnable · CPU 배정 대기','orange',90),...band('done',315,'요청 완료','green',70),...T('req',xs[i],ys[i],'R',ys[i]===230?'orange':i===7?'green':'blue'),...Array.from({length:i+1},(_,j)=>R('seg'+j,180+j*75,420,65,25,ys[j]===230?'orange':j===7?'green':'blue')),X('legend',40,465,'막대는 단계별 상태 이력이며 실제 밀리초 비율이 아닙니다.',16)
  ],[['주요 대기',io?'I/O 완료':'CPU 배정'],['현재 상태',i===7?'완료':ys[i]===230?'대기':'실행'],['다음 관측',io?'I/O 경로·장치·소켓':'스케줄링·quota·경쟁']]));
 },['같은 CPU 실행량이라도 대기 원인이 달라지면 조사 도구가 왜 달라지나요?','대기 상태를 CPU 프로파일의 실행 시간으로 읽지 마세요.'],'한 요청의 순차 실행·대기를 개념적으로 분리합니다. 단계 간격은 실제 시간이나 성능 개선 수치를 의미하지 않습니다.')};

 A[27]={figures:[
  fig(2,'오류가 드러난 스택과 최초 원인은 다를 수 있다','위쪽 오류 접근 이전에 다른 실행 경로가 객체를 해제했을 수 있습니다. 오류 줄의 NULL 검사만으로 수명 규약을 고쳤다고 말하지 않습니다.',[
   ...['timer_callback · 오류 접근','timer 실행 경로','커널 이벤트 처리'].flatMap((s,i)=>B('stack'+i,45,70+i*65,360,55,s,i===0?'red':'blue')),...B('object',590,85,230,85,'객체 R\n이미 해제됨','red'),...B('free',590,240,230,60,'worker_cleanup','purple'),arrow('access',405,95,590,120,'red'),arrow('freed',705,240,705,170,'purple'),X('cap',45,330,'현재 call trace',17),X('past',590,335,'과거의 해제 경로',17)
  ],380),
  fig(5,'객체 수명의 올바른 순서를 먼저 적는다','초록 구간은 참조가 유효한 범위입니다. 타이머가 읽기 전에 해제하는 아래 순서는 use-after-free를 만들 수 있습니다.',[
   X('good',35,75,'정상',17),...B('live',180,45,480,50,'참조 유지','green'),...B('freed',660,45,170,50,'해제 후','muted'),...['할당','타이머 완료','마지막 해제'].flatMap((s,i)=>X('good-label'+i,[180,530,660][i],125,s,16,'middle')),X('bad',35,220,'오류',17),...B('badlive',180,190,200,50,'유효','green'),...B('badfree',380,190,450,50,'해제된 메모리','red'),...T('read',650,275,'읽기','red',25),arrow('readarrow',650,250,650,240,'red'),X('bad-label',380,285,'먼저 free',16,'middle'),X('note',180,345,'NULL이 아닌 포인터도 이미 해제된 객체를 가리킬 수 있습니다.',16)
  ],390),
  fig(9,'락 순서의 순환은 실제 멈춤 이전에도 문제다','경로 1은 A를 보유한 채 B를, 경로 2는 B를 보유한 채 A를 얻으려 합니다. lockdep은 관측된 의존 관계를 검사합니다.',[
   ...T('lockA',250,155,'A','blue',55),...T('lockB',650,155,'B','purple',55),D.path('ab','M 285 115 Q 450 0 615 115','blue'),D.path('ba','M 615 195 Q 450 315 285 195','purple'),arrow('abtip',590,98,615,115,'blue'),arrow('batip',310,213,285,195,'purple'),X('top',450,65,'경로 1: A 보유 → B 획득',17,'middle'),X('bottom',450,300,'경로 2: B 보유 → A 획득',17,'middle'),X('note',450,350,'메모리 접근 오류 검출기 KASAN과는 다른 질문',16,'middle')
  ],390),
  fig(8,'kdump 준비와 실제 수집을 분리한다','예약 메모리와 적재된 crash kernel은 준비 조건입니다. 실제 vmcore 저장과 분석 가능 여부는 뒤 단계에서 확인합니다.',[
   R('ram',45,65,810,100,'blue'),...B('normal',60,80,550,70,'장애 당시 커널 메모리','blue'),...B('reserve',625,80,215,70,'예약된 crash 영역','purple'),arrow('boot',730,165,730,235,'purple'),...B('capture',590,235,250,65,'수집 커널 실행','purple'),...B('dump',60,235,330,65,'vmcore 저장·검증','green'),arrow('save',590,265,390,265,'green'),X('note',45,345,'적재 표시 하나가 전체 수집 경로의 성공을 증명하지 않습니다.',17)
  ],390)],
 scene:scene(5,'타이머보다 먼저 해제된 객체','타이머 종료를 기다린 정상 정리와 cleanup이 먼저 객체를 해제한 경우를 비교합니다.',[['safe','타이머 종료 뒤 해제'],['uaf','cleanup이 먼저 해제']],v=>{
  const bad=v.scenario==='uaf';return Array.from({length:8},(_,i)=>{const freed=bad?i>=3:i>=6,access=i>=4&&i<=5;const pos=[[120,155],[350,105],[700,155],[700,230],[530,185],[450,185],[280,350],[140,350]][i];return frame(['객체 할당','타이머 등록','참조 유지',bad?'worker가 먼저 free':'타이머 시작','타이머 접근',bad?'해제된 객체 접근 감지':'정상 읽기 완료','마지막 참조 정리','결과 확인'][i],bad&&access?'오류는 타이머에서 발견되지만 잘못된 수명 전이는 앞선 cleanup에 있습니다.':'객체를 사용하는 모든 경로가 끝나는 조건을 확인합니다.',[
   ...B('worker',40,60,200,70,'worker','blue'),...B('timer',660,60,200,70,'timer','purple'),...B('object',320,190,270,100,freed?'객체 R · 해제됨':'객체 R · 유효',freed?'red':'green'),arrow('ref-worker',240,95,370,190,'blue'),arrow('ref-timer',760,130,540,190,'purple'),...T('actor',pos[0],pos[1],access?'읽기':i<3?'R':'정리',bad&&access?'red':'blue'),...(freed?[L('cross1',335,205,575,275,'red'),L('cross2',575,205,335,275,'red')]:[]),...B('result',310,365,520,60,bad&&i>=5?'UAF: 해제·접근 순서가 뒤집힘':i>=6?'모든 사용 종료 뒤 반환':'수명 규약을 추적 중',bad&&i>=5?'red':'green')
  ],[['객체',freed?'해제됨':'유효'],['타이머',i<3?'예약':i<6?'실행':'종료'],['검사',bad&&i>=5?'use-after-free':'이 모형에서 수명 유지']]);});
 },['객체가 해제되는 프레임과 타이머 읽기 프레임의 순서를 비교하세요.','오류가 드러난 함수와 최초 잘못된 전이를 구분하세요.'],'교육용 객체·타이머 수명 모형입니다. 실제 panic·메모리 접근을 실행하지 않으며 모든 KASAN 모드의 보고 형식을 재현하지 않습니다.')};

 A[28]={figures:[
  fig(1,'한 증상을 네 가설로 분해한다','p99 증가를 네 자원 경계에 연결합니다. 가지마다 기대되는 관측이 다르며 한 지표만으로 전체 원인을 확정하지 않습니다.',[
   ...B('symptom',320,30,260,55,'p99 증가','red'),...[['CPU 경쟁','runnable 대기'],['메모리 압력','reclaim · PSI'],['I/O 지연','큐 · block latency'],['cgroup 제한','cpu.stat 증가']].flatMap(([s,t],i)=>[...B('h'+i,25+i*220,165,190,65,s,'blue'),X('e'+i,120+i*220,285,t,16,'middle'),arrow('branch'+i,450,85,120+i*220,165)]),X('note',40,345,'관측 범위와 시간 구간을 먼저 맞춥니다.',17)
  ],390),
  fig(5,'서로 다른 범위의 수치를 한 줄로 섞지 않는다','호스트 평균과 서비스 cgroup 제한은 다른 범위입니다. 같은 시간 구간에서도 서로 다른 질문에 답합니다.',[
   R('host',35,40,830,265,'blue'),X('hl',55,75,'호스트: 8 vCPU · 평균 사용률 25%',18),R('cg',390,110,420,150,'purple'),X('cl',410,145,'서비스 cgroup',18),...B('quota',425,175,350,55,'cpu.max = 100000 100000','orange'),...slots('cpu',60,130,4,['0','1','2','3'],['green','muted','muted','muted'],60,45),...slots('cpu2',60,195,4,['4','5','6','7'],'muted',60,45),X('note',35,350,'호스트 여유와 그룹의 예산 소진은 동시에 존재할 수 있습니다.',17)
  ],390),
  fig(7,'critical path는 가장 늦은 의존 경로를 따른다','두 조회가 병렬이면 기간을 단순 합산하지 않습니다. 앞선 CPU 정지가 두 조회의 시작을 함께 늦출 수 있습니다.',[
   ...B('cpu',35,35,150,50,'CPU 준비','blue'),...B('throttle',185,35,200,50,'quota 대기','orange'),...B('qa',385,135,220,55,'조회 A · 40ms','green'),...B('qb',385,245,400,55,'조회 B · 80ms','purple'),...B('response',790,135,90,165,'응답','blue'),arrow('a',385,60,385,135),arrow('b',385,60,385,245),arrow('aj',605,162,790,200),arrow('bj',785,272,790,230),X('note',40,350,'응답 말미의 I/O 대기만 보고 최초 지연 원인을 단정하지 않습니다.',16)
  ],390),
  fig(10,'전후 비교에서 같은 처리량을 유지했는가','가운데 경우는 지연이 줄었지만 완료 요청도 줄었습니다. 같은 일을 더 빠르게 했다는 결론과 부하를 낮춘 결과를 구분합니다.',[
   ...[['기준',200,240,'blue'],['부하 감소',100,90,'orange'],['동일 부하 개선',200,90,'green']].flatMap(([s,r,p,t],i)=>[X('name'+i,155+i*290,45,s,17,'middle'),R('req'+i,75+i*290,90,60,r*.7,t),R('lat'+i,155+i*290,90,60,p*.7,t),X('rv'+i,105+i*290,280,r+'/s',16,'middle'),X('pv'+i,185+i*290,280,p+'ms',16,'middle'),X('rl'+i,105+i*290,315,'완료율',15,'middle'),X('pl'+i,185+i*290,315,'p99',15,'middle')]),X('note',35,365,'교육용 수치: 오류·자원 비용·이웃 영향도 별도로 확인합니다.',16)
  ],405)],
 scene:scene(6,'증거가 달라지면 다음 조사도 달라진다','같은 느린 요청에서 quota 제한 사례와 저장소 지연 사례를 비교합니다.',[['quota','CPU quota 제한 사례'],['disk','저장소 대기 사례']],v=>{
  const disk=v.scenario==='disk',pos=disk?[[110,90],[260,90],[400,90],[520,230],[650,230],[770,230],[770,90],[770,365]]:[[110,90],[260,230],[400,230],[520,90],[650,90],[770,90],[770,90],[770,365]];return Array.from({length:8},(_,i)=>frame(['요청 수집','시간 구간 맞춤','대기 포착','관련 카운터 확인','가설 좁히기','통제 실험 설계','다른 지표 확인','근거와 한계 기록'][i],disk?'I/O 지연과 장치 큐가 같은 구간에 증가했습니다. quota 처방을 반복하지 않고 저장 경로를 조사합니다.':'cpu.stat의 제한 증가와 실행 대기가 겹칩니다. 호스트 평균이 낮아도 그룹 제한 가설은 남습니다.',[
   ...band('run',45,'요청의 CPU 실행','blue',85),...band('wait',185,disk?'저장소 완료 대기':'그룹 CPU 예산 대기','orange',85),...band('report',325,'관측 → 가설 → 검증 계획','green',80),...T('request',pos[i][0],pos[i][1],'R',pos[i][1]===230?'orange':'blue'),...B('evidence1',110,425,320,55,disk?'block 지연: 증가':'nr_throttled: 증가','orange'),...B('evidence2',470,425,320,55,disk?'quota 제한: 뚜렷하지 않음':'I/O 지연: 이전과 유사','green'),...Array.from({length:i+1},(_,j)=>R('history'+j,180+j*75,285,65,20,pos[j][1]===230?'orange':'blue'))
  ],[['우선 가설',disk?'저장 경로 지연':'CPU quota 제한'],['다음 확인',disk?'큐·서비스·완료 경계':'실행 대기와 제한 구간'],['결론 수준','교육용 증거로 가설 강화']]));
 },['같은 주황 대기라도 조사할 자원과 카운터가 왜 다른가요?','카운터 증가와 개별 요청의 인과관계를 확인할 다음 실험을 말해 보세요.'],'실제 서버 계측이 아닌 두 교육용 사례입니다. 가설을 강화하는 증거를 보여주며 단일 카운터로 인과관계를 확정하지 않습니다.',530)};
})(globalThis.KernelDrawing,globalThis.KernelAtlas ||= {});
