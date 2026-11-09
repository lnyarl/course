// DOM behavior checks. Uses an existing jsdom installation supplied as argv[2].
// Run: node tools/verify.mjs /absolute/path/to/jsdom/lib/api.js
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2]) throw new Error('Provide an existing jsdom/lib/api.js path. No dependencies are installed by this script.');
const {JSDOM}=await import(pathToFileURL(path.resolve(process.argv[2])).href);
const source=fs.readFileSync(path.join(root,'assets/course.js'),'utf8');
const chapters=['part-intro','part-a','part-b'].flatMap(n=>JSON.parse(fs.readFileSync(path.join(root,'content',n+'.json'),'utf8'))).sort((a,b)=>a.id.localeCompare(b.id));
let assertions=0;
const ok=(x,msg)=>{assert.ok(x,msg);assertions++};
for(const c of chapters){
 const html=fs.readFileSync(path.join(root,c.slug+'.html'),'utf8');
 const dom=new JSDOM(html,{url:'https://network-course.test/'+c.slug+'.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.matchMedia=q=>({matches:q.includes('reduced-motion')});w.ResizeObserver=class{observe(){}};
 w.eval(source);
 const q=s=>d.querySelector(s), click=s=>{ok(q(s),'exists '+s);q(s).click()}, set=(s,v)=>{let e=q(s);if(e.type==='checkbox')e.checked=v;else e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));e.dispatchEvent(new w.Event('change',{bubbles:true}))};
 ok(q('#simulation').textContent.length>100,'simulation mounted '+c.id);
 ok(!q('#simulation').textContent.includes('自'),'Korean text '+c.id);
 click('#theme');ok(d.documentElement.dataset.theme==='dark','theme dark');click('#theme');ok(d.documentElement.dataset.theme==='light','theme light');
 click('#complete');ok(q('#complete').getAttribute('aria-pressed')==='true','progress');click('#complete');ok(q('#complete').getAttribute('aria-pressed')==='false','uncomplete');
 for(const box of d.querySelectorAll('.quiz-item')){box.querySelector('button').click();ok(box.querySelector('.feedback').textContent.includes('선택'),'no answer feedback');box.querySelector(`input[value="${box.dataset.answer}"]`).click();box.querySelector('button').click();ok(box.querySelector('.feedback strong').textContent==='정답','quiz '+c.id)}
 const out=()=>q('#sim-result')?.textContent||'';
 if(['01','02','07'].includes(c.id)) {const before=q('.step-detail h3').textContent;click('#next-step');ok(q('.step-detail h3').textContent!==before,'step advances');click('#reset-step');ok(q('.step-detail h3').textContent===before,'step reset');while(!q('#next-step').disabled)click('#next-step');ok(q('#next-step').disabled,'terminal');click('#reset-step');click('#play-step');ok(q('.step-detail').textContent.includes('동작 감소'),'reduced motion');}
 if(c.id==='03'){click('#dns-query');ok(out().includes('MISS'),'DNS initial miss');click('#dns-change');click('#dns-query');ok(out().includes('HIT')&&out().includes('192.0.2.10'),'DNS retained old');for(let i=0;i<3;i++)click('#dns-tick');click('#dns-query');ok(out().includes('MISS')&&out().includes('192.0.2.20'),'DNS expiry refresh');click('#dns-reset');ok(out().includes('0회'),'DNS reset');}
 if(c.id==='04'){click('[data-line="7"]');ok(out().includes('octet'),'message explanation');click('[data-line="9"]');ok(out().includes('13바이트'),'body length');}
 if(c.id==='05'){ok(out().includes('fresh'),'fresh');set('#cache-changed',true);ok(out().includes('fresh'),'fresh even changed');set('#cache-age',90);ok(out().includes('200'),'stale changed');set('#cache-changed',false);ok(out().includes('304'),'stale unchanged');set('#cache-policy','no-store');ok(out().includes('저장하지'),'no store');set('#cache-policy','no-cache');set('#cache-age',0);ok(out().includes('304'),'no-cache validation');}
 if(c.id==='06'){ok(out().includes('차단'),'CORS default blocked');set('#cors-allow','exact');ok(out().includes('JS 응답 읽기: 허용'),'CORS exact');set('#cors-allow','star');set('#cors-credentials',true);ok(out().includes('JS 응답 읽기: 차단'),'CORS star credentials');set('#cors-custom',true);set('#cors-pf',false);ok(out().includes('실제 요청 전송: 아니오'),'CORS preflight stop');set('#cors-cross','same');ok(out().includes('JS 응답 읽기: 허용'),'same origin bypass');}
 if(c.id==='08'){set('#stream-proto','h2');set('#stream-loss',true);ok(out().includes('TCP 바이트'),'h2 loss');set('#stream-proto','h3');ok(out().includes('직접 막지'),'h3 loss');}
 if(c.id==='09'){click('#lb-burst');ok(q('#lb-servers').textContent.includes('2'),'rr distribution');set('#lb-off',true);click('#lb-reset');click('#lb-burst');ok(q('#lb-servers').children[1].querySelector('.big').textContent==='0','unhealthy B no new requests');set('#lb-off',false);set('#lb-policy','least');click('#lb-reset');click('#lb-send');ok(q('#lb-servers').children[1].querySelector('.big').textContent==='1','least connections B first');}
 if(c.id==='10'){set('#fw-policy','drop');ok(out().includes('타임아웃'),'DROP');set('#tls-mode','reencrypt');ok(out().includes('독립적인 TLS 연결 2개'),'reencrypt');set('#tls-mode','pass');ok(out().includes('TLS 1개'),'passthrough');set('#nat-on',false);ok(out().includes('변환하지'),'NAT toggled');}
 if(c.id==='11'){ok(out().includes('총 300ms'),'timing sum');set('#time-reuse',true);ok(out().includes('총 200ms'),'reuse');set('#time-wait',500);ok(out().includes('총 580ms'),'wait updates');}
 if(c.id==='12'){for(let i=0;i<4;i++){set('#incident-case',i);for(let e=0;e<3;e++)click('#reveal-evidence');ok(q('#reveal-evidence').disabled,'all evidence');q(`input[name=incident][value="${[1,0,1,0][i]}"]`).click();click('#incident-check');ok(out().includes('적절한 조사입니다'),'case answer '+i)}}
 const M=w.NWModels;
 for(const cross of [true,false])for(const method of ['GET','POST','PUT'])for(const custom of [true,false])for(const credentials of [true,false])for(const allow of ['none','exact','star'])for(const preflight of [true,false]){const r=M.cors({cross,method,custom,credentials,allow,preflight});ok(!r.readable||r.actual,'CORS cannot read unsent');if(!cross)ok(r.readable&&!r.pf,'same origin independent');if(cross&&credentials&&allow==='star')ok(!r.readable,'credential wildcard never read');}
 dom.window.close();console.log('PASS',c.id,c.slug);
}
console.log(JSON.stringify({chapters:chapters.length,assertions,scope:'jsdom behavior; not a rendered browser or real browser CORS/TLS test'}));
