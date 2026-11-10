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
async function selectText(selector='h1') {await page.locator(selector).first().evaluate(el=>{const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);const n=w.nextNode();const r=document.createRange();r.selectNodeContents(n);const s=getSelection();s.removeAllRanges();s.addRange(r);});await page.locator('#course-comments #add').waitFor({state:'visible'});await page.locator('#course-comments #add').click();}
const widget=page.locator('#course-comments');
try {
 await page.goto(base+'/network-web-course/02-dns.html');
 await page.locator('main p').first().click({clickCount:3});
 await widget.locator('#add').waitFor({state:'visible',timeout:2000});check(true,'triple click offers comment');
 await widget.locator('#add').click();check((await widget.locator('#quote').textContent()).trim().length>0,'triple click quote');await widget.locator('#cancel').click();await widget.locator('#close').click();
 await page.locator('h1').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);});
 await widget.locator('#add').waitFor({state:'visible',timeout:2000});check(true,'element boundary selection offers comment');
 await widget.locator('#add').click();check((await widget.locator('#quote').textContent())===(await page.locator('h1').textContent()),'element selection preserves quote');await widget.locator('#cancel').click();await widget.locator('#close').click();
 const heading=await page.locator('h1').boundingBox();await page.mouse.move(heading.x+3,heading.y+heading.height/2);await page.mouse.down();await page.mouse.move(heading.x+130,heading.y+heading.height/2,{steps:12});await page.mouse.up();await widget.locator('#add').waitFor({state:'visible'});check(true,'mouse drag offers comment');
 await selectText();await widget.locator('#note').fill('DNS 질문 <script>alert(1)</script>');await widget.getByRole('button',{name:'저장',exact:true}).click();check(await widget.locator('article').count()===1,'created');
 await page.reload();await widget.locator('#toggle').click();check((await widget.locator('.body').textContent()).includes('<script>'),'persisted safe text');check(await page.evaluate(()=>CSS.highlights.get('course-notes').size)===1,'highlight restored');
 await widget.getByRole('button',{name:'수정',exact:true}).click();await widget.locator('#note').fill('수정한 질문');await widget.getByRole('button',{name:'저장',exact:true}).click();check(await widget.locator('.body').textContent()==='수정한 질문','edited');
 const downloaded=page.waitForEvent('download');await widget.locator('#export').click();const download=await downloaded;const exported=JSON.parse(await readFile(await download.path(),'utf8'));check(exported.comments[0].quote.length>0 && exported.comments[0].text==='수정한 질문','export context');
 const other=await context.newPage();await other.goto(base+'/network-web-course/02-dns.html');await other.locator('#course-comments #toggle').click();page.once('dialog',d=>d.accept());await widget.getByRole('button',{name:'삭제',exact:true}).click();await other.waitForFunction(()=>document.querySelector('#course-comments').shadowRoot.querySelectorAll('article').length===0);check(true,'cross-tab delete');await other.close();
 await selectText();await widget.locator('#note').fill('저장 실패 시 유지');await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Quota exceeded','QuotaExceededError');};});await widget.getByRole('button',{name:'저장',exact:true}).click();check(await widget.locator('#note').inputValue()==='저장 실패 시 유지','failed save preserves draft');check((await widget.locator('#status').textContent()).includes('저장하지 못했습니다'),'failure visible');await widget.locator('#cancel').click();
 const courses=(await readdir(root)).filter(n=>n.endsWith('-course'));
 for(const course of courses){await page.goto(base+'/'+course+'/');await widget.locator('#toggle').waitFor();check(await widget.count()===1,course+' attached');}
 await page.goto(base+'/concurrency-course/#week-1');await page.locator('#lesson h2').first().waitFor();await selectText('#lesson h2');await widget.locator('#note').fill('동적 강의 메모');await widget.getByRole('button',{name:'저장',exact:true}).click();await page.reload();await widget.locator('#toggle').click();check(await widget.locator('article').count()===1,'dynamic course persistence');await page.waitForFunction(()=>CSS.highlights.get('course-notes')?.size===1);check(true,'dynamic highlight restored');
 await page.setViewportSize({width:390,height:844});check(await widget.locator('#panel').evaluate(el=>el.getBoundingClientRect().right<=innerWidth),'mobile panel fits');await page.screenshot({path:'/tmp/course-comments-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/course-comments-desktop.png'});
 check(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('course-comments:v1:/:' + ''))),'legacy storage namespace retained');
 await page.goto(base+'/shared/examples/standalone.html');await widget.locator('#toggle').waitFor();
 check(await widget.locator('#count').textContent()==='0','new namespace isolated from course notes');
 await page.locator('nav').evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));});
 check(await widget.locator('#add').isHidden(),'outside root cannot create comment');
 await page.locator('main p').first().evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);});
 await widget.locator('#add').click();check(await widget.locator('#quote').textContent()===await page.locator('main p').first().textContent(),'nested element selection preserves full quote');
 check((await widget.locator('h2').textContent()).startsWith('문서 메모'),'custom panel title');
 check(!await page.evaluate(()=>document.documentElement.classList.contains('course-notes-open')),'overlay leaves page layout unchanged');
 await widget.locator('#note').fill('독립 문서 메모');await widget.getByRole('button',{name:'저장',exact:true}).click();await page.reload();await widget.locator('#toggle').click();
 check(await widget.locator('.body').textContent()==='독립 문서 메모','standalone persistence');
 const standaloneDownload=page.waitForEvent('download');await widget.locator('#export').click();const file=await standaloneDownload;const standalone=JSON.parse(await readFile(await file.path(),'utf8'));
 check(standalone.comments.length===1 && standalone.comments[0].page==='example-document','export respects namespace and custom page ID');
 await page.addScriptTag({url:base+'/shared/course-comments.js'});check(await widget.count()===1,'duplicate script does not duplicate widget');
 await page.goto(base+'/concurrency-course/#week-1');await widget.locator('#toggle').click();check(await widget.locator('.body').textContent()==='동적 강의 메모','course notes remain unchanged');
 console.log(`${checks} checks passed; screenshots /tmp/course-comments-{desktop,mobile}.png`);
} finally {await browser.close();server.close();}
