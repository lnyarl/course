// Tests the shipped visual atlas with installed tools only; no downloads.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const course=path.join(root,'linux-kernel-course'),qa=path.join(course,'qa');
const argv=process.argv.slice(2),preview=argv.includes('--preview');
const only=argv.find(x=>x.startsWith('--ids='))?.slice(6).split(',').map(Number);
const {chromium}=await import(pathToFileURL(argv.find(x=>x.endsWith('index.mjs'))||'/tmp/queue-course-tools/node_modules/playwright/index.mjs'));
const executablePath=argv.find(x=>x.includes('Chromium')||x.includes('Google Chrome for Testing.app'))||'/Users/roychoi/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('outside root');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/linux-kernel-course/`;
const browser=await chromium.launch({executablePath,headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
let checks=0,chapters=0,svgChecks=0,scenarios=0;const errors=[],screenshots=[],check=(ok,msg)=>{assert.ok(ok,msg);checks++;};
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))errors.push(r.status()+' '+r.url());});
const manifest=JSON.parse(await readFile(path.join(course,'manifest.json'),'utf8'));
const inspectBounds=()=>{const a=KernelAtlas[Number(document.body.dataset.id)],holder=document.createElement('div');holder.style.cssText='position:fixed;left:-12000px;top:0;width:900px';document.body.append(holder);const sets=a.figures.map(f=>({...f,name:f.title}));for(const o of a.scene.controls[0].options)sets.push(...a.scene.build({[a.scene.controls[0].id]:o.value}).map((f,i)=>({...f,width:a.scene.width,height:a.scene.height,name:o.value+'/'+i})));let failures=[];for(const s of sets){holder.innerHTML=KernelDrawing.svg(s.shapes,s.width,s.height);const ts=[...holder.querySelectorAll('text')].filter(t=>Number(getComputedStyle(t).opacity)>0);for(let i=0;i<ts.length;i++)for(let j=i+1;j<ts.length;j++){const a=ts[i].getBBox(),b=ts[j].getBBox();if(a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height)failures.push(s.name+': text overlap '+ts[i].textContent+' / '+ts[j].textContent);}for(const t of ts){const b=t.getBBox();if(b.x<-.5||b.y<-.5||b.x+b.width>s.width+.5||b.y+b.height>s.height+.5)failures.push(s.name+': '+t.textContent);}}holder.remove();return{count:sets.length,failures};};
let failure;
await mkdir(qa,{recursive:true});
try{
 for(const c of manifest){
  if(only&&!only.includes(c.id))continue;
  await page.goto(base+c.slug+'.html');const present=await page.locator('.kernel-scene').count();if(preview&&!present)continue;chapters++;
  check(present===1,'scene '+c.id);check(await page.locator('.atlas-figure').count()===4,'four figures '+c.id);
  check(await page.locator('.atlas-figure').evaluateAll(es=>es.every(e=>e.closest('.prose'))),'inline prose figures '+c.id);
  check(await page.locator('.kernel-scene').evaluate(e=>e.previousElementSibling?.id==='concept-'+KernelAtlas[Number(document.body.dataset.id)].scene.after),'inline prose scene '+c.id);
  const bounds=await page.evaluate(inspectBounds);svgChecks+=bounds.count;check(!bounds.failures.length,'SVG text bounds '+c.id+' '+bounds.failures.join('; '));
  await page.locator('.atlas-expand').first().click();check(await page.locator('dialog[open]').count()===1,'zoom opens '+c.id);await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});check(await page.locator('dialog').count()===0,'Escape closes '+c.id);
  const select=page.locator('.scene-controls [data-control]').first();const options=await select.locator('option').evaluateAll(es=>es.map(e=>e.value));check(options.length>=2,'scenario options '+c.id);
  for(const option of options){scenarios++;await select.selectOption(option);check(await page.locator('.kernel-scene').getAttribute('data-frame')==='0','scenario reset '+c.id);
   await page.locator('.scene-next').click();check(await page.locator('.kernel-scene').getAttribute('data-frame')==='1','next '+c.id);await page.locator('.scene-prev').click();check(await page.locator('.kernel-scene').getAttribute('data-frame')==='0','previous '+c.id);
   const scrub=page.locator('.scene-scrub');await scrub.focus();await scrub.press('ArrowRight');check(await page.locator('.kernel-scene').getAttribute('data-frame')==='1','keyboard scrub '+c.id);await scrub.fill(await scrub.getAttribute('max'));check(await page.locator('.scene-next').isDisabled(),'last frame '+c.id);
   const moving=await page.evaluate(()=>{const s=KernelAtlas[Number(document.body.dataset.id)].scene;const fs=s.build(KernelScene.state.values);for(let i=0;i<fs.length-1;i++)for(const a of fs[i].shapes){const b=fs[i+1].shapes.find(b=>a.key===b.key&&a.type===b.type);if(!b||a.type==='text')continue;for(const k of ['x','y','cx','cy','x1','y1','x2','y2','width','height','r'])if(typeof a.attrs[k]==='number'&&typeof b.attrs[k]==='number'&&a.attrs[k]!==b.attrs[k])return{frame:i,key:a.key,attr:k,from:a.attrs[k],to:b.attrs[k]};}return null;});
   check(!!moving,'real moving resource '+c.id+'/'+option);await page.evaluate(i=>KernelScene.jump(i),moving.frame);await page.locator('.scene-play').click();await page.waitForTimeout(300);await page.locator('.scene-play').click();const val=await page.locator('.scene-canvas [data-key="'+moving.key+'"]').getAttribute(moving.attr);check(Number(val)>Math.min(moving.from,moving.to)&&Number(val)<Math.max(moving.from,moving.to),'interpolated midpoint '+c.id+'/'+option);const snapshot=await page.locator('.scene-canvas').innerHTML();await page.waitForTimeout(150);check(await page.locator('.scene-canvas').innerHTML()===snapshot,'pause stable '+c.id);await page.locator('.scene-play').click();await page.waitForTimeout(180);await page.locator('.scene-play').click();check(await page.locator('.scene-canvas').innerHTML()!==snapshot,'resume moves '+c.id);
  }
  await page.locator('.scene-reset').click();check(await page.locator('.kernel-scene').getAttribute('data-frame')==='0','reset '+c.id);check(await select.inputValue()===options[0],'reset scenario '+c.id);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+c.id+'/'+width);}
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.scene-play').click();const still=await page.locator('.scene-canvas').innerHTML();await page.waitForTimeout(180);check(await page.locator('.scene-canvas').innerHTML()===still,'reduced motion no tween '+c.id);await page.locator('.scene-play').click();await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.scene-reset').click();
  console.log('atlas chapter '+c.id+' passed');
  if([6,13,14,17,20].includes(c.id)){await page.evaluate(()=>KernelScene.jump(Math.floor(KernelScene.state.frames/2)));const name='atlas-'+String(c.id).padStart(2,'0')+'-desktop.png';await page.locator('.kernel-scene').screenshot({path:path.join(qa,name),style:'#course-chrome{visibility:hidden!important} html{scroll-behavior:auto!important}'});screenshots.push(name);const fig='atlas-'+String(c.id).padStart(2,'0')+'-figure.png';await page.locator('.atlas-figure').first().screenshot({path:path.join(qa,fig),style:'#course-chrome{visibility:hidden!important} html{scroll-behavior:auto!important}'});screenshots.push(fig);}
 }
 if(!preview)check(chapters===(only?only.length:28),'requested chapter coverage');check(!errors.length,'browser errors '+errors.join('; '));
}catch(e){failure=e;}
finally{await mkdir(qa,{recursive:true});const result={chapters,checks,scenarios,svgChecks,browserErrors:errors,preview,requestedIds:only||null,screenshots,...(failure?{failure:failure.message}:{})};await writeFile(path.join(qa,only?'atlas-browser-targeted-results.json':'atlas-browser-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));await browser.close();await new Promise(r=>server.close(r));}
if(failure)throw failure;
