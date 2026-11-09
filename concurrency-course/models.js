/* Deterministic teaching models: one tick is a simulated unit, never a measured millisecond. */
(function (root) {
'use strict';
const names = ['A','B','C','D','E','F','G','H'];
class StackModel {
  constructor(){this.reset();}
  reset(){this.index=0;this.stack=[];this.heap={};this.result=null;this.done=false;this.message='main()을 호출하기 전입니다.';}
  step(){
    const events=[
      ()=>{this.stack.push({name:'main',line:1,locals:'아직 없음'});this.message='CPU가 main의 첫 명령을 실행합니다. 호출 프레임을 쌓습니다.';},
      ()=>{this.heap['0x10']={value:21};this.stack[0].line=2;this.stack[0].locals='box → 0x10';this.message='힙에 객체를 만들고 main의 지역 변수 box에 참조를 보관합니다.';},
      ()=>{this.stack[0].line=3;this.stack.push({name:'double',line:5,locals:'x = 21'});this.message='double을 호출합니다. 같은 스레드의 스택에 프레임을 더합니다.';},
      ()=>{this.stack[1].line=6;this.stack[1].locals='x = 21, result = 42';this.message='CPU가 21 × 2를 계산합니다. 힙의 value는 아직 21입니다.';},
      ()=>{this.stack.pop();this.stack[0].locals='box → 0x10, result = 42';this.result=42;this.message='double이 42를 반환하고 프레임이 제거됩니다. main으로 돌아옵니다.';},
      ()=>{this.heap['0x10'].value=42;this.stack[0].line=4;this.message='main이 반환값 42를 힙 객체의 value에 씁니다.';},
      ()=>{this.stack=[];this.message='main이 반환했습니다. 객체의 실제 회수 시점은 런타임의 메모리 관리 방식에 따릅니다.';}
    ];if(this.done)return;events[this.index++]();this.done=this.index===events.length;
  }
}
class Scheduler {
 constructor(cores=1,quantum=1){this.cores=cores;this.quantum=quantum;this.jobs=names.slice(0,3).map(id=>({id,left:4}));this.ready=[...this.jobs];this.running=Array(cores).fill(null);this.history=[];this.tick=0;this.done=false;this.message='A, B, C가 각각 CPU 4틱을 필요로 합니다.';}
 step(){if(this.done)return;for(let c=0;c<this.cores;c++)if(!this.running[c]&&this.ready.length)this.running[c]={job:this.ready.shift(),slice:this.quantum};
 const frame=this.running.map(r=>r?r.job.id:'·');this.history.push(frame);this.tick++;
 for(let c=0;c<this.cores;c++){const r=this.running[c];if(!r)continue;r.job.left--;r.slice--;if(r.job.left===0)this.running[c]=null;else if(r.slice===0){this.ready.push(r.job);this.running[c]=null;}}
 this.done=this.jobs.every(j=>j.left===0);this.message=`t=${this.tick}: ${frame.map((n,i)=>`코어 ${i+1} ${n}`).join(' / ')}. ${this.cores===1?'작업이 번갈아 진행됩니다.':'같은 틱에 서로 다른 작업이 실행될 수 있습니다.'}`;}
}
function schedule({count=3,cpu=1,wait=4,slots=3,cores=1}={}){
 const jobs=Array.from({length:count},(_,i)=>({id:i,phase:'queue',left:cpu,wake:0}));const history=[];const completedCounts=[];let t=0;
 while(jobs.some(j=>j.phase!=='done')&&t<1000){
  for(const j of jobs)if(j.phase==='wait'&&j.wake<=t){j.phase='post';j.left=cpu;}
  let active=jobs.filter(j=>!['queue','done'].includes(j.phase)).length;
  for(const j of jobs)if(j.phase==='queue'&&active<slots){j.phase='pre';active++;}
  const runnable=jobs.filter(j=>j.phase==='pre'||j.phase==='post').slice(0,cores);
  history.push(jobs.map(j=>runnable.includes(j)?'cpu':j.phase==='wait'?'wait':j.phase==='done'?'done':'queue'));
  for(const j of runnable){j.left--;if(j.left===0){if(j.phase==='pre'){if(wait===0){j.phase='post';j.left=cpu;}else{j.phase='wait';j.wake=t+1+wait;}}else j.phase='done';}}
  completedCounts.push(jobs.filter(j=>j.phase==='done').length);
  t++;
 }
 return {jobs,history,completedCounts,total:t,cpuTicks:count*cpu*2};
}
class Race {
 constructor(lock=false,deadlock=false,ordered=false){this.lock=lock;this.deadlock=deadlock;this.ordered=ordered;this.value=0;this.owner=null;this.actors={A:{pc:0,local:null},B:{pc:0,local:null}};this.locks={L1:null,L2:null};this.log=[];this.done=false;this.tick=0;this.message='각 작업의 다음 명령을 선택하세요.';}
 step(who){if(this.done)return;const a=this.actors[who];if(a.pc>= (this.deadlock?3:3)){this.message=who+'는 이미 끝났습니다.';return;}
 this.tick++;
 if(this.deadlock){const order=who==='A'||this.ordered?['L1','L2']:['L2','L1'];if(a.pc<2){const key=order[a.pc];if(this.locks[key]&&this.locks[key]!==who)this.message=`${who}: ${key} 대기. 보유한 락을 놓지 않은 채 기다립니다.`;else{this.locks[key]=who;a.pc++;this.message=`${who}: ${key} 획득.`;}}else{for(const k of Object.keys(this.locks))if(this.locks[k]===who)this.locks[k]=null;a.pc++;this.message=who+': 작업 완료, 락을 모두 해제합니다.';}
 }else if(this.lock&&this.owner&&this.owner!==who){this.message=`${who}: ${this.owner}가 락을 보유 중이라 대기합니다.`;}
 else{if(this.lock)this.owner=who;if(a.pc===0){a.local=this.value;this.message=`${who}: 공유 값 ${this.value}를 지역 변수로 읽습니다.`;}else if(a.pc===1){a.local++;this.message=`${who}: 지역 변수만 ${a.local}로 계산합니다. 공유 값은 ${this.value}입니다.`;}else{this.value=a.local;this.message=`${who}: ${a.local}를 공유 값에 씁니다.`;if(this.lock)this.owner=null;}a.pc++;}
 this.log.push(this.message);this.done=Object.values(this.actors).every(a=>a.pc===3);
 }
 get stuck(){return this.deadlock&&!this.ordered&&this.actors.A.pc===1&&this.actors.B.pc===1&&this.locks.L1==='A'&&this.locks.L2==='B';}
}
class EventLoop {
 constructor(mode='await'){this.mode=mode;this.tick=0;this.ready=['A','B'];this.tasks={A:{phase:'ready',pc:0,wake:0},B:{phase:'ready',pc:0,wake:0}};this.busy=0;this.log=[];this.history=[];this.done=false;this.message='A와 B의 실행을 하나의 실행기에 예약한 개념 모델입니다. .NET 기본 ThreadPool 전체를 재현하지 않습니다.';}
 step(){if(this.done)return;const t=this.tick++;let active='·';
 if(this.busy>0){active='A';this.busy--;this.message='A의 동기 작업이 단일 실행기를 점유합니다. B는 실행 기회를 얻지 못합니다.';if(!this.busy){this.tasks.A.phase='done';this.message+=' A 완료.';}}
 else{for(const id of ['A','B'])if(this.tasks[id].phase==='waiting'&&this.tasks[id].wake<=t){this.tasks[id].phase='ready';this.ready.push(id);}
 const id=this.ready.shift();if(id){active=id;const j=this.tasks[id];if(j.pc===0){j.pc=1;if(id==='A'&&this.mode==='blocking'){j.phase='running';this.busy=3;this.message='A가 Thread.Sleep 같은 동기 작업을 시작합니다. 다른 Task로 양보하지 않습니다.';}else if(id==='A'&&this.mode==='ready'){j.phase='done';this.message='A가 이미 완료된 Future를 await합니다. 이 모델에서는 중단 없이 이어서 완료합니다.';}else{j.phase='waiting';j.wake=t+1+(id==='A'?3:1);this.message=`${id}: 아직 끝나지 않은 작업을 await하고 실행권을 양보합니다.`;}}else{j.phase='done';this.message=`${id}: 준비된 결과를 받아 중단 지점 다음부터 실행하고 완료합니다.`;}}
 else this.message='실행 가능한 Task가 없습니다. 완료 통지를 기다립니다. 실제 .NET은 I/O 완료와 continuation 실행을 연결합니다. 단일 실행기는 기본 Console 환경과 다릅니다.';
 }
 this.history.push(active);this.log.push(`t=${t} ${this.message}`);this.done=Object.values(this.tasks).every(j=>j.phase==='done');}
}
class Queue {
 constructor({rate=3,workers=2,duration=2,capacity=4,policy='wait'}={}){Object.assign(this,{rate,workers,duration,capacity,policy});this.tick=0;this.waiting=[];this.running=[];this.upstream=0;this.offered=0;this.accepted=0;this.rejected=0;this.completed=0;this.next=1;this.history=[];this.done=false;this.message='생산자 → 대기열 → Worker. 큐 상한은 실행 중인 작업을 제외합니다.';}
 step(){if(this.done)return;this.tick++;for(const j of this.running)j.left--;this.completed+=this.running.filter(j=>j.left===0).length;this.running=this.running.filter(j=>j.left>0);
 while(this.waiting.length&&this.running.length<this.workers)this.running.push({id:this.waiting.shift(),left:this.duration});
 this.offered+=this.rate;let incoming=this.upstream+this.rate;this.upstream=0;
 while(incoming>0){if(this.running.length<this.workers){this.running.push({id:this.next++,left:this.duration});this.accepted++;}else if(this.policy==='unbounded'||this.waiting.length<this.capacity){this.waiting.push(this.next++);this.accepted++;}else{if(this.policy==='wait')this.upstream=incoming;else this.rejected+=incoming;break;}incoming--;}
 this.history.push({queue:this.waiting.length,running:this.running.length,upstream:this.upstream,completed:this.completed});this.done=this.tick>=20;
 this.message=this.upstream?`큐가 가득 차 생산자 측 ${this.upstream}개가 접수 전 대기합니다. 실제 역압력은 생산 속도를 늦춰야 합니다. 이 모델은 외부 수요가 계속 들어오는 상황입니다.`:this.rejected?`상한을 넘은 ${this.rejected}개를 거절했습니다. 거절은 생산자를 대기시키는 정책과 다릅니다.`:`t=${this.tick}. 완료 ${this.completed}개. 큐 ${this.waiting.length}개. 입력률과 처리 용량을 비교하세요.`;
 }
}
class Cancellation {
 constructor(cooperative=true,trigger='user'){this.cooperative=cooperative;this.trigger=trigger;this.tick=0;this.local='실행 전';this.remote='미요청';this.open=false;this.requested=false;this.handled=false;this.done=false;this.log=[];this.message='먼저 한 단계 실행해 자원을 열고 원격 요청을 보냅니다.';}
 cancel(){if(this.done||!this.open)return;if(this.trigger==='waitonly'){this.message='WaitAsync의 시간 제한이 지났습니다. 대기만 끝나고 원본 Task는 계속 실행합니다.';this.log.push(this.message);return;}this.requested=true;this.message=this.trigger==='timeout'?'제한 시간이 지나 로컬 Task에 취소를 요청합니다.':this.trigger==='group'?'형제 실패를 관찰한 코드가 연결된 CancellationTokenSource로 취소를 요청합니다. WhenAll만으로는 자동 취소되지 않습니다.':'사용자가 로컬 Task에 취소를 요청합니다.';this.log.push(this.message);}
 step(){if(this.done)return;this.tick++;if(this.tick===1){this.open=true;this.local='실행 중';this.remote='서버 처리 중';this.message='로컬 자원을 열고 원격 요청을 전송했습니다.';}
 else if(this.open&&this.requested&&this.cooperative&&!this.handled){this.local='취소 처리';this.handled=true;this.message='중단 지점에서 취소 예외를 받습니다. finally로 이동합니다.';}
 else if(this.open&&(this.handled||this.tick>=5)){this.open=false;this.local=this.requested&&this.cooperative?'취소됨 · 정리 완료':'완료 · 정리 완료';this.message='finally에서 로컬 자원을 닫습니다. 원격 작업의 중단 여부는 별도 확인이 필요합니다.';}
 else this.message=this.open?'중단 지점 없는 작업을 실행 중입니다. 취소 요청만으로 실행이 즉시 멈추지 않습니다.':'로컬 Task는 종료됐지만 원격 서버의 작업은 계속될 수 있습니다.';
 if(this.tick>=6){this.remote='서버 완료 · 결과 생성';this.message+=' 원격 작업은 완료됐습니다. 재시도에는 같은 작업 ID 등 멱등성 설계가 필요합니다.';}
 this.done=!this.open&&this.tick>=6;this.log.push(`t=${this.tick} ${this.message}`);}
}
const api={StackModel,Scheduler,schedule,Race,EventLoop,Queue,Cancellation};
root.LabModels=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
