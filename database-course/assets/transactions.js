(function(){
 const $=id=>document.getElementById(id),esc=MM.esc;
 const svg=(body,h=230)=>`<svg viewBox="0 0 720 ${h}" role="img" aria-label="현재 트랜잭션 상태와 연결">${body}</svg>`;
 const box=(x,y,w,a,b,cls='')=>`<g><rect x="${x}" y="${y}" width="${w}" height="64" rx="6" class="${cls}"/><text x="${x+w/2}" y="${y+26}" text-anchor="middle">${esc(a)}</text><text x="${x+w/2}" y="${y+49}" text-anchor="middle">${esc(b)}</text></g>`;
 const line=(x,y,a,b,cls='edge')=>`<path d="M${x} ${y}L${a} ${b}" class="${cls}"/>`;
 function feedback(id,text,ok){$(id).textContent=text;$(id).className='tx-output '+(ok?'correct':'incorrect');}
 function idInput(id){const raw=$(id).value,n=Number(raw);if(!raw.trim()||!Number.isInteger(n)||n<1||n>99)throw Error('행 id는 1~99 정수입니다.');return n;}
 let snapshotMode='writers',aId=2,bId=3;
 function snapshotFrames(){
  const initial={rev:0,base:[1],A:null,B:null,logs:['시작: 커밋된 행 [1], revision=0']},frames=[structuredClone(initial)];
  const schedule=snapshotMode==='writers'?[['A','begin'],['B','begin'],['A','write',aId],['B','write',bId],['A','commit'],['B','commit'],['B','rollback']]:[['A','begin'],['A','read'],['B','begin'],['B','write',bId],['B','commit'],['A','read'],['A','commit']];
  for(const [who,action,id]of schedule){const s=structuredClone(frames.at(-1));let t=s[who],message;
   if(action==='begin'){s[who]={base:s.rev,rows:s.base.slice(),dirty:false,status:'T'};message=`${who}: BEGIN, base=${s.rev}`;}
   else if(action==='rollback'){if(t){s[who]=null;message=`${who}: ROLLBACK, private copy 삭제`;}else{message=`${who}: 활성 트랜잭션 없음`;}}
   else if(!t){message=`${who}: 활성 트랜잭션 없음`;}
   else if(t.status==='E'){message=`${who}: 실패 상태, ROLLBACK 필요`;}
   else if(action==='read'){message=`${who}: SELECT → [${t.rows.join(',')}], committed base는 [${s.base.join(',')}]`;}
   else if(action==='write'){if(t.rows.includes(id)){t.status='E';t.failure='duplicate';message=`${who}: id=${id} 중복키 오류 → E`;}else{t.rows.push(id);t.dirty=true;message=`${who}: private copy에 id=${id} 삽입, committed base 불변`;}}
   else if(!t.dirty){s[who]=null;message=`${who}: read-only COMMIT, 현재 revision=${s.rev} 반환, 증가/WAL 없음`;}
   else if(t.base!==s.rev){t.status='E';t.failure='conflict';message=`${who}: COMMIT 충돌 (base=${t.base}, current=${s.rev}) → E. base 불변`;}
   else{s.base=t.rows.slice();s.rev++;s[who]=null;message=`${who}: dirty COMMIT 성공 → revision=${s.rev}`;}
   s.logs.push(message);frames.push(s);
  }return frames;
 }
 let frames=snapshotFrames();
 const snapshotPlayer=MM.stepper($('snapshot-player'),{steps:8,interval:1700,render(i){const s=frames[i];
  $('snapshot-states').innerHTML=[['committed',{rows:s.base,base:s.rev,status:'DB'}],['A',s.A],['B',s.B]].map(([name,t])=>`<div class="${t?.status==='E'?'failed':t?'active':''}"><b>${name}</b>${t?`revision/base=${t.base}<br>행 [${t.rows.join(', ')}]<br>상태 ${t.status}${name==='committed'?'':` · dirty=${t.dirty}`}`:'활성 작업공간 없음'}</div>`).join('');
  $('snapshot-diagram').innerHTML=svg(box(250,10,220,`committed revision ${s.rev}`,`행 [${s.base.join(',')}]`)+box(30,145,270,'세션 A',s.A?`base ${s.A.base} · ${s.A.status}`:'종료/시작 전',s.A?.status==='E'?'failure':'')+box(420,145,270,'세션 B',s.B?`base ${s.B.base} · ${s.B.status}`:'종료/시작 전',s.B?.status==='E'?'failure':'')+line(305,74,165,145)+line(415,74,555,145));
  $('snapshot-log').textContent=s.logs.join('\n');return s.logs.at(-1);
 }});
 function applySnapshot(){snapshotPlayer.stop();try{const nextA=idInput('snapshot-a'),nextB=idInput('snapshot-b');snapshotMode=$('snapshot-case').value;aId=nextA;bId=nextB;frames=snapshotFrames();snapshotPlayer.go(0);feedback('snapshot-feedback','조건을 적용했습니다. 마지막 COMMIT 결과를 예측하세요.',true);}catch(e){$('snapshot-case').value=snapshotMode;feedback('snapshot-feedback',e.message+' 재생을 멈추고 이전 조건을 유지합니다.',false);}}
 for(const id of ['snapshot-a','snapshot-b'])$(id).addEventListener('input',()=>{snapshotPlayer.go(0);$('snapshot-feedback').textContent='입력 중: 재생을 멈췄습니다. 새 조건 적용 전에는 이전 조건의 첫 상태를 보여 줍니다.';});
 $('snapshot-apply').onclick=applySnapshot;$('snapshot-case').onchange=applySnapshot;
 $('snapshot-check').onclick=()=>{
  const b=frames[6].B;
  const outcome=snapshotMode==='reader'?'readonly':b?.failure==='duplicate'?'error':b?.failure==='conflict'?'conflict':'success';
  const explanation=outcome==='error'?'B의 INSERT가 중복키 오류로 E가 됐습니다. COMMIT은 실패 상태 때문에 거부되며 revision 충돌 검사는 하지 않습니다.':outcome==='conflict'?'B의 INSERT는 성공했지만 A의 COMMIT이 revision을 바꿨습니다. B의 dirty COMMIT은 global revision 충돌로 E가 됩니다.':outcome==='success'?'A의 INSERT가 중복키 오류로 실패해 revision이 바뀌지 않았습니다. B의 dirty COMMIT은 성공하고 revision을 1로 올립니다.':frames[4].B?.failure==='duplicate'?'B의 INSERT는 중복키 오류로 E가 되고 COMMIT도 거부됩니다. A는 읽기 전용이므로 정상 COMMIT하며 revision은 0 그대로입니다.':'B가 먼저 쓰기 COMMIT해 revision은 1입니다. A의 read-only COMMIT은 오래된 base라도 성공하며 revision을 더 늘리지 않습니다.';
  feedback('snapshot-feedback',($('snapshot-prediction').value===outcome?'맞습니다. ':'다시 확인하세요. ')+explanation,$('snapshot-prediction').value===outcome);
 };
 let firstB='y',victim='B';
 function lockFrames(){const s={held:{x:null,y:null},wait:{A:null,B:null},done:{A:false,B:false},logs:['개념 모형: 잠금을 얻기 전 상태']},out=[structuredClone(s)];
  const take=(who,key)=>{if(!s.held[key]||s.held[key]===who){s.held[key]=who;s.wait[who]=null;return `${who}: ${key.toUpperCase()} 잠금 획득`;}s.wait[who]=s.held[key];return `${who}: ${key.toUpperCase()} 기다림 (${who}→${s.held[key]})`;};
  s.logs.push(take('A','x'));out.push(structuredClone(s));s.logs.push(take('B',firstB));out.push(structuredClone(s));
  s.logs.push(take('A','y'));out.push(structuredClone(s));
  if(s.wait.B)s.logs.push('B는 첫 잠금 대기 중이므로 다음 요청을 보내지 않음');else s.logs.push(take('B',firstB==='y'?'x':'y'));out.push(structuredClone(s));
  const cycle=s.wait.A==='B'&&s.wait.B==='A';
  if(cycle){for(const k of ['x','y'])if(s.held[k]===victim)s.held[k]=null;s.wait[victim]=null;s.done[victim]=true;const other=victim==='A'?'B':'A';s.wait[other]=null;for(const k of ['x','y'])if(!s.held[k])s.held[k]=other;s.logs.push(`대기 순환 A→B→A. 희생 ${victim} 취소 후 ${other}가 진행`);}
  else{s.held={x:null,y:null};s.wait={A:null,B:null};s.done.A=true;s.logs.push('순환 없음. A가 끝나 잠금을 풀면 B가 순서대로 진행');}
  out.push(structuredClone(s));return out;
 }
 let locks=lockFrames();
 const lockPlayer=MM.stepper($('lock-player'),{steps:6,interval:1600,render(i){const s=locks[i],cycle=s.wait.A==='B'&&s.wait.B==='A';
  let body=box(30,20,230,'세션 A',s.done.A?'취소/종료':s.wait.A?'B를 기다림':'진행 가능',s.wait.A?'failure':'')+box(460,20,230,'세션 B',s.done.B?'취소/종료':s.wait.B?'A를 기다림':'진행 가능',s.wait.B?'failure':'')+box(100,150,200,'자원 X',s.held.x?`보유 ${s.held.x}`:'비어 있음')+box(420,150,200,'자원 Y',s.held.y?`보유 ${s.held.y}`:'비어 있음');
  if(s.wait.A)body+=line(260,40,460,40,'wait');if(s.wait.B)body+=line(460,65,260,65,'wait');$('lock-diagram').innerHTML=svg(body,245);$('lock-status').textContent=`wait-for: A→${s.wait.A||'없음'}, B→${s.wait.B||'없음'} · cycle=${cycle}`;$('lock-log').textContent=s.logs.join('\n');return s.logs.at(-1);
 }});
 function applyLocks(){lockPlayer.stop();firstB=$('lock-order').value;victim=$('lock-victim').value;locks=lockFrames();lockPlayer.go(0);$('lock-feedback').textContent='조건을 바꿨습니다. 순환이 생기는지 예측하세요.';}
 $('lock-order').onchange=applyLocks;$('lock-victim').onchange=applyLocks;$('lock-check').onclick=()=>{const expected=firstB==='y'?'yes':'no',ok=$('lock-prediction').value===expected;feedback('lock-feedback',ok?'맞습니다. 단계 5의 대기 그래프에서 확인하세요.':expected==='yes'?'서로 다른 잠금을 먼저 잡고 상대 잠금을 요청해 A→B→A가 됩니다.':'같은 순서 X→Y이면 B가 첫 X에서 기다려 순환이 생기지 않습니다.',ok);};
 let isolation='occ';
 function skewFrames(){const out=[];for(let i=0;i<6;i++){const serial=isolation==='serial',si=isolation==='si';const a=i>=3?false:true;const b=i>=5&&si?false:true;out.push({a,b,readA:i>=1?2:null,readB:i>=2&&!serial?2:i>=4&&serial?1:null,revision:i>=3?i>=5&&si?2:1:0,decision:i<4?'아직 결정 전':serial?'B는 현재 1명만 근무해 변경하지 않음':'B의 스냅샷은 2명: B를 비근무로 바꿈',result:i<5?'COMMIT 전':si?'두 쓰기 모두 커밋 → 근무자 0명 (write skew)':serial?'B가 변경하지 않음 → 근무자 1명':'B의 global revision 충돌 → E, 근무자 1명'});}return out;}
 let skew=skewFrames();
 const isolationPlayer=MM.stepper($('isolation-player'),{steps:6,interval:1700,render(i){const s=skew[i];$('isolation-diagram').innerHTML=svg(box(25,30,300,'A 행',s.a?'근무=true':'근무=false')+box(395,30,300,'B 행',s.b?'근무=true':'근무=false',!s.b?'failure':'')+box(170,150,380,`남은 근무자 ${Number(s.a)+Number(s.b)}명`,Number(s.a)+Number(s.b)>=1?'불변식: 최소 1명 유지':'불변식 위반',''));$('isolation-status').textContent=`A가 본 근무자=${s.readA??'미조회'}, B가 본 근무자=${s.readB??'미조회'} · revision=${s.revision}`;
  return ['① 두 사람이 근무 중이며 최소 한 명은 남아야 합니다.','② A는 근무자 2명을 읽고 자신을 비근무로 바꿔도 된다고 판단합니다.',isolation==='serial'?'③ 직렬 스케줄에서는 B가 아직 읽지 않습니다.':'③ B도 같은 시작 스냅샷에서 근무자 2명을 읽습니다.','④ A의 변경이 커밋돼 현재 DB에는 B 한 명만 근무합니다.',s.decision,s.result][i];
 }});
 $('isolation-mode').onchange=()=>{isolationPlayer.stop();isolation=$('isolation-mode').value;skew=skewFrames();isolationPlayer.go(0);$('isolation-feedback').textContent='최종 근무자 수와 두 번째 쓰기의 운명을 예측하세요.';};
 $('isolation-check').onclick=()=>{const expected=isolation==='si'?'0':'1',ok=$('isolation-prediction').value===expected;feedback('isolation-feedback',ok?'맞습니다. 마지막 단계의 불변식과 COMMIT 결과를 비교하세요.':isolation==='si'?'행 단위 write-write 충돌만 검사하면 서로 다른 행 쓰기가 모두 성공해 0명이 됩니다.':'직렬 실행 또는 이 예제의 보수적인 global 검증은 두 변경을 모두 통과시키지 않습니다.',ok);};
})();
