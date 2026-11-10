// Uses preinstalled Playwright and Chromium. No dependency downloads.
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const course=path.join(root,'linux-kernel-course');
const {chromium}=await import(pathToFileURL(process.argv[2]));
const manifest=JSON.parse(await readFile(path.join(course,'manifest.json'),'utf8'));
const preview=process.argv.includes('--preview');
if(!preview)assert.equal(manifest.length,28);
const server=createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('outside root');const data=await readFile(file);const mime={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html; charset=utf-8','.c':'text/plain; charset=utf-8'};res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.argv[3],headless:true});
let checks=0;const check=(x,msg)=>{assert.ok(x,msg);checks++;};
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))errors.push(r.status()+' '+r.url());});
const localLinks=new Set();
try{
 for(const c of manifest){
  const data=JSON.parse(await readFile(path.join(course,'content',c.slug+'.json'),'utf8'));
  await page.goto(base+'/linux-kernel-course/'+c.slug+'.html');
  check(await page.locator('h1').textContent()===c.title,'chapter title '+c.id);
  check(await page.locator('.metric').count()>0,'model renders '+c.id);
  const initial=await page.locator('.experiment-result').textContent();
  const presets=page.locator('.presets button:not(#experiment-reset)');
  const states=new Set([initial]);for(let i=0;i<await presets.count();i++){await presets.nth(i).click();states.add(await page.locator('.experiment-result').textContent());}
  check(states.size>1,'presets change state '+c.id);
  await page.locator('#experiment-reset').click();check(await page.locator('.experiment-result').textContent()===initial,'reset model '+c.id);
  for(const input of await page.locator('.control input[type=range]').all()){const value=await input.inputValue();await input.focus();await input.press(Number(value)===Number(await input.getAttribute('max'))?'ArrowLeft':'ArrowRight');check(await input.inputValue()!==value,'keyboard range '+c.id);}
  for(const select of await page.locator('.control select').all()){const values=await select.locator('option').evaluateAll(xs=>xs.map(x=>x.value));const value=await select.inputValue();await select.selectOption(values.find(x=>x!==value));check(await select.inputValue()!==value,'select control '+c.id);}
  await page.locator('.legacy-flow > summary').click();await page.locator('#flow-next').click();check(await page.locator('#step-number').textContent()==='02','flow next '+c.id);await page.locator('.flow-node').last().click();check(await page.locator('#flow-next').isDisabled(),'flow last boundary '+c.id);await page.locator('#flow-reset').click();check(await page.locator('#step-number').textContent()==='01','flow reset '+c.id);
  for(let i=0;i<data.quiz.length;i++){const f=page.locator('.quiz').nth(i);await f.locator('button').click();check((await f.locator('.quiz-feedback').textContent()).includes('선택'),'empty answer '+c.id+'/'+i);await f.locator('input').nth((data.quiz[i].answer+1)%data.quiz[i].options.length).check();await f.locator('button').click();check(await f.locator('.quiz-feedback').getAttribute('class')==='quiz-feedback incorrect','wrong feedback '+c.id+'/'+i);await f.locator('input').nth(data.quiz[i].answer).check();await f.locator('button').click();check(await f.locator('.quiz-feedback').getAttribute('class')==='quiz-feedback correct','correct feedback '+c.id+'/'+i);}
  await page.locator('#mark-done').click();check(await page.locator('#mark-done').getAttribute('aria-pressed')==='true','progress marked '+c.id);await page.reload();check(await page.locator('#mark-done').getAttribute('aria-pressed')==='true','progress persisted '+c.id);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow '+c.id+' width '+width);}
  (await page.locator('a[href]').evaluateAll(xs=>xs.map(x=>x.href))).filter(h=>h.startsWith(base)).forEach(h=>localLinks.add(h));
 }
 await page.goto(base+'/linux-kernel-course/'+manifest[0].slug+'.html');await page.locator('.legacy-flow > summary').click();await page.locator('#flow-play').click();await page.waitForTimeout(2350);check(await page.locator('#step-number').textContent()==='02','autoplay advances');await page.locator('#flow-play').click();await page.waitForTimeout(2350);check(await page.locator('#step-number').textContent()==='02','pause holds step');await page.locator('#flow-reset').click();
 await page.setViewportSize({width:390,height:1000});await page.locator('#menu').click();check(await page.locator('#contents').isVisible(),'mobile menu opens');await page.locator('#chapter-search').fill('zzzznomatch');check(await page.locator('#search-empty').isVisible(),'empty search');await page.locator('#chapter-search').fill('스케줄');check(await page.locator('.nav-group li:not([hidden])').count()>0,'search match');await page.locator('#chapter-search').fill('');await page.locator('#menu').click();
 await page.emulateMedia({reducedMotion:'reduce'});check(await page.locator('.flow-node').first().evaluate(e=>getComputedStyle(e).transitionDuration)==='0s','reduced motion');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto(base+'/linux-kernel-course/malloc-lab.html');check(await page.locator('.heap-block').count()===1,'heap starts free');await page.locator('#heap-allocate').click();check(await page.locator('.heap-block.used').count()===1,'heap allocate');await page.locator('#heap-touch').click();check(await page.locator('.heap-page.resident').count()>0,'heap touches pages');const resident=await page.locator('.heap-page.resident').count();await page.locator('#heap-free').click();check(await page.locator('.heap-page.resident').count()===resident,'free retains resident');await page.locator('#heap-trim').click();check(await page.locator('.heap-page').count()===0,'trim releases heap');await page.locator('#heap-reset').click();await page.locator('#heap-cache').check();await page.locator('#heap-allocate').click();await page.locator('#heap-free').click();check(await page.locator('.heap-block.cached').count()===1,'cache retains block');await page.locator('#heap-flush').click();check(await page.locator('.heap-block.cached').count()===0,'cache flush');
 for(const p of ['index','malloc-lab','lab-guide','references']){await page.goto(base+'/linux-kernel-course/'+p+'.html');for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'guide no overflow '+p+' '+width);}(await page.locator('a[href]').evaluateAll(xs=>xs.map(x=>x.href))).filter(h=>h.startsWith(base)).forEach(h=>localLinks.add(h));}
 await page.goto(base+'/linux-kernel-course/');check(await page.locator('.chapter-card').count()===manifest.length,'all cards');check(await page.locator('#progress-label').textContent()===`${manifest.length} / 28장 완료`,'aggregate progress');check(await page.locator('html').getAttribute('data-theme')==='light','shared light theme');
 await page.locator('#course-comments #toggle').click();check(await page.locator('#course-comments #panel').isVisible(),'shared comments work');await page.locator('#course-comments #close').click();
 for(const href of localLinks){const u=new URL(href);u.hash='';const r=await context.request.get(u.href);check(r.ok(),'local link available '+u.pathname);}
 await mkdir(path.join(course,'qa'),{recursive:true});
 await page.evaluate(()=>{localStorage.setItem('linux-kernel-theme',JSON.stringify('light'));document.documentElement.dataset.theme='light';});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(course,'qa','index-desktop.png'),fullPage:false});
 await page.goto(base+'/linux-kernel-course/'+manifest[0].slug+'.html');await page.locator('#experiment').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(course,'qa','experiment-desktop.png')});
 await page.goto(base+'/linux-kernel-course/malloc-lab.html');await page.getByRole('button',{name:'분할·병합 사례',exact:true}).click();await page.locator('#allocator').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(course,'qa','malloc-desktop.png')});
 await page.setViewportSize({width:390,height:1000});await page.goto(base+'/linux-kernel-course/'+manifest[0].slug+'.html');await page.screenshot({path:path.join(course,'qa','chapter-mobile.png')});

 check(errors.length===0,'no browser errors '+errors.join('\n'));
 const summary={chapters:manifest.length,checks,browserErrors:errors.length,preview,screenshots:['index-desktop.png','experiment-desktop.png','malloc-desktop.png','chapter-mobile.png']};
 await import('node:fs/promises').then(fs=>fs.writeFile(path.join(course,'qa','browser-results.json'),JSON.stringify(summary,null,2)+'\n'));
 console.log(JSON.stringify(summary));
}finally{await browser.close();await new Promise(r=>server.close(r));}
