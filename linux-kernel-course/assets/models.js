/* Deterministic teaching models. These are not kernel benchmarks or emulators. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KernelModels = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const experiments = {}, models = {};
  const range = (id,label,min,max,value,unit='',step=1) => ({id,label,min,max,value,unit,step});
  const select = (id,label,choices,value) => ({id,label,options:choices.map(([value,label])=>({value:String(value),label})),value:String(value)});
  const onoff = (id,label,value=0) => select(id,label,[[0,'아니요'],[1,'예']],value);
  const metric = (label,value) => ({label,value:String(value)});
  const bar = (label,value,max,tone='accent') => ({label,value,max,tone});
  const item = (label,detail,tone='accent') => ({label,detail,tone});
  const result = (metrics,bars,items,explanation) => ({metrics,bars,items,explanation});
  function add(id,title,description,controls,presets,limitations,run) {
    experiments[id]={title,description,controls,presets:presets.map(([label,values])=>({label,values})),limitations};
    models[id]=run;
  }
  add(1,'사용자 코드와 커널 경계','같은 64개 레코드를 한 번씩 쓰거나 모아서 쓸 때 경계 통과가 어떻게 달라지는지 비교합니다.',
    [range('batch','한 번의 write에 담는 레코드',1,64,1,'개')],
    [['하나씩 쓰기',{batch:1}],['16개씩 모으기',{batch:16}]],
    '64개 레코드가 모두 성공적으로 기록되는 동기 write 호출 모델입니다. 실제 write는 부분 쓰기·재시도가 생길 수 있습니다. 호출 수 감소가 같은 비율의 속도 향상을 뜻하지 않습니다.',v=>{
      const calls=Math.ceil(64/v.batch);
      return result([metric('시스템 콜',calls+'회'),metric('모드 경계 통과',calls*2+'회'),metric('총 레코드','64개')],[bar('커널 진입',calls,64),bar('사용자 모드 복귀',calls,64)],
        [item('애플리케이션',v.batch+'개씩 버퍼를 구성합니다.'),item('커널',calls+'번의 write 요청을 받아 파일 처리 경로로 보냅니다.')],
        '레코드 수는 같아도 호출 횟수는 달라집니다. 라이브러리 버퍼링은 커널을 없애는 것이 아니라 경계를 넘는 단위를 바꿉니다.');
    });
  add(2,'모드 전환과 문맥 교환','시스템 콜 도중 작업이 잠드는 경우와 같은 작업이 곧바로 돌아오는 경우를 구분합니다.',
    [range('calls','시스템 콜 수',1,10,4,'회'),onoff('block','매 호출에서 I/O를 기다리는가')],
    [['즉시 반환',{calls:4,block:'0'}],['매번 대기',{calls:4,block:'1'}]],
    '대기 때마다 다른 작업 B로 갔다가 A로 돌아온다고 가정합니다. 실제 문맥 교환 수는 선점·동시 작업·완료 시점에 따라 달라집니다.',v=>{
      const switches=v.block==='1'?v.calls*2:0;
      return result([metric('모드 전환',v.calls*2+'회'),metric('문맥 교환',switches+'회')],[bar('모드 전환',v.calls*2,20),bar('문맥 교환',switches,20,'warn')],
        [item('실행 경로',v.block==='1'?'A 사용자 → A 커널 → B 실행 → A 커널 → A 사용자':'A 사용자 → A 커널 → A 사용자'),item('핵심 구분','모드는 권한 수준, 문맥은 실행 중인 task의 상태입니다.')],
        '커널 모드에 들어갔다고 반드시 다른 프로세스가 실행되는 것은 아닙니다. 잠들거나 선점되어 실행 주체가 바뀔 때 문맥 교환이 필요합니다.');
    });
  add(3,'부팅의 의존성 사슬','부팅 단계를 진행하고 루트 파일 시스템 준비 상태를 바꿔 정지 지점을 찾아봅니다.',
    [range('stage','진행하려는 단계',1,5,5,'단계'),onoff('root','루트 장치를 사용할 수 있는가',1)],
    [['정상 부팅',{stage:5,root:'1'}],['루트 장치 누락',{stage:5,root:'0'}]],
    '펌웨어 → 부트로더 → 커널 초기화 → 실제 루트 준비 → 최종 init의 교육용 순서입니다. initramfs의 /init은 이미 PID 1일 수 있습니다. 여기서는 실제 루트로 전환한 뒤 서비스 관리자를 실행하는 단계를 최종 init으로 표시합니다.',v=>{
      const names=['펌웨어','부트로더','커널 초기화','루트 준비','최종 init'];
      const done=v.root==='0'?Math.min(v.stage,3):v.stage;
      return result([metric('완료 단계',done+'/5'),metric('최종 init',done===5?'실행':'아직 실행 안 됨')],[bar('부팅 진행',done,5)],
        names.map((n,i)=>item(n,i<done?'완료':i===3&&v.root==='0'?'장치·드라이버·root= 설정 확인':'선행 단계 대기',i<done?'accent':'warn')),
        v.root==='0'&&v.stage>=4?'커널이 시작되었다는 사실만으로 사용자 공간까지 도달했다고 볼 수 없습니다. 루트 장치 인식과 마운트 실패 로그를 확인해야 합니다.':'부트로더가 커널을 올린 뒤에도 커널 초기화와 루트 준비가 남아 있습니다. initramfs의 /init이 먼저 사용자 공간 초기화를 진행할 수 있고, 여기서는 실제 루트의 최종 init까지 추적합니다.');
    });
  add(4,'질문에 맞는 관측 지점','조사할 질문과 도구를 골라 그 도구가 실제로 보여주는 증거를 확인합니다.',
    [select('question','조사 질문',[[0,'어느 시스템 콜에서 기다리는가?'],[1,'CPU에서 어떤 함수가 실행되는가?'],[2,'커널이 오류를 기록했는가?']],0),select('tool','관측 도구',[[0,'strace'],[1,'perf record'],[2,'dmesg']],0)],
    [['시스템 콜 대기',{question:'0',tool:'0'}],['CPU 실행 경로',{question:'1',tool:'1'}]],
    '도구의 대표 용도를 비교합니다. 권한·커널 설정·심볼·샘플링 설정에 따라 관측 범위가 달라집니다.',v=>{
      const labels=['시스템 콜과 반환값·대기 시간','CPU 샘플과 호출 스택','커널 로그 메시지']; const fit=v.question===v.tool;
      return result([metric('선택한 증거',labels[+v.tool]),metric('질문과의 적합성',fit?'직접 조사에 적합':'다른 증거 필요')],[bar('질문과 일치',fit?1:0,1,fit?'accent':'warn')],
        [item('볼 수 있는 것',labels[+v.tool]),item('볼 수 없는 것',fit?'한 도구의 결과만으로 모든 원인을 확정할 수는 없습니다.':'관측 대상과 질문이 다릅니다. 도구나 질문을 바꿔 비교하세요.','warn')],
        '도구 이름을 외우기보다 확인하려는 상태를 먼저 정합니다. 커널 로그가 조용하다고 CPU 병목이나 시스템 콜 대기가 없다는 뜻은 아닙니다.');
    });
  add(5,'task 사이에 무엇을 공유할까','별도 프로세스와 같은 프로세스의 스레드가 주소 공간과 파일 테이블을 어떻게 사용하는지 봅니다.',
    [select('mode','생성 방식',[[0,'fork한 별도 프로세스'],[1,'일반적인 pthread 스레드']],0),range('tasks','task 수',2,8,4,'개')],
    [['프로세스 4개',{mode:'0',tasks:4}],['스레드 4개',{mode:'1',tasks:4}]],
    '일반적인 fork와 pthread 생성 계약을 비교합니다. clone 플래그 조합에 따라 공유 관계를 별도로 구성할 수 있습니다. fork의 물리 페이지 COW 공유는 다음 장에서 다룹니다.',v=>{
      const shared=v.mode==='1';const spaces=shared?1:v.tasks;
      return result([metric('task_struct',v.tasks+'개'),metric('주소 공간',spaces+'개'),metric('fd 테이블',spaces+'개')],[bar('task',v.tasks,8),bar('주소 공간',spaces,8)],
        Array.from({length:v.tasks},(_,i)=>item('task '+(i+1),shared?'같은 mm·files 참조, 별도 실행 상태·스택':'독립 mm·fd 테이블, 상속 fd는 같은 열린 파일 참조')),
        '스케줄러는 각 task를 실행합니다. 같은 주소 공간을 공유하면 한 스레드의 메모리 쓰기가 다른 스레드에도 보이므로 동기화가 필요합니다.');
    });
  add(6,'fork 이후 COW','부모의 16개 페이지를 자식이 공유하다 일부 페이지를 수정할 때 실제 페이지 수가 달라집니다.',
    [range('written','자식이 처음 수정한 서로 다른 페이지',0,16,0,'개')],
    [['읽기만 함',{written:0}],['절반 수정',{written:8}]],
    '부모는 수정하지 않고, 16개의 4 KiB 익명 페이지가 COW 공유 중이라고 가정합니다. 페이지 테이블 비용·THP·공유 매핑·추가 할당은 제외합니다.',v=>result(
      [metric('고유 물리 페이지',16+v.written+'개'),metric('공유 유지',16-v.written+'개'),metric('추가 데이터 메모리',v.written*4+' KiB')],
      [bar('공유 페이지',16-v.written,32),bar('부모·자식의 분리 페이지',2*v.written,32,'warn')],
      [item('쓰기 폴트',v.written+'개의 첫 쓰기에서 기존 내용을 복사합니다.'),item('가상 주소','부모와 자식은 같은 가상 주소 값을 가져도 다른 물리 페이지를 참조할 수 있습니다.')],
      'fork 직후 주소 공간은 분리되지만 데이터 페이지는 즉시 전부 복사하지 않습니다. 공유 중인 페이지의 첫 쓰기가 복사 비용을 만듭니다.'));
  add(7,'EEVDF: 자격부터, 그다음 기한','A의 lag와 가상 기한을 바꿔 두 runnable task 중 다음 후보를 고릅니다.',
    [range('lag','A의 lag',-5,5,2,'가상 단위'),range('deadline','A의 가상 기한',1,20,6,'가상 단위')],
    [['A가 먼저',{lag:2,deadline:6}],['빠른 기한이어도 자격 없음',{lag:-2,deadline:2}]],
    '동일 가중치 A/B의 한 번의 선택만 표현합니다. B의 lag는 −A lag, B의 기한은 10입니다. 가상 기한은 실제 시간 제한이 아닙니다. 계층·선점·sleep lag 처리·RT/DL 클래스는 제외합니다.',v=>{
      const eligibleA=v.lag>=0,eligibleB=v.lag<=0;
      const winner=eligibleA&&(!eligibleB||v.deadline<=10)?'A':'B';
      return result([metric('선택 후보',winner),metric('A 자격',eligibleA?'있음':'없음'),metric('B 자격',eligibleB?'있음':'없음')],
        [bar('A 가상 기한',v.deadline,20,eligibleA?'accent':'warn'),bar('B 가상 기한',10,20,eligibleB?'accent':'warn')],
        [item('A','lag '+v.lag+', deadline '+v.deadline+(winner==='A'?' → 선택':''),eligibleA?'accent':'warn'),item('B','lag '+(-v.lag)+', deadline 10'+(winner==='B'?' → 선택':''),eligibleB?'accent':'warn')],
        'lag가 음수이면 자신의 공정한 몫보다 앞서 실행된 상태입니다. 자격 있는 후보들 중 가상 기한이 빠른 task를 고릅니다. 두 lag가 0일 때 기한 비교가 드러납니다.');
    });
  add(8,'깨어남은 실행 시작이 아니다','I/O 완료와 CPU 확보를 별개로 조작해 task 상태를 확인합니다.',
    [onoff('complete','I/O가 완료되었는가'),onoff('cpu','CPU를 배정받았는가')],
    [['I/O 대기',{complete:'0',cpu:'0'}],['깨어났지만 CPU 대기',{complete:'1',cpu:'0'}]],
    '하나의 대기 작업을 설명하는 상태 모델입니다. 실제 TASK_RUNNING은 runnable과 현재 실행을 모두 포함하므로 둘을 교육용으로 구분해 표시합니다.',v=>{
      const state=v.complete==='0'?'sleeping':v.cpu==='0'?'runnable':'running';
      return result([metric('작업 상태',state),metric('대기 원인',state==='sleeping'?'I/O 완료':state==='runnable'?'CPU 배정':'없음')],[bar('I/O 완료',v.complete==='1'?1:0,1),bar('현재 실행',state==='running'?1:0,1)],
        [item('wait queue',state==='sleeping'?'완료 이벤트를 기다립니다.':'완료 조건을 확인하고 대기에서 벗어납니다.'),item('run queue',state==='runnable'?'실행 가능하지만 스케줄러 선택을 기다립니다.':state==='running'?'CPU에서 실행 중입니다.':'아직 실행 후보가 아닙니다.')],
        v.complete==='0'&&v.cpu==='1'?'CPU가 비어 있어도 필요한 I/O가 끝나지 않으면 이 task는 계속 잠듭니다.':'wake-up은 실행 가능 상태로 만드는 일입니다. 실제 CPU 실행 시작까지 추가 지연이 있을 수 있습니다.');
    });
  add(9,'인터럽트를 미루면 어디에 남을까','로컬 CPU에서 마스킹 가능한 IRQ를 잠시 차단했을 때 알림 처리 시점을 봅니다.',
    [onoff('masked','로컬 IRQ가 마스킹되어 있는가',1),onoff('pending','장치의 pending IRQ가 있는가',1)],
    [['IRQ 보류',{masked:'1',pending:'1'}],['마스크 해제',{masked:'0',pending:'1'}]],
    '하나의 pending IRQ를 유지하는 추상 모델입니다. 여러 이벤트가 IRQ 개수와 1:1 대응하지 않습니다. NMI·예외·다른 CPU·장치별 손실 정책은 포함하지 않습니다.',v=>{
      const serviced=v.pending==='1'&&v.masked==='0',held=v.pending==='1'&&!serviced;
      return result([metric('IRQ 처리',serviced?'핸들러 진입':held?'보류':'요청 없음')],[bar('보류된 알림',held?1:0,1,'warn'),bar('핸들러 실행',serviced?1:0,1)],
        [item('장치·컨트롤러',v.pending==='1'?'처리할 알림이 있습니다.':'pending 알림이 없습니다.'),item('현재 CPU',held?'임계 구역을 끝내고 IRQ를 다시 허용해야 합니다.':serviced?'현재 작업을 중단하고 IRQ 핸들러를 실행합니다.':'현재 실행을 계속합니다.')],
        'IRQ를 막는 것은 장치의 동작 자체를 멈추는 것이 아닙니다. 너무 오래 미루면 장치 큐와 후속 처리에 지연이 쌓일 수 있습니다.');
    });
  add(10,'이 문맥에서 잠들어도 될까','실행 문맥과 작업의 대기 필요성을 조합합니다.',
    [select('context','실행 문맥',[[0,'hard IRQ'],[1,'softirq'],[2,'일반 workqueue worker']],0),onoff('sleep','작업이 sleep을 요구하는가',1)],
    [['IRQ에서 대기 필요',{context:'0',sleep:'1'}],['worker로 이관',{context:'2',sleep:'1'}]],
    '기본 비-RT 커널의 대표 문맥 비교입니다. 일반 workqueue라도 spinlock 보유 등 atomic 문맥에서는 잠들 수 없습니다. PREEMPT_RT에서는 문맥과 락 의미를 별도로 확인합니다.',v=>{
      const allowed=v.sleep==='0'||v.context==='2';
      return result([metric('현재 작업',allowed?'문맥 조건 충족':'그대로 실행 불가')],[bar('sleep 가능 문맥',v.context==='2'?1:0,1),bar('작업에 sleep 필요',v.sleep==='1'?1:0,1,'warn')],
        [item('처리 결정',allowed?'다른 잠금·수명 조건도 확인하고 실행합니다.':'최소 처리만 끝내고 sleep 가능한 worker로 넘깁니다.',allowed?'accent':'warn'),item('실행 주체',v.context==='2'?'worker task 문맥':'인터럽트 관련 atomic 문맥')],
        '작업의 길이만으로 처리 위치를 정하지 않습니다. 잠들어야 하는지, 어떤 락을 보유하는지, 어떤 수명을 유지해야 하는지를 함께 확인합니다.');
    });
  add(11,'증가 연산의 잃어버린 갱신','두 스레드가 같은 값을 읽은 뒤 각각 +1을 저장하는 충돌 횟수를 바꿉니다.',
    [range('overlap','겹쳐 실행된 증가 쌍',0,10,6,'쌍'),onoff('locked','증가 전체를 mutex로 보호하는가')],
    [['경쟁 상태',{overlap:10,locked:'0'}],['직렬화',{overlap:10,locked:'1'}]],
    '각 스레드가 10번 증가하는 명시적 read/add/write 인터리빙 모델입니다. 락 없는 C 데이터 경쟁은 언어상 undefined behavior이므로 실제 실행 결과의 범위를 예측하는 모델이 아닙니다.',v=>{
      const lost=v.locked==='1'?0:v.overlap;
      return result([metric('의도한 최종 값',20),metric('모델 최종 값',20-lost),metric('잃어버린 갱신',lost)],[bar('남은 증가',20-lost,20),bar('누락된 증가',lost,20,'warn')],
        [item('충돌 한 쌍','A와 B가 모두 n을 읽고 n+1을 쓰면 두 증가가 한 번으로 합쳐집니다.'),item('보호 범위',v.locked==='1'?'read부터 write까지 하나의 임계 구역으로 보호합니다.':'쓰기 한 줄만이 아니라 read-modify-write 전체가 경쟁합니다.','warn')],
        'mutex나 적절한 atomic 연산은 갱신의 일관성을 지키는 수단입니다. volatile만 추가해서는 스레드 간 경쟁이 해결되지 않습니다.');
    });
  add(12,'RCU: 교체와 회수 사이','옛 객체를 읽기 시작한 reader가 끝나기 전에 그 객체를 해제해도 되는지 판단합니다.',
    [range('reader','기존 reader 종료 시각',1,10,6,'단위'),range('now','포인터 교체 후 현재 시각',0,12,3,'단위')],
    [['기존 reader 진행 중',{reader:6,now:3}],['기존 reader 종료',{reader:6,now:8}]],
    '교체 시각 0에 이미 존재하던 한 reader만 추적합니다. 실제 RCU grace period는 CPU·preemption·RCU flavor 등의 조건을 따르며 숫자는 실제 시간 측정값이 아닙니다.',v=>{
      const safe=v.now>=v.reader;
      return result([metric('옛 객체 회수',safe?'가능한 단계':'아직 보류'),metric('기존 reader',safe?'종료':'읽는 중')],[bar('경과',Math.min(v.now,v.reader),v.reader),bar('남은 reader 구간',Math.max(0,v.reader-v.now),v.reader,'warn')],
        [item('새 reader','교체 후에는 새 포인터를 통해 새 객체를 읽습니다.'),item('옛 객체',safe?'기존 reader가 끝난 뒤 회수 경로로 넘어갑니다.':'새 포인터를 공개했어도 옛 객체는 유지해야 합니다.',safe?'accent':'warn')],
        'RCU의 핵심은 포인터를 바꾸는 순간과 메모리를 해제하는 순간을 분리하는 것입니다. 새 reader가 시작된다는 이유만으로 옛 객체의 회수를 계속 미룰 필요는 없습니다.');
    });
  add(13,'주소 변환과 page fault','가상 주소를 페이지 번호와 offset으로 나누고 TLB miss와 page fault를 구분합니다.',
    [range('address','가상 주소',0,65535,12345,'바이트'),select('state','주소 변환 상태',[[0,'TLB hit'],[1,'TLB miss, PTE present'],[2,'PTE not present']],0)],
    [['TLB hit',{address:12345,state:'0'}],['페이지 미배치',{address:12345,state:'2'}]],
    '4 KiB 페이지, 유효한 사용자 VMA, 읽기 권한을 가정합니다. PTE not present의 원인은 익명 첫 접근·파일 읽기·swap 등 다양합니다. TLB hit에도 권한 위반은 별도입니다.',v=>{
      const page=Math.floor(v.address/4096),offset=v.address%4096;
      return result([metric('가상 페이지 번호',page),metric('페이지 내 offset',offset+' B'),metric('경로',['TLB에서 변환','페이지 테이블 탐색','page fault 처리'][+v.state])],
        [bar('페이지 내부 위치',offset,4096),bar('page fault',v.state==='2'?1:0,1,'warn')],
        [item('주소 분해',v.address+' = '+page+' × 4096 + '+offset),item('결정',v.state==='1'?'TLB에 없지만 PTE가 유효하므로 페이지 폴트 없이 변환할 수 있습니다.':v.state==='2'?'커널이 유효한 VMA와 fault 원인을 확인하고 매핑을 준비합니다.':'캐시된 변환을 사용합니다.')],
        'TLB miss는 주소 변환 캐시에 없다는 뜻입니다. 해당 페이지가 RAM에 없다는 뜻과 같지 않습니다.');
    });
  add(14,'Buddy: 총량과 연속 공간','요청 페이지 수를 2의 거듭제곱 크기로 맞추고, 가장 큰 연속 여유 블록과 비교합니다.',
    [range('pages','요청 크기',1,48,9,'페이지'),select('largest','가장 큰 여유 buddy 블록',[[4,'4페이지'],[8,'8페이지'],[16,'16페이지'],[32,'32페이지'],[64,'64페이지']],16)],
    [['총량은 있지만 조각남',{pages:9,largest:'8'}],['연속 블록 확보',{pages:9,largest:'16'}]],
    '총 여유 64페이지의 단순 buddy 모델입니다. 직접 고차 페이지 할당을 가정하며 reclaim·compaction·zone·GFP 제한·SLUB 객체 할당은 별도입니다.',v=>{
      const rounded=2**Math.ceil(Math.log2(v.pages)),ok=rounded<=+v.largest;
      return result([metric('필요한 buddy 블록',rounded+'페이지'),metric('할당 가능',ok?'가능':'현재 블록으로 불가'),metric('블록 내 여분',rounded-v.pages+'페이지')],
        [bar('요청 페이지',v.pages,64),bar('필요한 블록',rounded,64),bar('최대 여유 블록',+v.largest,64,ok?'accent':'warn')],
        [item('총 여유','64페이지로 같아도 연속 공간의 크기는 다를 수 있습니다.'),item('다음 단계',ok?'큰 블록을 필요한 order까지 분할할 수 있습니다.':'할당 플래그에 따라 회수·압축·실패 등의 경로를 검토합니다.',ok?'accent':'warn')],
        '메모리 부족은 총량 부족만을 뜻하지 않습니다. 물리적으로 연속한 큰 블록이 필요한 요청은 단편화에 영향을 받습니다.');
    });
  add(15,'캐시에 써도 디스크에는 아직','16페이지 파일 중 변경한 페이지와 완료된 writeback 수를 조작합니다.',
    [range('dirty','변경한 페이지',0,16,10,'페이지'),range('flushed','완료된 writeback',0,16,4,'페이지')],
    [['아직 dirty',{dirty:10,flushed:0}],['모두 writeback',{dirty:10,flushed:10}]],
    '동시 쓰기가 없고 writeback 오류도 없는 고정 파일 모델입니다. writeback 수는 변경 페이지 수로 제한합니다. clean 상태만으로 새 디렉터리 엔트리의 crash durability까지 보장하지 않습니다.',v=>{
      const done=Math.min(v.dirty,v.flushed),pending=v.dirty-done;
      return result([metric('남은 dirty',pending+'페이지'),metric('writeback 완료',done+'페이지'),metric('캐시의 최신 데이터',v.dirty+'페이지')],
        [bar('dirty cache',pending,16,'warn'),bar('writeback 완료',done,16),bar('변경 안 된 페이지',16-v.dirty,16)],
        [item('read 경로','같은 파일의 캐시를 읽으면 아직 dirty인 최신 데이터도 볼 수 있습니다.'),item('지속성',pending?'현재 일부 변경은 아직 writeback되지 않았습니다.':'이 모델의 변경 데이터 writeback은 끝났습니다. fsync의 오류·메타데이터 보장을 별도로 확인합니다.',pending?'warn':'accent')],
        '애플리케이션에서 다시 읽어 같은 값이 나온다는 사실은 디스크에 영구 저장되었다는 증거가 아닙니다. page cache가 읽기와 쓰기를 연결합니다.');
    });
  add(16,'작업 집합과 메모리 예산','필요한 익명 페이지가 RAM 예산을 넘었을 때 swap 여유가 상황을 어떻게 바꾸는지 봅니다.',
    [range('working','반복 접근하는 작업 집합',16,128,80,'MiB',8),range('ram','RAM 예산',16,128,64,'MiB',8),onoff('swap','64 MiB swap 공간 사용 가능',1)],
    [['RAM에 들어감',{working:48,ram:64,swap:'1'}],['RAM을 넘는 반복 접근',{working:96,ram:64,swap:'1'}]],
    '모두 회수 가능한 익명 메모리이고 다른 프로세스·페이지 캐시·커널 메모리가 없는 모델입니다. 실제 OOM 결정이나 fault rate를 예측하지 않습니다. MGLRU 활성화는 커널 설정과 런타임을 확인해야 합니다.',v=>{
      const deficit=Math.max(0,v.working-v.ram),capacity=v.ram+(v.swap==='1'?64:0),risk=v.working>capacity;
      return result([metric('RAM 초과',deficit+' MiB'),metric('상태',risk?'예산 초과':deficit?'회수·재접근 압력':'작업 집합 수용')],
        [bar('RAM에 둘 수 있는 작업 집합',Math.min(v.working,v.ram),128),bar('RAM 밖의 작업 집합',deficit,128,'warn')],
        [item('회수',deficit?(v.swap==='1'?'swap으로 옮길 수 있어도 다시 접근하면 복귀 비용이 생깁니다.':'이 모델에서는 swap이 없어 익명 작업 집합을 RAM 밖으로 옮길 여유가 없습니다.'):'이 모델에서는 작업 집합을 RAM에 유지할 수 있습니다.'),item('진단',risk?'실제 시스템에서는 회수 실패·cgroup 한도·OOM 관련 로그를 함께 확인합니다.':'swap 사용량만으로 thrashing을 확정하지 말고 fault·PSI·지연을 함께 봅니다.',risk?'warn':'accent')],
        'swap은 메모리 용량과 접근 지연 사이의 선택입니다. 뜨거운 작업 집합이 RAM 예산을 지속적으로 넘으면 회수 정책만 바꿔 해결하기 어렵습니다.');
    });
  add(17,'dup와 별도 open의 파일 위치','fd A로 먼저 읽은 뒤 fd B가 어디서 읽기 시작하는지 비교합니다.',
    [select('mode','fd B를 만든 방법',[[0,'dup(A)'],[1,'같은 경로를 별도 open']],0),range('read','A가 읽은 바이트',0,100,30,'B',10)],
    [['dup로 공유',{mode:'0',read:30}],['별도 open',{mode:'1',read:30}]],
    'seek 가능한 일반 파일의 순차 read를 가정합니다. pread는 공유 파일 위치를 갱신하지 않으며, 동시 read의 순서·에러·EOF는 이 모델에서 제외합니다.',v=>{
      const b=v.mode==='0'?v.read:0;
      return result([metric('A의 다음 offset',v.read+' B'),metric('B의 다음 offset',b+' B'),metric('open file description',v.mode==='0'?'1개':'2개')],
        [bar('A offset',v.read,100),bar('B offset',b,100)],
        [item('fd 테이블','서로 다른 fd 숫자가 반드시 서로 다른 파일 위치를 뜻하지는 않습니다.'),item('열린 파일 객체',v.mode==='0'?'두 fd가 같은 struct file을 참조해 f_pos를 공유합니다.':'각 open으로 만든 struct file이 별도의 f_pos를 유지합니다.')],
        'inode는 파일 자체를 표현하고 열린 파일 객체는 열기 인스턴스의 상태를 담습니다. dup는 파일을 새로 여는 것과 다릅니다.');
    });
  add(18,'정전 시점과 저장 보장','새 임시 파일을 쓰고 동기화한 뒤 rename하는 저장 절차의 중간을 살펴봅니다.',
    [select('stage','완료된 마지막 작업',[[0,'write 성공'],[1,'임시 파일 fsync 성공'],[2,'rename 성공'],[3,'부모 디렉터리 fsync 성공']],0)],
    [['rename까지만 완료',{stage:'2'}],['디렉터리까지 동기화',{stage:'3'}]],
    '동일 파일 시스템의 정상 장치, 지원되는 fsync 의미, 모든 호출 성공을 전제한 일반적인 교체 패턴입니다. 파일 시스템·저장장치 오류·기존 파일 상태에 따른 정확한 복구 결과는 실제 장애 실험으로 확인해야 합니다.',v=>{
      const s=+v.stage;
      return result([metric('새 파일 내용 동기화',s>=1?'완료':'보장 미확보'),metric('새 이름 공개',s>=2?'완료':'아직'),metric('부모 디렉터리 동기화',s>=3?'완료':'미완료')],
        [bar('데이터 동기화',s>=1?1:0,1),bar('이름 변경',s>=2?1:0,1),bar('디렉터리 동기화',s>=3?1:0,1)],
        [item('관측과 보장',s===0?'다시 읽히더라도 page cache의 데이터일 수 있습니다.':s===1?'내용을 동기화했지만 최종 이름으로 교체하지 않았습니다.':s===2?'이름 변경의 원자성과 정전 후 지속성은 서로 다른 성질입니다.':'파일과 디렉터리 동기화를 모두 완료한 패턴입니다.'),item('오류 처리','write·fsync·rename 각각의 반환값을 확인해야 합니다.')],
        '성공한 write, 내용의 동기화, 이름 교체, 디렉터리 동기화는 서로 다른 단계입니다. 어느 단계에서 정전이 발생했는지에 따라 보장 범위가 달라집니다.');
    });
  add(19,'장치 큐를 늘리면 항상 빨라질까','32개 요청을 처리하는 가상 장치의 병렬 처리 폭과 제출 깊이를 비교합니다.',
    [range('depth','제출 깊이',1,16,2,'개'),range('lanes','장치의 병렬 처리 폭',1,8,4,'개')],
    [['장치를 덜 채움',{depth:1,lanes:4}],['포화 이후 깊이 증가',{depth:16,lanes:4}]],
    '모든 요청의 서비스 시간이 1단위이고 32개가 대기한 고정 배치 모델입니다. NVMe 성능 예측이 아닙니다. 실제 장치는 병합·캐시·펌웨어·크기·혼합 부하의 영향을 받습니다.',v=>{
      const active=Math.min(v.depth,v.lanes),rounds=Math.ceil(32/active),queued=Math.max(0,v.depth-v.lanes);
      return result([metric('동시 서비스',active+'개'),metric('배치 완료에 필요한 라운드',rounds),metric('장치 안 추가 대기',queued+'개')],
        [bar('서비스 중',active,16),bar('서비스 전 대기',queued,16,'warn')],
        [item('제출 제한',v.depth<v.lanes?'장치가 더 받을 수 있어도 제출 깊이가 작아 병렬성을 사용하지 못합니다.':'병렬 처리 폭을 채웠습니다.'),item('깊이 확대',queued?'같은 서비스 폭에서는 큐만 더 길어질 수 있습니다.':'작업량과 장치 특성에 맞춰 비교합니다.')],
        '제출 큐 깊이와 실제 서비스 병렬성은 다릅니다. 처리량과 개별 요청 지연을 함께 비교해야 합니다.');
    });
  add(20,'NAPI의 한 번의 poll','수신 backlog와 poll budget을 조절해 이번에 처리할 패킷과 남은 작업을 봅니다.',
    [range('packets','대기 수신 패킷',0,192,100,'개',4),range('budget','이번 poll의 Rx budget',8,64,32,'개',8)],
    [['다시 poll 필요',{packets:100,budget:32}],['budget보다 작은 작업량',{packets:20,budget:32}]],
    '신규 도착·Tx 완료·다른 NAPI 인스턴스가 없는 한 번의 Rx poll 모델입니다. 정확히 budget만큼 끝낸 경우의 반환값과 complete 처리는 드라이버 계약을 따로 확인합니다.',v=>{
      const done=Math.min(v.packets,v.budget),left=v.packets-done;
      return result([metric('이번 처리',done+'개'),metric('남은 Rx',left+'개'),metric('상태',left?'추가 poll 필요':v.packets===v.budget?'budget 경계 처리 필요':'완료 판단 가능')],
        [bar('처리한 Rx',done,192),bar('남은 Rx',left,192,'warn')],
        [item('budget','한 poll에서 처리하는 수신 작업량을 제한합니다.'),item('인터럽트',left?'polling이 계속되는 동안 불필요한 IRQ를 억제합니다.':'작업 완료 계약을 만족한 뒤 알림을 다시 허용할 수 있습니다.')],
        '패킷 하나마다 인터럽트 하나를 처리하는 모델과 다릅니다. budget은 수신 처리를 나누는 장치이며 단순히 크게 한다고 전체 시스템 지연이 좋아지지는 않습니다.');
    });
  add(21,'준비 알림과 완료 통지','readiness를 받은 뒤에도 읽기 연산이 남는지, completion이 무엇을 알려주는지 비교합니다.',
    [select('api','I/O 방식',[[0,'epoll readiness'],[1,'io_uring completion']],0),onoff('available','데이터가 준비되었는가',1)],
    [['읽을 준비 알림',{api:'0',available:'1'}],['읽기 완료 통지',{api:'1',available:'1'}]],
    '성공하는 일반 read 하나를 단순화합니다. io_uring에도 poll 요청이 있으며 completion은 오류·짧은 읽기를 포함할 수 있습니다. epoll 알림 뒤 다른 reader가 데이터를 소비하면 EAGAIN이 가능합니다.',v=>{
      const ready=v.available==='1',completion=v.api==='1';
      return result([metric('통지',ready?(completion?'CQE: read 결과':'EPOLLIN: 읽기 가능'):'아직 대기'),metric('사용자 버퍼',ready&&completion?'이 모델의 read 완료':'read 결과 아직 없음')],
        [bar('데이터 준비',ready?1:0,1),bar('요청한 read 완료',ready&&completion?1:0,1)],
        [item('다음 행동',!ready?'이벤트 또는 완료를 기다립니다.':completion?'CQE의 result를 검사하고 버퍼를 사용합니다.':'nonblocking read를 호출하고 실제 반환값을 확인합니다.'),item('의미','ready는 연산 가능성, completion은 제출한 연산의 결과입니다.')],
        'API의 이름보다 무엇이 통지되는지 확인합니다. 비동기 인터페이스를 쓴다고 복사·대기·커널 작업이 사라지는 것은 아닙니다.');
    });
  add(22,'권한 검사는 한 개의 스위치가 아니다','파일 접근의 일반 권한과 LSM 정책, 시스템 콜 필터를 조합합니다.',
    [onoff('dac','DAC 접근 검사 통과',1),onoff('lsm','LSM 정책 통과',1),onoff('seccomp','seccomp가 이 시스템 콜 허용',1)],
    [['모두 통과',{dac:'1',lsm:'1',seccomp:'1'}],['LSM이 거절',{dac:'1',lsm:'0',seccomp:'1'}]],
    '파일 읽기 요청의 허용 조건을 논리적으로 나열합니다. 실제 hook 순서·errno·capability 예외·namespace·seccomp 동작 종류를 재현하지 않습니다. root도 모든 정책을 무조건 우회하지 않습니다.',v=>{
      const gates=[['시스템 콜 필터',v.seccomp],['일반 접근 권한',v.dac],['LSM 정책',v.lsm]],passed=gates.filter(g=>g[1]==='1').length;
      return result([metric('허용 조건',passed+'/3'),metric('요청 결과',passed===3?'이 모델에서 허용':'차단 조건 존재')],gates.map(g=>bar(g[0],g[1]==='1'?1:0,1,g[1]==='1'?'accent':'warn')),
        gates.map(g=>item(g[0],g[1]==='1'?'통과':'이 조건에서 허용되지 않습니다.',g[1]==='1'?'accent':'warn')),
        '파일 mode 비트가 맞는다는 사실만으로 접근 성공을 보장하지 않습니다. 실패한 연산·현재 credentials·보안 정책의 증거를 함께 확인합니다.');
    });
  add(23,'CPU quota를 다 쓰면','100 ms 기간에 두 CPU에서 계속 실행하려는 cgroup의 총 CPU 시간 예산을 바꿉니다.',
    [range('quota','기간당 CPU quota',10,200,50,'CPU-ms',10),range('memory','메모리 사용량 / 64 MiB 한도',16,128,48,'MiB',8)],
    [['CPU throttle',{quota:50,memory:48}],['메모리 한도 초과',{quota:200,memory:96}]],
    'CPU 2개에서 작업 2개가 즉시 병렬 실행하고 cpu.max.burst는 없으며 다른 경합도 없는 100 ms 단일 기간 모델입니다. 실제 bandwidth 분배·계층 제한·메모리 회수 결과는 별도입니다.',v=>{
      const active=v.quota/2,throttle=100-active,excess=Math.max(0,v.memory-64);
      return result([metric('두 CPU 동시 실행 구간',active+' ms'),metric('예산 소진 후 대기',throttle+' ms'),metric('메모리 한도 초과분',excess+' MiB')],
        [bar('실행 가능한 벽시계 구간',active,100),bar('throttle 구간',throttle,100,'warn'),bar('메모리 사용',v.memory,128,excess?'warn':'accent')],
        [item('CPU',throttle?'호스트에 여유 CPU가 있어도 이 cgroup은 다음 예산을 기다릴 수 있습니다.':'이 가정에서는 두 CPU의 100 ms를 모두 사용할 수 있습니다.'),item('메모리',excess?'memory.max 초과는 회수와 memcg OOM 관련 증거를 확인할 신호입니다.':'현재 수치는 64 MiB 한도 안입니다.',excess?'warn':'accent')],
        'cpu.max의 quota는 벽시계 시간이 아니라 여러 CPU에서 소비한 시간의 합입니다. namespace가 같거나 다르다는 사실과 자원 예산은 별개의 문제입니다.');
    });
  add(24,'모듈을 지우기 전에','열린 장치가 모듈 참조를 유지하는 정상적인 문자 장치의 수명을 봅니다.',
    [range('opens','열려 있는 장치 참조',0,4,2,'개'),onoff('pending','비동기 작업이 남아 있는가',1)],
    [['아직 사용 중',{opens:2,pending:'1'}],['정리 조건 충족',{opens:0,pending:'0'}]],
    'file_operations.owner가 올바르고 참조 관리가 정상인 모듈의 수명 모델입니다. 실제 refcount에는 다른 참조도 포함됩니다. 비동기 작업 정리 여부는 rmmod가 자동으로 모두 증명하지 않습니다. 강제 제거는 다루지 않습니다.',v=>{
      const safe=v.opens===0&&v.pending==='0';
      return result([metric('파일 참조',v.opens),metric('안전한 제거 준비',safe?'조건 충족':'아직 아님')],[bar('열린 참조',v.opens,4,'warn'),bar('남은 비동기 작업',v.pending==='1'?1:0,1,'warn')],
        [item('rmmod',v.opens?'정상 참조가 남으면 사용 중인 모듈 제거를 거부합니다.':'파일 참조는 0입니다. 다른 참조와 종료 경로도 확인합니다.'),item('exit 경로',v.pending==='1'?'work·timer·IRQ 등의 취소와 동기화를 빠뜨리면 해제된 코드나 데이터에 접근할 수 있습니다.':'예제의 비동기 작업도 모두 종료했습니다.',v.pending==='1'?'warn':'accent')],
        '빌드 성공과 안전한 unload는 다른 검증입니다. 자원을 얻은 순서와 반대로 해제하고, 이미 시작한 콜백이 끝났는지 확인해야 합니다.');
    });
  add(25,'샘플에 없으면 실행되지 않았을까','100 ms 실행 중 20–26 ms에만 존재하는 함수를 주기적으로 샘플링합니다.',
    [range('period','샘플 주기',1,20,10,'ms'),range('phase','첫 샘플 시각',0,19,0,'ms')],
    [['짧은 함수 놓침',{period:10,phase:8}],['더 촘촘한 샘플',{period:2,phase:0}]],
    '정확한 주기와 고정 위상을 가진 교육용 샘플링입니다. 실제 perf 샘플은 이벤트·주파수 조절·스키드 등에 따라 다릅니다. 샘플 수는 계측량이지 실제 오버헤드 시간 측정값이 아닙니다.',v=>{
      const times=[];for(let t=v.phase;t<100;t+=v.period)times.push(t);
      const hits=times.filter(t=>t>=20&&t<26);
      return result([metric('전체 샘플',times.length+'개'),metric('대상 함수 샘플',hits.length+'개'),metric('실제 함수 실행 구간','6 ms (가정)')],
        [bar('전체 샘플',times.length,100),bar('함수를 포착한 샘플',hits.length,6)],
        [item('포착 시각',hits.length?hits.join(', ')+' ms':'없음: 그래도 함수는 실행되었습니다.',hits.length?'accent':'warn'),item('대가','주기를 줄이면 더 많은 샘플을 저장·처리해야 합니다.')],
        '샘플 기반 프로파일에 나타나지 않았다는 사실은 실행되지 않았다는 증거가 아닙니다. 짧거나 드문 이벤트는 tracepoint 등 다른 관측 방식이 필요할 수 있습니다.');
    });
  add(26,'지연을 시간으로 분해하기','한 요청의 가상 측정값에서 CPU 실행, CPU 배정 대기, I/O 대기를 비교합니다.',
    [range('cpu','CPU 실행 시간',1,50,10,'ms'),range('runq','CPU 배정 대기',0,100,40,'ms',5),range('io','I/O 대기',0,100,20,'ms',5)],
    [['CPU 경합',{cpu:10,runq:80,io:5}],['I/O 병목',{cpu:10,runq:5,io:80}]],
    '세 구간이 겹치지 않는 단일 요청의 합성 타임라인입니다. 실제 멀티스레드 요청은 구간이 중첩될 수 있고 락·네트워크 대기 등도 분리해야 합니다.',v=>{
      const total=v.cpu+v.runq+v.io,entries=[['CPU 실행',v.cpu],['CPU 배정 대기',v.runq],['I/O 대기',v.io]],top=entries.reduce((a,b)=>a[1]>=b[1]?a:b);
      return result([metric('요청 지연',total+' ms'),metric('가장 큰 구간',top[0]),metric('CPU 실행만 절반으로 줄일 때',(total-v.cpu/2).toFixed(1)+' ms')],
        entries.map(e=>bar(e[0],e[1],total,e[0]===top[0]?'warn':'accent')),
        [item('관측 계획',top[0]==='CPU 실행'?'on-CPU 스택에서 비싼 실행 경로를 조사합니다.':top[0]==='CPU 배정 대기'?'runnable 대기·스케줄링·CPU quota 증거를 조사합니다.':'I/O 경로와 장치·네트워크 지연을 분리합니다.'),item('최적화 상한','CPU 실행 시간을 줄여도 다른 대기 구간은 그대로 남습니다.')],
        '함수 하나를 빠르게 만드는 것보다 전체 요청에서 큰 구간을 먼저 찾습니다. CPU 사용률 하나만으로 응답 시간이 길어진 원인을 알 수 없습니다.');
    });
  add(27,'스택에서 알 수 있는 것과 없는 것','가상의 장애 증거를 보고 직접 확인된 사실과 추가 조사가 필요한 가설을 분리합니다.',
    [select('trace','확보한 진단 증거',[[0,'커널 oops의 fault 스택'],[1,'KASAN use-after-free 보고서'],[2,'lockdep 순환 잠금 경고']],0)],
    [['스택만 확보',{trace:'0'}],['할당·해제 이력 확보',{trace:'1'}]],
    '교육용으로 만든 증거 유형입니다. 실제 장애 로그·커널 주소·취약점 재현 코드가 아닙니다. 정상 demand paging의 page fault와 oops는 구분합니다. 스택 한 장으로 모든 근본 원인을 확정하지 않습니다.',v=>{
      const cases=[['fault 발생 시점','접근한 명령·주소·현재 스택은 볼 수 있지만 객체가 왜 잘못되었는지는 미확정입니다.','객체 수명·포인터 생성·동시 접근 이력'],['해제 후 접근 탐지','KASAN이 접근 지점과 확보된 할당·해제 스택을 연결합니다.','소유권 규칙·해제 이후 참조가 남은 경로'],['잠금 순서의 순환 가능성','lockdep이 관측한 잠금 의존 관계에서 순환을 보고합니다.','각 잠금 획득 경로와 실제 실행 문맥']];const c=cases[+v.trace];
      return result([metric('직접 확보한 증거',c[0])],[bar('상세 이력 유형',+v.trace===0?1:2,2)],
        [item('알 수 있는 것',c[1]),item('다음 확인',c[2],'warn')],
        '크래시가 발생한 함수와 버그를 만든 함수는 다를 수 있습니다. 관측된 사실, 가능한 원인, 원인을 검증할 다음 증거를 구분합니다.');
    });
  add(28,'증거로 고르는 첫 조사','서버 지연의 가상 증거 묶음을 읽고 가장 먼저 조사할 영역을 선택합니다.',
    [select('case','증거 묶음',[[0,'CPU 사용률 높음·runnable 대기 증가'],[1,'디스크 지연·I/O PSI 증가'],[2,'호스트 CPU 여유·nr_throttled 증가'],[3,'major fault·memory PSI 증가']],0),select('guess','먼저 조사할 영역',[[0,'CPU 경합과 실행 스택'],[1,'스토리지 I/O 경로'],[2,'cgroup CPU 예산'],[3,'작업 집합과 메모리 회수']],0)],
    [['CPU 예산 제한 사례',{case:'2',guess:'2'}],['메모리 압박 사례',{case:'3',guess:'3'}]],
    '합성 사례의 첫 조사 방향을 고르는 연습입니다. 신호 하나가 원인을 확정하지 않으며, 실제 장애는 여러 병목이 겹칠 수 있습니다. 명령 실행 없이 브라우저 안에서만 작동합니다.',v=>{
      const match=v.case===v.guess;
      const next=['perf와 스케줄링 지연을 함께 확인하고 CPU 수·runnable task 수를 비교합니다.','I/O 지연·큐·요청 유형·장치 오류를 확인하고 애플리케이션 대기와 시간대를 맞춥니다.','cpu.max와 cpu.stat을 확인하고 같은 기간의 throttled 시간·지연 증가를 비교합니다.','작업 집합·cgroup 한도·swap·fault와 reclaim을 함께 보고 메모리 압박의 원천을 찾습니다.'];
      return result([metric('조사 방향',match?'증거와 일치':'우선순위 재검토')],[bar('증거와 선택 일치',match?1:0,1,match?'accent':'warn')],
        [item('다음 관측',next[+v.case]),item('검증',match?'하나의 변수를 바꾼 전후에 지연과 관련 지표가 함께 개선되는지 확인합니다.':'선택한 영역이 현재 신호를 어떻게 설명하는지 다시 검토하세요.','warn')],
        '관측 → 가설 → 추가 확인 → 한 가지 변경 → 전체 요청 재측정 순서로 진행합니다. 최적화 후보를 찾는 것과 원인을 입증하는 것은 다릅니다.');
    });

  function compute(id, values={}) {
    const experiment=experiments[id];
    if(!experiment)throw new RangeError('Unknown experiment: '+id);
    const clean={};
    for(const c of experiment.controls){
      const raw=Object.hasOwn(values,c.id)?values[c.id]:c.value;
      if(c.options){clean[c.id]=c.options.some(o=>o.value===String(raw))?String(raw):String(c.value);}
      else {const n=Number(raw);clean[c.id]=Number.isFinite(n)?Math.max(c.min,Math.min(c.max,n)):c.value;}
    }
    return models[id](clean);
  }
  return {experiments,compute};
});
