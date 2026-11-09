(function () {
  const $=id=>document.getElementById(id), esc=MM.esc, utf8=s=>new TextEncoder().encode(s);
  const TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
  function crc(bytes){let c=0xffffffff;for(const b of bytes)c=TABLE[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
  function record(key,value){const k=utf8(key),v=value===null?new Uint8Array():utf8(value),out=new Uint8Array(12+k.length+v.length),d=new DataView(out.buffer);d.setUint32(4,k.length,true);d.setUint32(8,value===null?0xffffffff:v.length,true);out.set(k,12);out.set(v,12+k.length);d.setUint32(0,crc(out.slice(4)),true);return out;}
  function mount(host,previous,opts){if(previous){if(previous.destroy)previous.destroy();else previous.go(0);}host.replaceChildren();return MM.stepper(host,opts);}
  function svgText(x,y,text,small=false,anchor='start'){return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${small?'svx-small':'svx-text'}">${esc(text)}</text>`;}
  function box(x,y,w,h,label,current=false,extra=''){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="svx-box${current?' svx-current':''}${extra}"/>`+svgText(x+w/2,y+h/2+5,label,false,'middle');}
  function keydirText(map){return [...map].map(([key,r])=>`${key} → ${r.offset} (${r.value})`).join('\n')||'(비어 있음)';}
  if($('kv-trace')){
    let player,key='a',end=0,recs=[];
    const phases=[
      [0,[],false,'빈 파일과 빈 색인으로 시작합니다.'],
      [1,[],false,'첫 set을 파일에 덧붙였습니다. 아직 색인은 바꾸지 않았습니다.'],
      [1,[0],false,'색인이 첫 set의 오프셋을 가리킵니다.'],
      [2,[0],false,'set b blue를 덧붙였습니다. 기존 바이트는 그대로입니다.'],
      [2,[0,1],false,'b의 색인도 새 오프셋으로 연결했습니다.'],
      [3,[0,1],false,'같은 키의 새 값을 파일 끝에 썼습니다. 색인은 아직 이전 값을 가리킵니다.'],
      [3,[2,1],false,'같은 키의 색인을 새 레코드로 옮깁니다. 이전 레코드는 파일에 남습니다.'],
      [4,[2,1],false,'삭제 표시도 파일 끝에 덧붙였습니다. 값이 빈 문자열인 것과 다릅니다.'],
      [4,[1],false,'삭제된 키를 메모리 색인에서 제거합니다. 파일 크기는 줄지 않습니다.'],
      [4,[],true,'프로세스를 다시 켜면 메모리 색인은 비어 있습니다. 파일은 그대로 남습니다.'],
      [4,[0],true,'오프셋 0의 set을 재생해 색인에 넣습니다.'],
      [4,[0,1],true,'다음 set을 재생해 b를 복원합니다.'],
      [4,[2,1],true,'같은 키의 최신 set을 읽고 이전 오프셋을 대체합니다.'],
      [4,[1],true,'마지막 tombstone을 읽고 키를 제거합니다. 삭제된 값이 되살아나지 않습니다.']
    ];
    function build(){
      // Stop the old model before validating new input, including rejected input.
      if(player)player.stop();
      const raw=$('kv-trace-key').value;
      if(!raw||raw==='b'||utf8(raw).length>12){
        $('kv-trace-key').setAttribute('aria-invalid','true');
        $('kv-trace-player').inert=true;
        $('kv-trace-player').querySelectorAll('button').forEach(button=>button.disabled=true);
        $('kv-trace-check').disabled=true;
        $('kv-trace-feedback').textContent=`입력 오류: b를 제외한 키를 UTF-8 1~12바이트로 입력하세요. 마지막 유효 키 "${key}"의 단계를 멈춰 두었습니다. 유효한 키를 입력하면 초기화합니다.`;
        return;
      }
      $('kv-trace-key').setAttribute('aria-invalid','false');
      $('kv-trace-player').inert=false;
      $('kv-trace-check').disabled=false;
      key=raw;end=0;recs=[[key,'1'],['b','blue'],[key,'2'],[key,null]].map(([k,v])=>{const r={key:k,value:v,offset:end,size:record(k,v).length};end+=r.size;return r;});
      $('kv-trace-feedback').textContent='';player=mount($('kv-trace-player'),player,{steps:phases.length,interval:1250,render:render});
    }
    function render(i){
      const [count,live,replay,note]=phases[i],map=new Map(live.map(n=>[recs[n].key,recs[n]]));
      const scan=replay?Math.max(-1,i-10):-1;
      let s=svgText(15,24,replay?'파일 재생: 읽기 위치와 메모리 색인':'쓰기: 파일에 덧붙인 뒤 색인 변경');
      s+=svgText(15,57,`파일에 기록된 레코드 ${count}개 / 파일 크기 ${count?recs[count-1].offset+recs[count-1].size:0}바이트`,true);
      for(let n=0;n<4;n++){
        const r=recs[n],x=15+n*180,exists=n<count,selected=live.includes(n),active=replay?n===scan:n===count-1;
        s+=box(x,95,165,60,exists?(r.value===null?`del ${r.key}`:`set ${r.key} ${r.value}`):'아직 없음',active,exists&&!selected?' svx-dead':'');
        s+=svgText(x+82,177,`${r.offset}..${r.offset+r.size} · ${r.size}B`,true,'middle');
        if(exists&&selected)s+=`<path d="M${x+82} 215V158 m-5 7 l5 -7 5 7" class="svx-link"/>`;
      }
      s+=svgText(15,240,'색인이 가리키지 않는 기록도 파일에 남습니다.',true);
      $('kv-trace-svg').innerHTML=s;$('kv-trace-state').textContent=`단계 ${i}: ${replay?'재생 중':'쓰기 중'}\nkeydir\n${keydirText(map)}`;
      $('kv-trace-state').dataset.step=i;
      return note;
    }
    $('kv-trace-key').oninput=build;
    $('kv-trace-check').onclick=()=>{const correct=$('kv-trace-predict').value==='deleted';$('kv-trace-feedback').textContent=correct?'맞습니다. 마지막 tombstone 때문에 대상 키는 (nil), b는 blue입니다.':'최신 set만 보면 2이지만, 마지막 삭제 표시까지 재생하면 (nil)입니다.';player.go(13);};
    build();
  }
  if($('kv-recovery')){
    const originalRecords=[record('a','1'),record('b','2'),record('a','3')],original=new Uint8Array(originalRecords.reduce((n,b)=>n+b.length,0));let off=0;for(const r of originalRecords){original.set(r,off);off+=r.length;}
    let player,frames=[],stopAt=0,bytes,mode;
    function build(){
      mode=$('kv-recover-mode').value;let position=Number($('kv-recover-offset').value);const max=mode==='cut'?42:41;$('kv-recover-offset').max=max;if(position>max){position=max;$('kv-recover-offset').value=max;}
      $('kv-recover-position').textContent=mode==='cut'?`${position}바이트만 남김`:`파일 오프셋 ${position}`;
      bytes=mode==='cut'?original.slice(0,position):original.slice();if(mode==='flip')bytes[position]^=1;
      let offset=0,map=new Map(),stopped=false;frames=[{offset:0,map:new Map(),note:'파일 처음에서 재생을 시작합니다. CRC가 맞는 완전한 레코드만 반영합니다.',read:0}];
      for(let attempt=0;attempt<3;attempt++){
        let note,read=offset;
        if(stopped)note='이미 오류를 만나 정지했습니다. 뒤의 바이트를 새 레코드로 추측하지 않습니다.';
        else if(offset===bytes.length){stopped=true;note='정확한 레코드 경계에서 파일이 끝났습니다. 추가로 복원할 레코드가 없습니다.';}
        else if(bytes.length-offset<12){stopped=true;note=`offset ${offset}: 헤더가 12바이트보다 짧습니다. 여기서 중단합니다.`;}
        else{
          const d=new DataView(bytes.buffer,bytes.byteOffset+offset,bytes.length-offset),klen=d.getUint32(4,true),vlen=d.getUint32(8,true),total=12+klen+(vlen===0xffffffff?0:vlen);
          if(total>bytes.length-offset){stopped=true;note=`offset ${offset}: 길이 필드가 요구하는 레코드가 파일 안에 없습니다. 중단합니다.`;}
          else if(d.getUint32(0,true)!==crc(bytes.slice(offset+4,offset+total))){stopped=true;note=`offset ${offset}: CRC가 다릅니다. 이 레코드와 뒤쪽은 반영하지 않습니다.`;}
          else{const key=new TextDecoder().decode(bytes.slice(offset+12,offset+12+klen)),value=vlen===0xffffffff?null:new TextDecoder().decode(bytes.slice(offset+12+klen,offset+total));if(value===null)map.delete(key);else map.set(key,{offset,value});note=`offset ${offset}: 길이와 CRC가 맞아 ${key}=${value}를 반영했습니다.`;offset+=total;}
        }
        frames.push({offset,map:new Map(map),note,read});
      }
      stopAt=offset;frames.push({offset,map:new Map(map),read:offset,note:`복구 경계는 ${offset}바이트입니다. ${bytes.length-offset}바이트를 꼬리로 버립니다. 경계 뒤에서 다시 검색하지 않습니다.`});
      $('kv-recover-feedback').textContent='';player=mount($('kv-recover-player'),player,{steps:frames.length,interval:1300,render(i){const f=frames[i];$('kv-recover-bytes').innerHTML=Array.from(original,(b,n)=>`<span class="svx-byte${mode==='flip'&&n===position?' svx-bad':''}${n>=bytes.length?' svx-cut':''}${n<f.offset?' svx-read':''}" title="offset ${n}">${(bytes[n]??b).toString(16).padStart(2,'0')}</span>`).join('');$('kv-recover-state').textContent=`파일에 남은 길이 ${bytes.length} · 검증한 끝 ${f.offset}\nkeydir\n${keydirText(f.map)}`;$('kv-recover-state').dataset.offset=f.offset;return f.note;}});
    }
    $('kv-recover-mode').onchange=build;$('kv-recover-offset').oninput=build;
    $('kv-recover-check').onclick=()=>{const raw=$('kv-recover-predict').value,n=Number(raw);$('kv-recover-feedback').textContent=raw!==''&&Number.isInteger(n)&&n===stopAt?`맞습니다. ${stopAt}바이트까지 보존합니다.`:`복구 경계는 ${stopAt}바이트입니다. 손상 바이트가 아니라 마지막으로 검증한 레코드의 끝을 고릅니다.`;player.go(frames.length-1);};build();
  }
  if($('page-write-trace')){
    let player,model;
    function build(){const b=utf8($('page-trace-value').value),existing=$('page-trace-existing').checked,n=existing?1:0,upper=existing?3996:4096,lower=8+4*n,free=upper-lower;model={b,n,upper,lower,free,fits:b.length>0&&b.length+4<=free};$('page-trace-feedback').textContent='';player=mount($('page-trace-player'),player,{steps:5,interval:1250,render});}
    function render(i){const {b,n,upper,lower,free,fits}=model,wrote=fits&&i>=2,slotted=fits&&i>=3,committed=fits&&i>=4,newUpper=upper-b.length,shownN=committed?n+1:n,shownUpper=committed?newUpper:upper;
      let s=svgText(15,26,`헤더 n=${shownN}, upper=${shownUpper} · lower=${8+4*shownN}`,false);s+=svgText(15,55,b.length===0?'빈 레코드는 길이 0이므로 거부합니다.':`삽입 길이 ${b.length}B + 슬롯 4B ${fits?'≤':'>'} 빈 공간 ${free}B`,true);
      s+=box(15,85,100,62,'헤더',committed)+box(125,85,130,62,slotted?`slot ${n} 기록`:'슬롯 디렉터리',slotted&&!committed)+box(265,85,260,62,wrote?'본문 복사됨':'연속 빈 공간',wrote&&!slotted)+box(535,85,190,62,model.n?'기존 레코드 100B':'페이지 끝');
      if(wrote)s+=svgText(280,173,`새 본문: offset ${newUpper}..${upper}`,true);
      if(slotted)s+=svgText(125,204,`slot ${n}: offset=${newUpper}, length=${b.length}`,true);
      s+=svgText(15,240,committed?'헤더 갱신 후 새 레코드를 조회할 수 있습니다.':'이 단계의 임시 바이트만 파일에 쓰면 일관된 페이지가 아닙니다.',true);
      $('page-trace-svg').innerHTML=s;$('page-trace-state').textContent=`단계 ${i} · n=${shownN}, upper=${shownUpper}, free=${shownUpper-(8+4*shownN)}\n${committed?`새 RID의 슬롯 번호는 ${n}입니다.`:slotted?'슬롯 바이트는 썼지만 n이 늘지 않아 아직 조회하지 않습니다.':wrote?'본문 바이트를 복사했지만 슬롯과 헤더는 이전 상태입니다.':'아직 페이지를 바꾸지 않았습니다.'}`;$('page-trace-state').dataset.step=i;
      if(!fits&&i>0)return b.length===0?'빈 레코드는 거부합니다. 모든 단계에서 원래 페이지를 유지합니다.':'공간 부족입니다. 본문·슬롯·헤더를 하나도 바꾸지 않습니다.';
      return ['원래 페이지입니다. 기존 레코드를 보존하면서 새 레코드를 넣을 자리를 계산합니다.','길이 + 슬롯 4바이트가 들어가는지 먼저 검사합니다.','본문을 뒤쪽에 복사합니다. 헤더는 아직 바꾸지 않았습니다.','슬롯에 본문 오프셋과 길이를 적습니다.','마지막에 n과 upper를 갱신합니다. 이는 메모리 내부의 순서이며 원자적 디스크 쓰기 보장은 아닙니다.'][i];
    }
    $('page-trace-value').oninput=build;$('page-trace-existing').onchange=build;
    $('page-trace-check').onclick=()=>{const raw=$('page-trace-predict').value,expected=model.fits?model.free-model.b.length-4:model.free;$('page-trace-feedback').textContent=raw!==''&&Number(raw)===expected?`맞습니다. 최종 free는 ${expected}바이트입니다.`:`최종 free는 ${expected}바이트입니다. ${model.fits?'본문과 슬롯 4바이트를 모두 빼세요.':'실패하면 원래 빈 공간이 그대로입니다.'}`;player.go(4);};build();
  }
  if($('clock-frame-trace')){
    let player,snapshots=[],candidate=-1;
    function build(){let frames=[0,1,2].map(i=>({id:i,pin:$(`clock-pin-${i}`).checked?1:0,ref:$(`clock-ref-${i}`).checked,dirty:$(`clock-dirty-${i}`).checked})),hand=Number($('clock-trace-hand').value),reads=0,writes=0;candidate=-1;snapshots=[];
      function push(note,inspect=-1){snapshots.push({frames:frames.map(f=>({...f})),hand,reads,writes,note,inspect});}
      push('페이지 9는 아직 없습니다. 현재 손 위치부터 프레임을 하나씩 검사합니다.');
      for(let step=0;step<6;step++){const i=hand,f=frames[i];hand=(hand+1)%3;
        if(f.pin){push(`frame ${i}: pin=1이므로 교체할 수 없습니다. R과 dirty는 그대로 둡니다.`,i);continue;}
        if(f.ref){f.ref=false;push(`frame ${i}: R=1이므로 R만 0으로 내리고 한 번 더 기회를 줍니다.`,i);continue;}
        candidate=i;push(`frame ${i}: pin=0, R=0이므로 교체 후보로 선택합니다. dirty는 후보 선택을 막지 않습니다.`,i);reads++;push('새 페이지 9를 임시 버퍼로 읽고 검증했습니다. 기존 프레임은 아직 유지합니다.',i);
        if(f.dirty){if($('clock-write-fail').checked){push(`frame ${i}: dirty 쓰기가 실패했습니다. 기존 page ${f.id}와 dirty를 유지하고 오류를 반환합니다.`,i);break;}writes++;f.dirty=false;push(`기존 page ${f.id}를 파일에 쓴 뒤 dirty를 내립니다. 아직 페이지 번호는 바꾸지 않습니다.`,i);}
        frames[i]={id:9,pin:1,ref:true,dirty:false};push(`frame ${i}를 page 9로 교체했습니다. fetch의 pin=1, R=1입니다.`,i);break;
      }
      if(candidate<0)push('두 바퀴를 검사해도 후보가 없습니다. 모든 프레임이 pin되어 fetch를 실패시킵니다.');
      $('clock-trace-feedback').textContent='';player=mount($('clock-trace-player'),player,{steps:snapshots.length,interval:1300,render(i){const f=snapshots[i];let s=svgText(15,25,`다음 검사 손=${f.hand} · read=${f.reads}, write=${f.writes}`,false);
        for(let n=0;n<3;n++){const x=15+n*240,frame=f.frames[n];s+=box(x,65,220,115,`frame ${n} · page ${frame.id}`,n===f.inspect);s+=svgText(x+110,145,`pin=${frame.pin}  R=${+frame.ref}  dirty=${+frame.dirty}`,true,'middle');if(n===f.hand)s+=`<path d="M${x+100} 45l10 14 10 -14z" class="svx-pointer"/>`;}
        s+=svgText(15,215,'위 삼각형은 다음 검사 위치, 강조 테두리는 이번에 검사한 프레임입니다.',true);$('clock-trace-svg').innerHTML=s;$('clock-trace-state').textContent=f.note;$('clock-trace-state').dataset.step=i;$('clock-trace-state').dataset.candidate=candidate;return f.note;}});
    }
    document.querySelectorAll('#clock-frame-trace input, #clock-trace-hand').forEach(e=>{if(e.id!=='clock-trace-predict')e.onchange=build;});
    $('clock-trace-check').onclick=()=>{const expected=candidate<0?'none':String(candidate);$('clock-trace-feedback').textContent=$('clock-trace-predict').value===expected?`맞습니다. ${candidate<0?'모두 pin되어 후보가 없습니다.':`최초 후보는 frame ${candidate}입니다.`}`:`최초 후보는 ${candidate<0?'없음':`frame ${candidate}`}입니다. 손의 이동과 R 비트가 0이 되는 순서를 따라가세요.`;player.go(snapshots.length-1);};build();
  }
})();
