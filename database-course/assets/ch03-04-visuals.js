/* Controlled process models complement the reference implementation; no file I/O. */
(function () {
  const $ = id => document.getElementById(id), esc = MM.esc;
  const svg = (body, height = 250) => `<svg viewBox="0 0 720 ${height}" role="img" aria-label="현재 단계의 데이터와 연결 상태">${body}</svg>`;
  function box(x,y,w,title,detail,active=false,retired=false) {
    return `<g class="${active?'active ':''}${retired?'retired':''}"><rect x="${x}" y="${y}" width="${w}" height="58" rx="6"/><text x="${x+w/2}" y="${y+23}" text-anchor="middle">${esc(title)}</text><text x="${x+w/2}" y="${y+44}" text-anchor="middle" class="muted">${esc(detail)}</text></g>`;
  }
  const wire = (x1,y1,x2,y2,active=false) => `<path d="M${x1} ${y1}L${x2} ${y2}" class="wire${active?' current-wire':''}"/>`;
  function facts(id,entries) {$(id).innerHTML=entries.map(([k,v])=>`<div><b>${esc(k)}</b>${esc(v)}</div>`).join('');}
  function feedback(id,message,correct) {$(id).textContent=message;$(id).dataset.correct=String(correct);}
  if ($('split-process')) {
    let keys=[10,20,30,40], mode='leaf';
    const player=MM.stepper($('split-player'),{steps:5,interval:1800,render(step){
      const mid=2, separator=keys[mid], left=keys.slice(0,mid),right=keys.slice(mode==='leaf'?mid:mid+1);
      let drawing='';
      if(step<2) drawing=box(190,110,340,keys.join(' | '),step===0?'입력 후 키 4개: 최대 3개 초과':`분할 위치: 인덱스 ${mid}`,true);
      else {
        drawing=box(35,145,280,left.join(' | '),mode==='leaf'?'왼쪽 리프 p1':'왼쪽 내부 p1 · 자식 3개',step===2);
        drawing+=box(405,145,280,right.join(' | '),mode==='leaf'?'오른쪽 리프 p2':'오른쪽 내부 p2 · 자식 2개',step===2);
        if(step>=3){drawing+=box(265,20,190,String(separator),mode==='leaf'?'부모에 복사':'부모로 이동',step===3);drawing+=wire(310,78,175,145)+wire(410,78,545,145);}
        if(mode==='leaf'&&step>=4)drawing+=wire(315,174,405,174,true)+`<text x="360" y="165" text-anchor="middle" class="muted">next →</text>`;
      }
      $('split-drawing').innerHTML=svg(drawing);
      facts('split-facts',[['종류',mode==='leaf'?'리프 · 실제 값 보관':'내부 · 구분 키/자식 번호'],['부모로 올릴 키',step>=3?String(separator):'아직 반영 전'],['오른쪽에 같은 키',step>=2?(mode==='leaf'?'남음: 키와 값 유지':'없음: 구분 키를 이동'):'분할 전']]);
      return ['① 정렬된 네 키가 들어와 노드 용량을 넘었습니다.','② 가운데 인덱스 2를 경계로 정합니다. 아직 부모와 연결은 바꾸지 않았습니다.',mode==='leaf'?'③ 두 리프로 나눕니다. 오른쪽 첫 키와 실제 값은 오른쪽에 남습니다.':'③ 가운데 키는 양쪽 내부 노드에서 빼고 부모로 올릴 값으로 보관합니다.',mode==='leaf'?'④ 오른쪽 첫 키를 부모에 복사합니다. 같은 키가 부모와 리프 양쪽에 있습니다.':'④ 가운데 구분 키를 부모로 이동합니다. 자식 배열도 3개/2개로 나눕니다.',mode==='leaf'?'⑤ left.next는 새 오른쪽 리프, right.next는 기존 다음 리프를 가리킵니다.':'⑤ 부모의 자식 번호가 두 내부 노드를 가리킵니다. 내부 노드는 리프 next 연결을 갖지 않습니다.'][step];
    }});
    function apply(){
      player.stop();
      const raw=$('split-keys').value.split(',').map(s=>s.trim());
      const values=raw.map(Number);
      if(raw.length!==4||raw.some(s=>!s)||values.some(n=>!Number.isInteger(n)||n< -999||n>999)||new Set(values).size!==4){$('split-kind').value=mode;feedback('split-feedback','서로 다른 정수 네 개를 쉼표로 입력하세요. 범위는 −999~999입니다. 재생을 멈추고 이전 상태를 유지합니다.',false);return;}
      keys=values.sort((a,b)=>a-b);mode=$('split-kind').value;player.go(0);feedback('split-feedback','입력 적용. 오른쪽에 키가 남을지 예측한 뒤 진행하세요.',true);
    }
    $('split-apply').onclick=apply;$('split-kind').onchange=apply;
    $('split-check').onclick=()=>{const correct=$('split-prediction').value===(mode==='leaf'?'yes':'no');feedback('split-feedback',correct?'맞습니다. 단계 3~4에서 양쪽 키 목록을 비교하세요.':mode==='leaf'?'리프는 복사합니다. 실제 키·값은 오른쪽에 남습니다.':'내부 노드는 이동합니다. 가운데 구분 키를 오른쪽에 남기지 않습니다.',correct);};
    const rebalance=MM.stepper($('rebalance-player'),{steps:4,interval:1800,render(step){
      const borrow=$('rebalance-case').value==='borrow';
      const left=step===0?[10,20]:step<3?[20]:borrow?[20,30]:[20,30,40];
      const right=step<3?(borrow?[30,40,50]:[30,40]):borrow?[40,50]:[];
      const rootGone=!borrow&&step===3, sep=step===3&&borrow?40:30;
      let body='';
      if(!rootGone){body=box(260,15,200,`부모 [${sep}]`,'루트 p9',step===3)+wire(300,73,170,140)+wire(420,73,550,140);}
      body+=box(30,140,280,left.join(' | '),rootGone?'p1 · 새 루트 리프':`p1 · ${left.length}키`,step===1||step===3);
      body+=box(410,140,280,right.length?right.join(' | '):'연결에서 제거',`p2${rootGone?' · 미사용 페이지':''}`,step===2,rootGone);
      if(!rootGone)body+=wire(310,168,410,168,step===3);
      body+=`<text x="360" y="235" text-anchor="middle" class="muted">${rootGone?'root=p1, p1.next=0. 파일 공간 재사용은 별도 과제.':'p1.next=p2, p2.next=0'}</text>`;
      $('rebalance-drawing').innerHTML=svg(body,265);
      facts('rebalance-facts',[['선택한 형제',borrow?'3키 · 하나를 줄 수 있음':'2키 · 빌려주면 형제도 부족'],['왼쪽 상태',`${left.length}키${left.length<2?' · 최소 개수 미달':''}`],['부모 경계',rootGone?'제거됨 · 루트 축소':String(sep)]]);
      return ['① 최소 2키 규칙을 만족하는 두 리프에서 시작합니다.','② 왼쪽에서 10을 지웠습니다. 1키만 남아 보정이 필요합니다.',borrow?'③ 오른쪽은 3키라 30을 빌려줄 수 있습니다. 경계가 어디로 바뀔지 예측하세요.':'③ 오른쪽도 최소 2키입니다. 한 키를 빌리면 오른쪽이 부족해져 두 리프를 합칩니다.',borrow?'④ 30을 왼쪽으로 옮기고 부모 경계를 오른쪽 최소 키인 40으로 바꿉니다.':'④ [20,30,40]으로 합치고 p1.next=0으로 바꿉니다. 부모의 오른쪽 자식과 경계를 제거하고 루트를 p1로 축소합니다.'][step];
    }});
    $('rebalance-case').onchange=()=>{rebalance.go(0);$('rebalance-feedback').textContent='새 조건에서 결과를 예측하세요.';};
    $('rebalance-check').onclick=()=>{const correct=$('rebalance-prediction').value===$('rebalance-case').value;feedback('rebalance-feedback',correct?'맞습니다. 마지막 단계의 부모 경계와 next를 확인하세요.':'형제가 최소 개수보다 많이 가졌으면 빌리고, 최소 개수뿐이면 합칩니다.',correct);};
  }
  if ($('encoding-process')) {
    const encoder=new TextEncoder(), max=1n<<63n;
    function integer(s){if(!/^-?\d+$/.test(s))throw Error('정수 형식이 아닙니다.');const n=BigInt(s);if(n< -max||n>=max)throw Error('i64 범위를 벗어났습니다.');return n;}
    let row={id:1n,name:'Roy',age:null,text:encoder.encode('Roy'),bytes:null};
    function encode(r){const b=new Uint8Array(27+r.text.length),v=new DataView(b.buffer);v.setUint16(0,3,true);b[2]=(r.name===null?2:0)|(r.age===null?4:0);v.setBigInt64(3,r.id,true);if(r.name!==null){v.setUint32(11,27,true);v.setUint32(15,r.text.length,true);b.set(r.text,27);}if(r.age!==null)v.setBigInt64(19,r.age,true);return b;}
    row.bytes=encode(row);
    const hex=b=>Array.from(b,v=>v.toString(16).padStart(2,'0')).join(' ');
    const encoding=MM.stepper($('encoding-player'),{steps:6,interval:1700,render(step){
      const labels=['열 수','NULL 비트','id · i64','name · 위치/길이','age · i64','UTF-8 본문'];
      const ranges=['0..2','2..3','3..11','11..19','19..27',`27..${row.bytes.length}`];
      let body='';for(let i=0;i<6;i++){const x=10+i*118;body+=box(x,35,110,labels[i],ranges[i],i===(step===0?0:step===1?1:step===2?2:step===3?3:step===4?5:5));}
      body+=`<text x="360" y="130" text-anchor="middle" class="muted">${esc(step===0?'버퍼 공간을 준비합니다. 값은 아직 쓰지 않았습니다.':step===1?'NULL 비트: '+row.bytes[2].toString(2).padStart(8,'0'):step===2?'id='+row.id+', age='+(row.age===null?'NULL':row.age):step===3?'name: '+(row.name===null?'NULL 셀은 모두 0':`offset=27, length=${row.text.length}`):step===4?`UTF-8 본문 ${row.text.length}바이트 복사`:'행 조립 완료. 슬롯에 넣을 바이트입니다.')}</text>`;
      $('encoding-drawing').innerHTML=svg(body,160);
      const partial=new Uint8Array(row.bytes.length);
      if(step>=1){partial.set(row.bytes.slice(0,3));}
      if(step>=2){partial.set(row.bytes.slice(3,11),3);partial.set(row.bytes.slice(19,27),19);}
      if(step>=3)partial.set(row.bytes.slice(11,19),11);
      if(step>=4)partial.set(row.bytes.slice(27),27);
      $('encoding-bytes').textContent=step===0?'아직 쓰지 않음':hex(partial.slice(0,128))+(partial.length>128?' … (앞 128바이트)':'');
      facts('encoding-facts',[['고정 영역','27바이트'],['문자열 본문',`${row.text.length}바이트${row.name===null?' · NULL':row.name===''?' · 빈 문자열':''}`],['행 길이',`${row.bytes.length}바이트`]]);
      return ['① 입력 스냅샷을 받습니다. 아래 도식과 조회 모형은 이 스냅샷을 사용합니다.','② 열 수와 NULL 비트맵을 씁니다. NULL인 셀의 기본값은 0입니다.','③ id와 NULL이 아닌 age를 little-endian 8바이트로 씁니다.','④ 문자열 셀에 행 기준 offset=27과 UTF-8 바이트 길이를 씁니다. NULL이면 셀은 0입니다.','⑤ 고정 영역 뒤에 UTF-8 본문을 복사합니다. 빈 문자열과 NULL 모두 본문은 없지만 셀과 비트맵은 다릅니다.','⑥ 조립한 행을 힙 슬롯에 넣을 준비가 됐습니다. 이전으로 돌아가 쓰기 순서를 비교하세요.'][step];
    }});
    let query=1n;
    const rid=MM.stepper($('rid-player'),{steps:5,interval:1800,render(step){
      const hit=query===row.id, reached=hit?step:Math.min(step,2),offset=4088-row.bytes.length;
      let body=box(10,25,210,'카탈로그 · p0','스키마 · 힙 first/last',reached===1);
      body+=box(255,25,210,'기본키 색인',`${query} → ${step>=2?(hit?'RID 1:1':'없음'):'아직 탐색 전'}`,reached===2);
      body+=box(500,25,210,'힙 페이지 p1',`slot 1 → offset ${offset}`,reached===3&&hit);
      body+=box(255,155,210,'행 디코딩',step>=4&&hit?'스키마로 실제 값 복원':'아직 행을 읽지 않음',reached===4&&hit);
      body+=wire(220,54,255,54,reached===2)+wire(465,54,500,54,reached===3&&hit)+wire(605,83,360,155,reached===4&&hit);
      if(!hit&&step>=2)body+=`<text x="360" y="132" text-anchor="middle">키 없음: 힙 접근 없이 여기서 종료</text>`;
      $('rid-drawing').innerHTML=svg(body,235);
      let decoded='아직 없음';
      if(hit&&step>=4){const b=row.bytes,v=new DataView(b.buffer),name=(b[2]&2)?'NULL':JSON.stringify(new TextDecoder().decode(b.slice(v.getUint32(11,true),v.getUint32(11,true)+v.getUint32(15,true))));decoded=`${v.getBigInt64(3,true)} | ${name} | ${(b[2]&4)?'NULL':v.getBigInt64(19,true)}`;}
      facts('rid-facts',[['입력 기본키',String(query)],['저장된 기본키',String(row.id)],['파일에서 행 시작',hit&&step>=3?`${4096+offset} = 4096 + ${offset}`:'아직 접근하지 않음'],['디코딩 결과',decoded]]);
      if(!hit&&step>=2)return '③ 색인에 기본키가 없습니다. RID가 없으므로 슬롯과 행을 읽지 않고 (nil)을 반환합니다.';
      return ['① 질의를 받았습니다. 아직 파일 내용을 해석하지 않았습니다.','② 카탈로그에서 열 순서·타입·NULL 허용 여부와 테이블 위치를 읽습니다.','③ 기본키 색인이 RID 1:1을 반환했습니다. 패킹 값은 65537입니다.','④ p1의 slot1에서 행 오프셋과 길이를 읽습니다. RID는 바이트 오프셋이 아닙니다.','⑤ 스키마와 NULL 비트·셀을 이용해 저장한 바이트에서 값을 복원합니다.'][step];
    }});
    $('encoding-capture').onclick=()=>{
      encoding.stop();rid.stop();
      try{const id=integer($('row-id').value),name=$('name-null').checked?null:$('row-name').value,age=$('age-null').checked?null:integer($('row-age').value);const next={id,name,age,text:name===null?new Uint8Array():encoder.encode(name)};if(27+next.text.length>4072)throw Error('행이 4072바이트를 넘습니다.');next.bytes=encode(next);row=next;encoding.go(0);rid.go(0);feedback('encoding-feedback','현재 입력을 가져왔습니다. 아직 자동으로 재생하지 않습니다.',true);}catch(e){feedback('encoding-feedback',e.message+' 재생을 멈추고 이전 스냅샷을 유지합니다.',false);}
    };
    $('encoding-check').onclick=()=>{const raw=$('encoding-guess').value,n=Number(raw),correct=raw.trim()!==''&&Number.isInteger(n)&&n===row.text.length;feedback('encoding-feedback',correct?'맞습니다. 본문은 '+row.text.length+'바이트입니다.':'본문은 '+row.text.length+'바이트입니다. UTF-8 길이를 세며 NULL은 본문을 쓰지 않습니다.',correct);};
    $('rid-apply').onclick=()=>{rid.stop();try{query=integer($('rid-query').value);rid.go(0);feedback('rid-feedback','조회 경로 준비. 저장된 행은 인코딩 스냅샷의 기본키 '+row.id+'입니다.',true);}catch(e){feedback('rid-feedback',e.message+' 재생을 멈추고 이전 조회 기본키 '+query+'를 유지합니다.',false);}};
    $('rid-missing').onclick=()=>{query=row.id===max-1n?row.id-1n:row.id+1n;$('rid-query').value=query.toString();rid.go(0);feedback('rid-feedback','저장되지 않은 키로 바꿨습니다. 어느 단계에서 끝날지 확인하세요.',true);};
  }
})();
