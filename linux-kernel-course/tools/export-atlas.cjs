const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
require(path.join(root,'assets/drawing.js'));
for(const name of ['atlas-execution','atlas-memory','atlas-io']){const f=path.join(root,'assets',name+'.js');if(fs.existsSync(f))require(f);}
const result={};for(const [id,a]of Object.entries(globalThis.KernelAtlas||{})){const s=a.scene;const v=Object.fromEntries(s.controls.map(c=>[c.id,c.value]));const frames=s.build(v);result[id]={figures:a.figures.map((f,i)=>({...f,svg:KernelDrawing.svg(f.shapes,f.width||900,f.height||360,f.title,`atlas-${id}-${i}`)})),scene:{...s,build:undefined,initial:KernelDrawing.svg(frames[0].shapes,s.width||900,s.height||440,s.title,`scene-${id}`),first:frames[0],frameCount:frames.length}};}
process.stdout.write(JSON.stringify(result));
