// Existing Playwright and Chrome paths are arguments; no downloads.
import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {chromium}=await import(pathToFileURL(process.argv[2]));
const server=createServer(async(req,res)=>{try{
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.join(root,name);const data=await readFile(file);
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'text/html; charset=utf-8');res.end(data);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
try{
 browser=await chromium.launch({executablePath:process.argv[3],headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}/database-course/`;
 const files=(await readdir(path.join(root,'database-course'))).filter(f=>/^0\d.*html$/.test(f));
 let widgets=0,players=0;
 for(const file of files){
  await page.goto(base+file);await page.waitForLoadState('networkidle');
  widgets+=await page.locator('.widget').count();
  check(await page.locator('.lab-guide').count()===await page.locator('.widget').count(),file+' all widgets guided');
  check(await page.locator('.lab-guide details[open]').count()===0,file+' guide detail starts closed');
  const controls=page.locator('.stepper-ctl');
  for(let i=0;i<await controls.count();i++){
   const ctl=controls.nth(i),next=ctl.locator('[data-a="next"]');
   if(await next.isEnabled()){
    const before=await ctl.locator('.pos').textContent();await next.click();
    check(await ctl.locator('.pos').textContent()!==before,file+' step advances');
    await ctl.locator('[data-a="first"]').click();
    check(await ctl.locator('.pos').textContent()===before,file+' reset');players++;
   }
  }
  for(const theme of ['light','dark'])for(const width of [360,1440]){
   await page.setViewportSize({width,height:900});
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${file} overflow ${width} ${theme}`);
  }
 }
 check(widgets===37,'all 37 widgets');check(players>=20,'step players covered');
 await page.goto(base+'02-pages-buffer-pool.html');
 await page.locator('#reset-page').click();await page.locator('#record-len').fill('500');await page.locator('#insert-record').click();
 check((await page.locator('#slot-log').textContent()).includes('length=500'),'slot stores 500 bytes');
 await page.locator('#record-len').fill('4084');await page.locator('#insert-record').click();
 check((await page.locator('#slot-log').textContent()).includes('length=500'),'oversize does not destroy record');
 await page.goto(base+'03-btree.html');
 await page.locator('#split-keys').fill('10,20,30,40');await page.locator('#split-apply').click();
 const split=page.locator('#split-player');while(await split.locator('[data-a="next"]').isEnabled())await split.locator('[data-a="next"]').click();
 check((await page.locator('#split-facts').textContent()).includes('남음'),'leaf separator copied');
 await page.locator('#split-kind').selectOption('inner');while(await split.locator('[data-a="next"]').isEnabled())await split.locator('[data-a="next"]').click();
 check((await page.locator('#split-facts').textContent()).includes('없음'),'internal separator moved');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.querySelector('#split-player [data-a="play"]').disabled);
 check(await split.locator('[data-a="play"]').isDisabled(),'reduced motion stops autoplay');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:360,height:900});
 await page.locator('#split-process').scrollIntoViewIfNeeded();
 await page.screenshot({path:'/tmp/database-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#split-process .lab-guide summary').click();
 await page.locator('#split-process').screenshot({path:'/tmp/database-lab.png'});
 check(errors.length===0,'browser errors: '+errors.join('; '));
 console.log(`PASS: ${checks} assertions; ${files.length} chapters, ${widgets} widgets, ${players} step players; mobile/desktop light/dark`);
}finally{await browser?.close();server.close();}
