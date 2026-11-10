// Usage: node tools/verify-design.mjs /installed/playwright/index.mjs /installed/chromium
import {createServer} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=await import(pathToFileURL(process.argv[2]));
const server=createServer(async(req,res)=>{
  try {
    let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(name.endsWith('/'))name+='index.html';
    const data=await readFile(path.join(root,name));
    const types={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
    res.setHeader('Content-Type',types[path.extname(name)]||'text/html; charset=utf-8');res.end(data);
  } catch {res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({executablePath:process.argv[3],headless:true});
  const context=await browser.newContext({colorScheme:'dark'});
  await context.addInitScript(()=>{
    for(const key of ['mm-theme','tcpip-theme','wk-theme','theme','network-web-theme','linux-kernel-theme','aspnet-theme'])localStorage.setItem(key,'dark');
  });
  const page=await context.newPage();let errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const courses=(await readdir(root)).filter(name=>name.endsWith('-course'));
  const files=['index.html','CSharp_GC_학습자료.html'];
  for(const course of courses)for(const file of await readdir(path.join(root,course)))if(file.endsWith('.html'))files.push(`${course}/${file}`);
  let visits=0;
  for(const file of files){
    // Every document on mobile; every course home also on tablet and desktop.
    const widths=file.endsWith('index.html')||file.startsWith('CSharp_GC_')?[390,768,1440,1920]:[390];
    for(const width of widths){
      errors=[];await page.setViewportSize({width,height:1000});
      const response=await page.goto(`http://127.0.0.1:${server.address().port}/${file}`);
      assert.ok(response.ok(),file);
      const state=await page.evaluate(()=>{
        const chrome=document.getElementById('course-chrome');
        const main=document.querySelector('main');
        const rect=main.getBoundingClientRect();
        const style=getComputedStyle(main);
        const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
        return {
          readingLeft:rect.left+parseFloat(style.paddingLeft),
          readingWidth:rect.width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),
          textAlign:style.textAlign,
          theme:document.documentElement.dataset.theme,
          bg:getComputedStyle(document.body).backgroundColor,
          overflow:document.documentElement.scrollWidth>innerWidth,
          chrome:!!chrome&&visible(chrome),
          css:document.querySelectorAll('link[href$="shared/course-design.css"]').length,
          themeButtons:[...document.querySelectorAll('#theme,#theme-btn,.theme-btn,[aria-label*="테마"],[title*="테마"]')].filter(visible).length,
        };
      });
      assert.deepEqual(errors,[],`${file} browser errors`);
      assert.equal(state.theme,'light',`${file} theme`);
      assert.equal(state.bg,'rgb(255, 255, 255)',`${file} body background`);
      assert.equal(state.overflow,false,`${file} overflow at ${width}`);
      assert.equal(state.chrome,file!=='index.html',`${file} navigation`);
      assert.equal(state.css,1,`${file} stylesheet connection`);
      assert.equal(state.themeButtons,0,`${file} hidden theme controls`);
      if(width>=1440&&file!=='index.html'){
        assert.equal(state.readingLeft,312,`${file} left alignment`);
        assert.equal(state.readingWidth,960,`${file} reading width`);
        assert.equal(state.textAlign,'left',`${file} text alignment`);
      }
      visits++;
    }
  }
  await page.goto(`http://127.0.0.1:${server.address().port}/os-memory-course/index.html`);
  await page.setViewportSize({width:390,height:900});
  const menu=page.locator('.design-menu');await menu.click();
  assert.equal(await menu.getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('.design-sidebar').isVisible(),true);
  await page.locator('.design-sidebar nav a').first().focus();await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'),'false');
  console.log(`${files.length} documents; ${visits} responsive visits passed under dark OS preference. Mobile menu and Escape passed.`);
} finally {await browser?.close();server.close();}
