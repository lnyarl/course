(function(root){
 'use strict';
 const make=(key,type,attrs,tone,text)=>({key,type,attrs,tone,text});
 const rect=(key,x,y,width,height,tone='blue',rx=5)=>make(key,'rect',{x,y,width,height,rx},tone);
 const text=(key,x,y,value,size=16,anchor='start',tone='ink')=>make(key,'text',{x,y,'font-size':size,'text-anchor':anchor},tone,String(value));
 const circle=(key,cx,cy,r,tone='blue')=>make(key,'circle',{cx,cy,r},tone);
 const line=(key,x1,y1,x2,y2,tone='muted',arrow=false,dash='')=>make(key,'line',{x1,y1,x2,y2,'data-arrow':arrow?'1':'0',...(dash?{'stroke-dasharray':dash}:{})},tone);
 const path=(key,d,tone='muted',fill='none')=>make(key,'path',{d,fill},tone);
 const block=(key,x,y,w,h,title,subtitle='',tone='blue')=>[rect(key,x,y,w,h,tone),text(key+'-label',x+w/2,y+h/2+(subtitle?-5:6),title,16,'middle'),...(subtitle?[text(key+'-sub',x+w/2,y+h/2+20,subtitle,13,'middle','muted')]:[])];
 const token=(key,x,y,label,tone='blue',r=18)=>[circle(key,x,y,r,tone),text(key+'-label',x,y+5,label,13,'middle',tone)];
 const escape=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const palette={blue:['#eaf2ff','#175cd3'],purple:['#f2edff','#6941c6'],green:['#e9f7ef','#087443'],orange:['#fff2e3','#a64b00'],red:['#ffefed','#b42318'],muted:['#f4f5f7','#667085'],ink:['#f4f5f7','#20242c'],white:['#ffffff','#98a2b3']};
 function renderShape(s,prefix){const colors=palette[s.tone]||palette.blue;const a={...s.attrs,'data-key':s.key};delete a['data-arrow'];if(s.type==='text'){a.fill=colors[1];a['font-family']='Inter, Pretendard, Apple SD Gothic Neo, sans-serif';a['font-weight']=500;}else{a.fill=s.type==='line'||s.type==='path'?'none':colors[0];a.stroke=colors[1];a['stroke-width']=s.type==='line'?2:1.5;if(s.attrs.fill!==undefined)a.fill=s.attrs.fill;}if(s.attrs['data-arrow']==='1')a['marker-end']=`url(#${prefix}-${s.tone||'blue'})`;
 const attrs=Object.entries(a).map(([k,v])=>`${k}="${escape(v)}"`).join(' ');let body=s.tooltip?'<title>'+escape(s.tooltip)+'</title>':'';if(s.type==='text'){const lines=String(s.text??'').split('\n');body+=lines.map((t,i)=>`<tspan x="${s.attrs.x}" dy="${i?Number(s.attrs['font-size']||16)*1.4:0}">${escape(t)}</tspan>`).join('');}return `<${s.type} ${attrs}>${body}</${s.type}>`;}
 function defs(prefix){return '<defs>'+Object.entries(palette).map(([k,v])=>`<marker id="${prefix}-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${v[1]}"/></marker>`).join('')+'</defs>';}
 function svg(shapes,width=900,height=400,title='',prefix='diagram'){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title>${defs(prefix)}<g class="atlas-shapes">${shapes.map(s=>renderShape(s,prefix)).join('')}</g></svg>`;}
 root.KernelDrawing={rect,text,circle,line,path,block,token,svg,renderShape,defs,palette,escape};
})(globalThis);
