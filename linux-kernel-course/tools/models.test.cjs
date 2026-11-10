'use strict';
const assert = require('node:assert/strict');
const {experiments,compute}=require('../assets/models.js');
let checks=0;
function check(value,label){assert.ok(value,label);checks++;}
function eq(actual,expected,label){assert.equal(actual,expected,label);checks++;}
const metric=(r,label)=>r.metrics.find(m=>m.label===label)?.value;
const value=(r,label)=>r.bars.find(m=>m.label===label)?.value;
function valid(id,r){
  check(r.explanation.length>10,`${id}: explanation`);
  check(r.metrics.length>0&&r.items.length>0&&r.bars.length>0,`${id}: visible output`);
  for(const b of r.bars){check(Number.isFinite(b.value)&&Number.isFinite(b.max)&&b.max>0&&b.value>=0&&b.value<=b.max,`${id}: bounded bar ${b.label}`);}
  for(const m of r.metrics)check(typeof m.value==='string',`${id}: formatted metric`);
}
eq(Object.keys(experiments).length,28,'all 28 chapters');
for(let id=1;id<=28;id++){
 const e=experiments[id];check(e.title&&e.description&&e.limitations,`${id}: teaching context`);
 valid(id,compute(id));
 check(e.presets.length>=2,`${id}: compare presets`);
 const outputs=e.presets.map(p=>{const r=compute(id,p.values);valid(id,r);return JSON.stringify(r);});
 check(new Set(outputs).size>1,`${id}: presets visibly differ`);
 for(const c of e.controls){
  const inputs=c.options?c.options.map(o=>o.value):[c.min,c.max,NaN,Infinity,-10000,10000];
  for(const input of inputs)valid(id,compute(id,{[c.id]:input}));
 }
}
// Calls can change privilege without switching the executing task.
eq(metric(compute(1,{batch:16}),'시스템 콜'),'4회','batching saves calls');
eq(metric(compute(2,{calls:4,block:'0'}),'문맥 교환'),'0회','nonblocking call need not switch task');
eq(metric(compute(2,{calls:4,block:'1'}),'문맥 교환'),'8회','explicit blocking model');
eq(metric(compute(3,{stage:5,root:'0'}),'완료 단계'),'3/5','missing root blocks PID1');
eq(metric(compute(5,{tasks:4,mode:'1'}),'주소 공간'),'1개','threads share address space');
eq(metric(compute(5,{tasks:4,mode:'0'}),'주소 공간'),'4개','fork separates mm');
eq(metric(compute(6,{written:0}),'고유 물리 페이지'),'16개','COW read-only sharing');
eq(metric(compute(6,{written:16}),'고유 물리 페이지'),'32개','COW first writes allocate copies');
// EEVDF eligibility precedes deadline comparison.
eq(metric(compute(7,{lag:-2,deadline:1}),'선택 후보'),'B','negative lag loses despite earliest deadline');
eq(metric(compute(7,{lag:0,deadline:6}),'선택 후보'),'A','eligible earliest A');
eq(metric(compute(7,{lag:0,deadline:15}),'선택 후보'),'B','eligible earliest B');
eq(metric(compute(8,{complete:'0',cpu:'1'}),'작업 상태'),'sleeping','idle CPU cannot satisfy I/O');
eq(metric(compute(8,{complete:'1',cpu:'0'}),'작업 상태'),'runnable','wake != running');
eq(metric(compute(9,{pending:'1',masked:'1'}),'IRQ 처리'),'보류','masked pending IRQ');
eq(metric(compute(10,{context:'0',sleep:'1'}),'현재 작업'),'그대로 실행 불가','hard IRQ cannot sleep');
eq(metric(compute(10,{context:'2',sleep:'1'}),'현재 작업'),'문맥 조건 충족','normal worker context');
eq(metric(compute(11,{overlap:10,locked:'0'}),'모델 최종 값'),'10','lost increments example');
eq(metric(compute(11,{overlap:10,locked:'1'}),'모델 최종 값'),'20','mutex protects whole increment');
eq(metric(compute(12,{reader:6,now:5}),'옛 객체 회수'),'아직 보류','existing RCU reader protects retired object');
eq(metric(compute(12,{reader:6,now:6}),'옛 객체 회수'),'가능한 단계','grace condition met');
eq(metric(compute(13,{address:12345,state:'1'}),'페이지 내 offset'),'57 B','address offset arithmetic');
eq(value(compute(13,{state:'1'}),'page fault'),0,'TLB miss does not imply fault');
eq(metric(compute(14,{pages:9,largest:'8'}),'할당 가능'),'현재 블록으로 불가','contiguity matters');
eq(metric(compute(14,{pages:9,largest:'16'}),'필요한 buddy 블록'),'16페이지','buddy round-up');
eq(metric(compute(15,{dirty:4,flushed:16}),'남은 dirty'),'0페이지','writeback clamps to dirty count');
eq(metric(compute(16,{working:96,ram:64,swap:'1'}),'상태'),'회수·재접근 압력','swap can fit but repeated accesses pressure RAM');
eq(metric(compute(16,{working:96,ram:64,swap:'0'}),'상태'),'예산 초과','no extra capacity without swap');
eq(metric(compute(17,{mode:'0',read:30}),'B의 다음 offset'),'30 B','dup shares open-file offset');
eq(metric(compute(17,{mode:'1',read:30}),'B의 다음 offset'),'0 B','separate open independent offset');
eq(metric(compute(18,{stage:'2'}),'부모 디렉터리 동기화'),'미완료','rename != directory durability');
eq(metric(compute(18,{stage:'3'}),'부모 디렉터리 동기화'),'완료','directory fsync model');
eq(metric(compute(19,{depth:4,lanes:4}),'배치 완료에 필요한 라운드'),metric(compute(19,{depth:16,lanes:4}),'배치 완료에 필요한 라운드'),'queue beyond service width does not improve modeled throughput');
eq(metric(compute(20,{packets:100,budget:32}),'남은 Rx'),'68개','NAPI Rx budget');
eq(metric(compute(20,{packets:32,budget:32}),'상태'),'budget 경계 처리 필요','exact budget completion caveat');
eq(metric(compute(21,{api:'0',available:'1'}),'사용자 버퍼'),'read 결과 아직 없음','readiness not completion');
eq(metric(compute(21,{api:'1',available:'1'}),'사용자 버퍼'),'이 모델의 read 완료','CQE for read model');
eq(metric(compute(22,{dac:'1',lsm:'0',seccomp:'1'}),'요청 결과'),'차단 조건 존재','DAC cannot override LSM');
eq(metric(compute(23,{quota:50,memory:48}),'예산 소진 후 대기'),'75 ms','two CPUs consume 50 CPU-ms in25 wall ms');
eq(metric(compute(24,{opens:0,pending:'1'}),'안전한 제거 준비'),'아직 아님','zero open refs do not drain work');
eq(metric(compute(25,{period:10,phase:8}),'대상 함수 샘플'),'0개','sampling can miss a real execution');
eq(metric(compute(25,{period:2,phase:0}),'대상 함수 샘플'),'3개','higher sample resolution captures short function');
eq(metric(compute(26,{cpu:10,runq:80,io:5}),'요청 지연'),'95 ms','latency sum');
eq(metric(compute(28,{case:'2',guess:'0'}),'조사 방향'),'우선순위 재검토','diagnosis follows evidence');
eq(metric(compute(28,{case:'2',guess:'2'}),'조사 방향'),'증거와 일치','quota evidence chooses cgroup');
assert.throws(()=>compute(29),RangeError);checks++;
console.log(`${checks} checks passed: 28 model defaults, presets, boundaries, and causal semantics.`);
