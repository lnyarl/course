// Uses an already installed Playwright and Chromium; installs nothing.
import {createServer} from 'node:http';
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=await import(pathToFileURL(process.argv[2]));
const server=createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';const file=path.join(root,name);const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.argv[3],headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
try {
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/');
 const cards=page.locator('.course');const total=await cards.count();check(total===13,'all 13 courses retained');
 check(await page.locator('.ch li').count()===195,'all 195 chapter links retained');
 check(await page.locator('details[open]').count()===0,'chapters collapsed initially');
 await cards.first().locator('summary').click();check(await cards.first().locator('details').getAttribute('open')!==null,'expand chapters');
 await page.locator('#q').fill('혼잡');check(await page.locator('.course:not([hidden])').count()>0,'search finds chapter');
 check(await page.locator('.course:not([hidden]) details[open]').count()>0,'matching chapters exposed');
 check(await page.locator('mark').count()>0,'search highlighted');
 await page.locator('#clear-search').click();check(await page.locator('.course:not([hidden])').count()===total,'clear search restores courses');
 check(await cards.first().locator('details').getAttribute('open')!==null,'clear restores previous expanded state');
 await cards.first().locator('summary').click();
 await page.getByRole('button',{name:'네트워크',exact:true}).click();check(await page.locator('.course:not([hidden])').count()===2,'network filter');
 await page.locator('#q').fill('zz-no-match');check(await page.locator('#empty').isVisible(),'empty state');await page.locator('#reset-filters').click();check(await page.locator('.course:not([hidden])').count()===total,'reset filters');
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no horizontal overflow at ${width}`);
 }
 await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:'/tmp/library-desktop.png'});
 await page.setViewportSize({width:390,height:1000});await page.screenshot({path:'/tmp/library-mobile.png'});
 await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:'/tmp/library-dark.png'});
 await page.locator('#course-comments #toggle').click();check(await page.locator('#course-comments #panel').isVisible(),'comments still available');
 check(errors.length===0,'no browser errors: '+errors.join(','));
 const links=await page.locator('.course a').evaluateAll(nodes=>nodes.map(n=>n.href));
 for(const href of new Set(links)){const response=await context.request.get(href);check(response.ok(),'link available: '+href);}
 console.log(`${checks} checks passed; screenshots /tmp/library-{desktop,mobile,dark}.png`);
} finally {await browser.close();server.close();}
