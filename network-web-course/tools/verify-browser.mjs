// Uses an existing Playwright package and Chromium executable. Installs nothing.
// node tools/verify-browser.mjs /path/to/playwright/index.mjs /path/to/chromium
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2]||!process.argv[3])throw Error('Supply existing playwright/index.mjs and Chromium executable paths.');
const {chromium}=await import(pathToFileURL(path.resolve(process.argv[2])).href);
const qa=path.join(root,'qa');await fs.mkdir(path.join(qa,'screenshots'),{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');const f=path.resolve(root,'.'+decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''));if(!f.startsWith(root+path.sep)){res.writeHead(403);res.end();return}const data=await fs.readFile(f);res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(data)}catch{res.writeHead(404);res.end('Not found')}});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
const chapters=(await Promise.all(['part-intro','part-a','part-b'].map(async n=>JSON.parse(await fs.readFile(path.join(root,'content',n+'.json'),'utf8'))))).flat().sort((a,b)=>a.id.localeCompare(b.id));
const report={browser:'',pages:0,layoutCases:0,checks:0,errors:[],screenshots:[],scope:'Real headless Chromium: desktop/mobile rendering, interactions, SMIL/CSS motion, persistence, local browser CORS, offline file access. TLS wire handshake and other browser engines not tested.'};
let browser,lab,lablog='';
const check=(condition,label)=>{report.checks++;assert.ok(condition,label)};
try{
 browser=await chromium.launch({headless:true,executablePath:path.resolve(process.argv[3])});report.browser=browser.version();
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 const pages=['index','lab-guide',...chapters.map(c=>c.slug)];
 for(const slug of pages){
  await page.goto(`${base}/${slug}.html`);await page.locator('h1').waitFor();
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const layout=await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));return{width:innerWidth,scroll:document.documentElement.scrollWidth,smallSvg:[...document.querySelectorAll('#simulation svg text')].filter(e=>e.getBoundingClientRect().height<10.5).map(e=>e.textContent),broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src),svgOverflow:[...document.querySelectorAll('#simulation svg g')].flatMap(g=>{const rect=g.querySelector('rect.box');if(!rect)return[];const b=rect.getBBox();return[...g.querySelectorAll('text')].filter(t=>{const r=t.getBBox();return r.x<b.x-1||r.x+r.width>b.x+b.width+1}).map(t=>t.textContent)})}});
   check(layout.scroll<=layout.width,`${slug} at ${width}: horizontal overflow ${layout.scroll}`);
   check(!layout.broken.length,`${slug}: broken images`);
   check(!layout.smallSvg.length,`${slug} at ${width}: unreadable SVG text ${layout.smallSvg.join(',')}`);
   check(!layout.svgOverflow.length,`${slug} at ${width}: SVG labels overflow ${layout.svgOverflow.join(',')}`);
   report.layoutCases++;
  }
  if(slug==='index'||slug==='02-dns'||slug==='06-browser-security'||slug==='07-tls'){
   if(slug!=='index')await page.locator('.lab').scrollIntoViewIfNeeded();
   const file=`${slug}-desktop.png`;await page.screenshot({path:path.join(qa,'screenshots',file)});report.screenshots.push(file);
   await page.setViewportSize({width:390,height:844});
   if(slug==='index')await page.evaluate(()=>scrollTo(0,0));else await page.locator('.lab').scrollIntoViewIfNeeded();
   const mobile=`${slug}-mobile.png`;await page.screenshot({path:path.join(qa,'screenshots',mobile)});report.screenshots.push(mobile);
  }
  if(chapters.some(c=>c.slug===slug)){
   for(const box of await page.locator('.quiz-item').all()){
    const answer=await box.getAttribute('data-answer');await box.locator(`input[value="${answer}"]`).check();await box.locator('[data-check-quiz]').click();check((await box.locator('.feedback strong').textContent())==='정답',slug+' quiz');
   }
  }
  report.pages++;
 }
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/02-dns.html');
 await page.locator('#menu').click();check(await page.locator('#chapter-list').isVisible(),'mobile chapter menu');
 await page.locator('#complete').click();await page.reload();check(await page.locator('#complete').getAttribute('aria-pressed')==='true','progress persisted');await page.locator('#complete').click();
 await page.locator('#theme').click();await page.reload();check(await page.locator('html').getAttribute('data-theme')==='dark','theme persists');
 await page.locator('.lab').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(qa,'screenshots','02-dns-dark-mobile.png')});report.screenshots.push('02-dns-dark-mobile.png');await page.locator('#theme').click();
 for(const slug of ['01-request-journey','02-dns','07-tls']){
  await page.goto(base+'/'+slug+'.html');await page.locator('#next-step').click();
  await page.waitForTimeout(120);const a=await page.locator('.packet').evaluate(el=>{const m=el.getCTM();return{x:m.e,y:m.f}});
  await page.waitForTimeout(180);const b=await page.locator('.packet').evaluate(el=>{const m=el.getCTM();return{x:m.e,y:m.f}});
  check(Math.hypot(a.x-b.x,a.y-b.y)>2,slug+' SMIL moves');
  await page.locator('#reset-step').click();await page.locator('#play-step').click();
  await page.waitForTimeout(2750);check((await page.locator('#step-count').textContent()).startsWith('2 /'),slug+' autoplay advances');
  await page.locator('#play-step').click();const before=await page.locator('#step-count').textContent();
  check(await page.locator('#stage svg').evaluate(s=>s.animationsPaused()),slug+' SMIL paused');
  check(await page.locator('#stage .route').evaluate(e=>getComputedStyle(e).animationPlayState)==='paused',slug+' CSS paused');
  await page.waitForTimeout(2750);check(await page.locator('#step-count').textContent()===before,slug+' pause holds step');
  while(!await page.locator('#next-step').isDisabled())await page.locator('#next-step').click();
  check(!await page.locator('#stage svg').evaluate(s=>s.animationsPaused()),slug+' final motion not prematurely frozen');
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#reset-step').click();await page.locator('#next-step').click();check(await page.locator('animateMotion').count()===0,slug+' reduced motion no SMIL');await page.locator('#play-step').click();check((await page.locator('.step-detail').textContent()).includes('동작 감소'),slug+' reduced motion manual only');await page.emulateMedia({reducedMotion:'no-preference'});
 }
 await page.goto(base+'/03-dns-cache.html');await page.locator('#dns-query').click();await page.locator('#dns-change').click();await page.locator('#dns-query').click();check((await page.locator('#sim-result').textContent()).includes('HIT'),'DNS cache hit');for(let i=0;i<3;i++)await page.locator('#dns-tick').click();await page.locator('#dns-query').click();check((await page.locator('#sim-result').textContent()).includes('192.0.2.20'),'DNS expiry new IP');
 await page.goto(base+'/05-http-cache.html');await page.locator('#cache-policy').selectOption('no-store');check((await page.locator('#cache-stage').textContent()).includes('비어 있음'),'no-store diagram');
 await page.goto(base+'/06-browser-security.html');await page.locator('#cors-method').selectOption('PUT');await page.locator('#cors-pf').uncheck();check((await page.locator('#sim-result').textContent()).includes('실제 요청 전송: 아니오'),'CORS sim preflight');
 await page.goto(base+'/08-http-versions.html');await page.locator('#stream-proto').selectOption('h3');await page.locator('#stream-loss').check();check((await page.locator('#sim-result').textContent()).includes('직접 막지'),'HTTP3 sim');
 await page.goto(base+'/09-proxies.html');await page.locator('#lb-off').check();await page.locator('#lb-burst').click();check(await page.locator('.server:nth-child(2) .big').textContent()==='0','LB exclusion');
 await page.goto(base+'/10-boundaries.html');await page.locator('#tls-mode').selectOption('reencrypt');check((await page.locator('#sim-result').textContent()).includes('독립적인 TLS 연결 2개'),'TLS boundary sim');
 await page.goto(base+'/11-performance.html');await page.locator('#time-reuse').check();check((await page.locator('#sim-result').textContent()).includes('총 200ms'),'waterfall reuse');
 await page.goto(base+'/12-troubleshooting.html');for(const [i,answer]of [1,0,1,0].entries()){await page.locator('#incident-case').selectOption(String(i));for(let n=0;n<3;n++)await page.locator('#reveal-evidence').click();await page.locator(`input[name=incident][value="${answer}"]`).check();await page.locator('#incident-check').click();check((await page.locator('#sim-result').textContent()).includes('적절한 조사입니다'),'incident '+i)}
 // Use a fresh browser context so preflight cache and prior requests cannot mask results.
 lab=spawn('python3',[path.join(root,'tools/lab_server.py'),'--port','0'],{stdio:['ignore','pipe','pipe']});
 lab.stderr.on('data',data=>{lablog+=data.toString()});
 let line='';for await(const chunk of lab.stdout){line+=chunk.toString();if(line.includes('\n'))break}const labport=Number(line.match(/:(\d+)\//)[1]);
 const labcontext=await browser.newContext();const lp=await labcontext.newPage();const requests=[];lp.on('request',r=>requests.push({method:r.method(),url:r.url()}));await lp.goto(`http://127.0.0.1:${labport}/`);
 await lp.locator('[data-mode=deny]').click();await lp.waitForFunction(()=>document.querySelector('#out').textContent.includes('JS 읽기 실패'));check(requests.some(r=>r.method==='GET'&&r.url.includes('mode=deny')),'real browser denied GET sent');
 await lp.locator('[data-mode=allow]').click();await lp.waitForFunction(()=>document.querySelector('#out').textContent.includes('JS 읽기 성공'));check((await lp.locator('#out').textContent()).includes('200'),'real browser CORS allowed');
 await lp.locator('#custom').check();requests.length=0;
 // Browser-internal preflights are not exposed by ordinary Playwright request events.
 // Assert the wire requests from this test server's access log and the browser's JS result.
 const startLog=lablog.length;
 await lp.locator('[data-mode=deny]').click();await lp.waitForFunction(()=>document.querySelector('#out').textContent.includes('JS 읽기 실패'));
 const deniedLog=lablog.slice(startLog);check(deniedLog.includes('OPTIONS /cors?mode=deny'),'real denied preflight reached server');check(!deniedLog.includes('GET /cors?mode=deny'),'real failed preflight prevented actual GET');
 const allowStart=lablog.length;
 await lp.locator('[data-mode=allow]').click();await lp.waitForFunction(()=>document.querySelector('#out').textContent.includes('JS 읽기 성공'));
 const allowLog=lablog.slice(allowStart);check(allowLog.includes('OPTIONS /cors?mode=allow'),'real preflight observed');check(allowLog.includes('GET /cors?mode=allow'),'real allowed GET after preflight');
 await lp.screenshot({path:path.join(qa,'screenshots','real-cors.png')});report.screenshots.push('real-cors.png');await labcontext.close();
 // Offline file loading: no network requests are required for lessons, figures and interactions.
 const offline=await browser.newContext({offline:true});const op=await offline.newPage();await op.goto(pathToFileURL(path.join(root,'03-dns-cache.html')).href);await op.locator('#dns-query').click();check((await op.locator('#sim-result').textContent()).includes('MISS'),'offline file interaction');check(await op.locator('picture img').evaluate(i=>i.complete&&i.naturalWidth>0),'offline image');await offline.close();
 check(report.errors.length===0,'no page JS exceptions');report.result='PASS';await context.close();
}catch(e){report.result='FAIL';report.failure=e.stack;console.error(e.stack);process.exitCode=1}
finally{await browser?.close();lab?.kill();server.close();await fs.writeFile(path.join(qa,'browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))}
