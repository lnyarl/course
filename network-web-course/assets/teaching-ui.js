'use strict';
/* Domain views. Message order, stored values and protection boundaries are explicit. */
window.NWTeaching=(()=>{
const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
function table(caption,headers,rows){return `<div class="table-wrap" tabindex="0" role="region" aria-label="${E(caption)} — 좌우 스크롤 가능"><table class="state-table"><caption>${E(caption)}</caption><thead><tr>${headers.map(h=>`<th scope="col">${E(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((v,i)=>i?`<td>${E(v)}</td>`:`<th scope="row">${E(v)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function svg(el,w,h,title,body){const p=el.id+'-view';el.innerHTML=`<div class="sequence-scroll" role="region" tabindex="0" aria-label="${E(title)}, 좌우 스크롤 가능"><svg class="diagram teaching-svg" style="min-width:${w}px" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${p}-title ${p}-desc"><title id="${p}-title">${E(title)}</title><desc id="${p}-desc">화살표의 방향과 메시지를 읽고, 아래 상태 표에서 결과를 확인하세요.</desc><defs><marker id="${p}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="var(--accent)" stroke-width="1.5"/></marker></defs>${body}</svg></div><p class="mobile-diagram-hint">그림 안을 좌우로 스크롤해 출발점과 도착점을 함께 확인하세요.</p>`;return p}
function sequence(el,{actors,events,current=events.length-1,animate=false,title='메시지 교환 순서',band=null}){
 const w=Math.max(740,actors.length*174),pad=95,dx=(w-2*pad)/(actors.length-1),xs=actors.map((_,i)=>pad+dx*i),top=100,row=62,h=top+events.length*row+35,p=el.id+'-view';
 let b='';
 if(band){const y=top+band.start*row-29;b+=`<rect class="protection-band" x="20" y="${y}" width="${w-40}" height="${(band.end-band.start+1)*row}" rx="8"/><text class="sequence-note" x="30" y="${h-12}">${E(band.label)}</text>`}
 actors.forEach((actor,i)=>{const parts=actor.split('|');b+=`<line class="lifeline" x1="${xs[i]}" y1="65" x2="${xs[i]}" y2="${h-20}"/><rect class="actor-box" x="${xs[i]-75}" y="12" width="150" height="50" rx="6"/><text class="actor-label" text-anchor="middle" x="${xs[i]}" y="34">${E(parts[0])}</text><text class="sequence-note" text-anchor="middle" x="${xs[i]}" y="52">${E(parts[1]||'')}</text>`});
 events.forEach((e,i)=>{const y=top+i*row,f=xs[e.from],t=xs[e.to],active=i===current,done=i<=current;
 b+=`<g class="message ${active?'current':''} ${done?'reached':'pending'}" data-from="${e.from}" data-to="${e.to}"><text class="event-number" x="12" y="${y+5}">${i+1}</text>`;
 if(e.from===e.to){b+=`<rect class="local-action" x="${f-80}" y="${y-24}" width="160" height="46" rx="5"/><text class="message-label" text-anchor="middle" x="${f}" y="${y-4}">${E(e.label)}</text><text class="sequence-note" text-anchor="middle" x="${f}" y="${y+14}">${done?'로컬 처리':'아직 진행 전'}</text>`}
 else{const start=f+(f<t?6:-6),end=t+(f<t?-10:10),path=`M${start} ${y}H${end}`,mid=(start+end)/2;
 b+=`<path class="${active?'route':'message-line'} ${e.response?'response':''}" d="${path}" marker-end="url(#${p}-arrow)"/><rect class="message-mask" x="${mid-130}" y="${y-28}" width="260" height="21"/><text class="message-label" text-anchor="middle" x="${mid}" y="${y-12}">${E(e.label)}</text>${e.note?`<text class="sequence-note" text-anchor="middle" x="${mid}" y="${y+21}">${E(e.note)}</text>`:''}`;
 if(active&&animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)b+=`<circle r="5" class="packet"><animateMotion dur="0.85s" path="${path}" fill="freeze"/></circle>`;
 }b+='</g>';
 });
 svg(el,w,h,title,b);
 el.insertAdjacentHTML('afterbegin','<p class="diagram-direction"><strong>읽는 방향</strong> 가로는 참여자, 세로는 메시지 순서입니다. 실선은 요청, 점선은 응답입니다.</p>');
}
const labels={
'01':['URL 구성요소 해석','주소 질의','A 192.0.2.10 반환','TCP 연결 + TLS 협상','GET /orders','별도 업스트림 HTTP 요청','200 + JSON','응답 + 브라우저 정책 검사'],
'02':['최종 주소를 요청하는 재귀 질의','루트에 다음 위임 질의','TLD referral 반환','TLD에 zone 위임 질의','권한 서버 referral 반환','권한 서버에 A 질의','A 192.0.2.10 · TTL 60','최종 주소 응답'],
'07':['ClientHello · key_share','ServerHello · key_share','EncryptedExtensions · 인증서 · Finished','인증서와 로컬 신뢰 기준 검증','클라이언트 Finished','암호화된 HTTP 요청']};
function stepper(el,config,id,step,animate){
 const actors=id==='07'?['클라이언트|TLS 시작','서버|TLS 종단','신뢰 저장소|클라이언트 로컬']:config.nodes;
 const events=config.steps.map((s,i)=>({from:s[0],to:s[1],label:labels[id][i],response:id==='02'?[2,4,6,7].includes(i):id==='01'?[2,6,7].includes(i):i===1||i===2,note:id==='01'&&i===5?'클라이언트 연결과 별개':id==='07'&&i===3?'CA에 매번 네트워크 질의하는 단계가 아님':''}));
 sequence(el,{actors,events,current:step,animate,title:id==='02'?'재귀 리졸버가 위임을 따라가는 실제 질의 방향':id==='07'?'TLS 메시지와 로컬 검증의 순서':'주소 조회와 HTTP 요청의 분리',band:id==='07'?{start:2,end:4,label:'ServerHello 이후 핸드셰이크 메시지 보호'}:null});
 let rows;
 if(id==='01')rows=[['DNS 결과',step<2?'아직 확정 전':'192.0.2.10','웹 본문 경로와 별개'],['브라우저↔프록시',step<3?'보호 연결 준비 전':'TLS 연결 A','프록시에서 복호화 가능'],['프록시↔앱',step<5?'아직 요청하지 않음':'별도 연결 B','이 구간 암호화는 별도 설정'],['HTTP 응답',step<6?'아직 수신 전':step===6?'프록시가 앱 응답 수신':'브라우저 수신·정책 검사','서버 처리와 JS 공개는 별도']];
 else if(id==='02')rows=[['지금 질의의 수행자',step===0?'클라이언트':step===7?'리졸버 → 클라이언트':'재귀 리졸버','루트와 TLD가 대신 순회하는 구조가 아님'],['리졸버가 가진 정보',step<2?'최종 주소 없음':step<4?'TLD 위임 정보':step<6?'권한 서버 위임 정보':'A 192.0.2.10','referral과 최종 정답을 구분'],['주소 캐시',step<6?'아직 저장 전':'TTL 60초 시작','실제 모델에서는 캐시된 위임을 재사용할 수 있음']];
 else rows=[['핸드셰이크 보호',step<1?'아직 키 합의 전':'ServerHello 이후 보호 가능','인증서 공개키로 HTTP 전체를 암호화하지 않음'],['서버 신원 검증',step<3?'클라이언트 검증 전':'이름·사슬·서명 검증 단계 완료','공유 키 계산과 별도 작업'],['클라이언트 HTTP 전송',step<4?'아직 준비 전':step===4?'Finished 이후 전송 준비':'트래픽 키로 보호된 HTTP 전송','재개·0-RTT는 이 실험에서 생략']];
 $('#stage-state').innerHTML=table('이 단계까지 확인된 상태',['관찰 항목','현재 상태','의미'],rows);
}
function dns(el,{now,origin,cache,connection,lastAnswer,history}){
 const remaining=cache?Math.max(0,cache.until-now):0;
 el.innerHTML=`<div class="cache-clock"><strong>리졸버 시계 ${now}초</strong><span>${cache?(remaining?'캐시 유효':'캐시 만료'):'아직 조회하지 않음'}</span><div class="ttl-track" role="img" aria-label="남은 TTL ${remaining}초"><i style="width:${remaining/60*100}%"></i></div></div>`+table('원본·저장된 값·이미 열린 연결을 따로 보기',['상태를 가진 곳','현재 값','바뀌는 조건'],[['권한 서버',origin,'원본 주소 변경 버튼'],['리졸버 캐시',cache?cache.ip+' / 잔여 TTL '+remaining+'초':'비어 있음','조회 시 없거나 만료되었으면 갱신'],['마지막 조회 결과',lastAnswer||'없음','주소 조회를 실제 실행할 때'],['이미 열린 연결',connection||'없음','명시적으로 닫고 다른 주소로 연결할 때']])+table('관찰 기록 — 시각과 실제 조회를 구분',['시각','행동','결과','기존 연결'],history.slice(-7).map(h=>[h.time+'초',h.action,h.result,h.connection||'없음']));
}
function cache(el,policy,age,changed,r){
 const fresh=r.status.startsWith('fresh'),store=policy!=='no-store',conditional=store&&!fresh;
 const events=fresh?[{from:0,to:1,label:'저장 응답 사용 · fresh'},{from:1,to:0,label:'본문 v1',response:true}]:[{from:0,to:2,label:conditional?'GET + If-None-Match: "v1"':'조건 없는 GET'},{from:2,to:0,label:conditional&&!changed?'304 · 새 본문 없음':'200 · 새 본문 '+(changed?'v2':'v1'),response:true}];
 sequence(el,{actors:['브라우저|다음 요청','응답 저장소|'+(store?'ETag "v1"':'비어 있음'),'원본 서버|'+(changed?'v2':'v1')],events,title:'다음 요청의 실제 메시지와 저장 응답'});
 el.insertAdjacentHTML('beforeend',table('재사용 판단 근거',['질문','현재 답'],[['응답을 저장했는가?',store?'예. v1과 검증자 보관':'아니오. no-store'],['검증 없이 재사용 가능한가?',fresh?'예. age '+age+' < max-age 60':'아니오'],['원본 요청이 필요한가?',fresh?'아니오':conditional?'예. 조건부 요청':'예. 저장 응답 없음'],['새 본문을 받는가?',fresh?'아니오. 저장 본문':r.status.startsWith('304')?'아니오. 저장 본문 재사용':'예. 원본 본문 수신']]));
}
function cors(el,input,r){
 const {method,cross,allow,credentials}=input;
 const events=[{from:0,to:1,label:'fetch() 호출'}];
 if(r.pf){events.push({from:1,to:2,label:'OPTIONS · method/headers 확인'},{from:2,to:1,label:r.actual?'preflight 허용':'preflight 거부',response:true});}
 if(r.actual)events.push({from:1,to:2,label:method+' · 실제 요청'},{from:2,to:1,label:'HTTP 응답 · '+(!cross?'같은 출처':allow==='exact'?'ACAO = 요청 Origin':allow==='star'?'ACAO = *':'ACAO 없음'),response:true});
 events.push({from:1,to:0,label:r.readable?'JS에 응답 공개':'JS에 읽기 실패 전달',response:true});
 sequence(el,{actors:['브라우저 JS|호출한 코드','브라우저 정책|전송·공개 검사','API 서버|인증·인가 별도'],events,title:'preflight, 실제 요청, JS 응답 공개는 세 단계'});
 el.insertAdjacentHTML('beforeend',table('서버 도달과 브라우저 공개를 분리',['검사 지점','이번 결과','해석'],[['preflight',r.pf?(r.actual?'허용':'실패'):'불필요','실패하면 실제 요청 생략'],['실제 요청',r.actual?'서버로 전송':'전송하지 않음','CORS와 서버의 인증·인가는 별도'],['JS 응답 읽기',r.readable?'공개':'차단',credentials&&allow==='star'&&cross?'credentials 포함 요청에서 *는 허용되지 않음':'응답 수신만으로 읽기 허용은 아님']]));
}
function boundary(el,fw,tls,nat){
 const w=900,h=370,p=el.id+'-view',nodes=[{x:20,name:'클라이언트',sub:'10.0.0.2:51000'},{x:250,name:'경계 장비',sub:nat?'SNAT 활성':'주소 유지'},{x:480,name:'리버스 프록시',sub:tls==='pass'?'TLS 통과':'TLS 종료'},{x:730,name:'애플리케이션',sub:tls==='terminate'?'HTTP':'HTTPS'}];
 let b='<text class="message-label" x="20" y="25">위: 전달 정책과 주소 / 아래: TLS가 보호하는 종단</text>';
 for(let i=0;i<3;i++){const start=nodes[i].x+150,end=nodes[i+1].x,y=130;const blocked=fw!=='allow'&&i>=1;b+=`<path class="${blocked?'blocked-line':'message-line'}" d="M${start} ${y}H${end-8}" ${blocked?'':`marker-end="url(#${p}-arrow)"`}/>`;if(blocked)b+=`<text class="sequence-note" x="${(start+end)/2}" y="${y-12}" text-anchor="middle">미전달</text>`;}
 nodes.forEach(n=>{b+=`<rect class="actor-box" x="${n.x}" y="90" width="150" height="80" rx="6"/><text class="actor-label" x="${n.x+75}" y="119" text-anchor="middle">${n.name}</text><text class="sequence-note" x="${n.x+75}" y="148" text-anchor="middle">${n.sub}</text>`});
 b+=`<text class="message-label" x="255" y="200">${fw==='allow'?'신규 연결 정책 허용':fw==='drop'?'DROP · 응답 없이 버림':'REJECT · 명시적 거부'}</text><text class="sequence-note" x="20" y="230">경계 통과 후 출발지: ${nat?'198.51.100.5:62001 (교육용 매핑)':'이 장비에서는 주소·포트 유지'}</text>`;
 const bands=tls==='pass'?[[20,880,'클라이언트 ↔ 앱 · TLS 1개','encrypted']]:[[20,630,'클라이언트 ↔ 프록시 · TLS A','encrypted'],[650,880,tls==='reencrypt'?'프록시 ↔ 앱 · TLS B':'프록시 ↔ 앱 · 평문',tls==='reencrypt'?'encrypted':'plaintext']];
 bands.forEach(([x,end,label,cl])=>{b+=`<rect class="${cl}" x="${x}" y="265" width="${end-x}" height="60" rx="6"/><text class="message-label" text-anchor="middle" x="${(x+end)/2}" y="300">${E(label)}</text>`});
 b+='<text class="sequence-note" x="20" y="352">보호 구간은 구성 설명입니다. 방화벽이 차단하면 위의 실제 연결은 진행되지 않습니다.</text>';svg(el,w,h,'정책 판단·주소 변환·TLS 종단을 분리',b);
}
function retry(el){
 let orders=[],attempts=[],stored=null;
 el.innerHTML='<h3>응답을 잃은 POST를 다시 보내면?</h3><p class="intro">주문 생성 API를 가정한 교육용 상태 모델입니다. 실제 서버를 호출하지 않습니다. 첫 요청은 서버에서 처리된 뒤 응답만 유실되고, 재시도 응답은 도착한다고 가정합니다.</p><div class="controls"><label><input type="checkbox" id="retry-key">서버가 같은 Idempotency-Key의 결과를 보관하는 API</label><button type="button" id="retry-first">첫 POST 전송 · 응답 유실</button><button type="button" id="retry-again" disabled>같은 주문 POST 재시도</button><button type="button" id="retry-reset">초기화</button></div><div id="retry-state" aria-live="polite"></div>';
 function show(){const key=$('#retry-key').checked;$('#retry-first').disabled=attempts.length>0;$('#retry-again').disabled=!attempts.length;$('#retry-key').disabled=attempts.length>0;
 $('#retry-state').innerHTML=table('클라이언트가 아는 것과 서버 상태',['관찰 대상','현재 상태'],[['클라이언트 마지막 관찰',attempts.at(-1)?.client||'아직 전송하지 않음'],['서버에 생성된 주문',orders.length?orders.join(', '):'없음'],['생성된 주문 수',String(orders.length)],['이 API의 중복 방지 계약',key?'order-42 키의 처리 결과를 저장하고 재사용':'별도 중복 방지 없음. POST를 다시 처리']])+table('같은 업무 입력을 다시 보낸 기록',['시도','요청 키','서버의 처리','클라이언트 관찰'],attempts.map(a=>[String(a.n),a.key,a.server,a.client]));}
 function send(lost){const key=$('#retry-key').checked,reused=key&&stored!==null;let order;if(reused)order=stored;else{order=42+orders.length;orders.push(order);if(key)stored=order}attempts.push({n:attempts.length+1,key:key?'order-42':'없음',server:reused?'주문 '+order+' 결과 재사용':'주문 '+order+' 생성',client:lost?'timeout · 응답을 받지 못함':'201 · 주문 '+order+(reused?' 저장 응답 재사용':' 생성 응답')});show()}
 $('#retry-first').onclick=()=>send(true);$('#retry-again').onclick=()=>send(false);$('#retry-reset').onclick=()=>{orders=[];attempts=[];stored=null;show()};$('#retry-key').onchange=show;show();
}

return {table,sequence,stepper,dns,cache,cors,boundary,retry};
})();
