(() => {
 'use strict';
 const $ = s => document.querySelector(s);
 const all = s => [...document.querySelectorAll(s)];
 const store = {read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}};
 const theme=store.read('linux-kernel-theme',null);
 document.documentElement.dataset.theme=theme || (matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
 $('#theme').onclick=()=>{const value=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=value;store.write('linux-kernel-theme',value);};
 $('#menu').onclick=()=>{const open=$('#contents').classList.toggle('open');$('#menu').setAttribute('aria-expanded',open);$('#menu').textContent=open?'목차 닫기':'목차 열기';};
 $('#chapter-search').addEventListener('input',e=>{let count=0;const q=e.target.value.toLowerCase().trim();all('.nav-group').forEach(group=>{let hits=0;group.querySelectorAll('li').forEach(li=>{li.hidden=!li.textContent.toLowerCase().includes(q);if(!li.hidden)hits++;});group.hidden=hits===0;count+=hits;});$('#search-empty').hidden=count>0;});
 const rawDone=store.read('linux-kernel-progress',[]);
 let done=new Set(Array.isArray(rawDone)?rawDone.filter(n=>Number.isInteger(n)&&n>0&&n<29):[]);
 function progress(){ $('#progress').value=done.size;$('#progress-label').textContent=`${done.size} / 28장 완료`;all('[data-chapter]').forEach(a=>a.classList.toggle('completed',done.has(Number(a.dataset.chapter))));all('[data-card-id]').forEach(a=>a.querySelector('.done-label').textContent=done.has(Number(a.dataset.cardId))?'✓ 완료':'');if($('#mark-done')){const yes=done.has(Number(document.body.dataset.id));$('#mark-done').setAttribute('aria-pressed',yes);$('#mark-done').textContent=yes?'✓ 완료됨 · 다시 학습하기':'이 장 학습 완료';}}
 progress();
 if($('#mark-done'))$('#mark-done').onclick=()=>{const id=Number(document.body.dataset.id);done.has(id)?done.delete(id):done.add(id);const saved=store.write('linux-kernel-progress',[...done]);progress();$('#saved-note').textContent=saved?'이 브라우저에 진도를 저장했습니다.':'브라우저 저장이 차단되어 이번 화면에만 반영했습니다.';};
 all('.copy-code').forEach(button=>button.onclick=async()=>{const text=button.parentElement.nextElementSibling.textContent;try{await navigator.clipboard.writeText(text);button.textContent='복사됨';}catch{button.textContent='코드를 선택해 복사하세요';const range=document.createRange();range.selectNodeContents(button.parentElement.nextElementSibling);getSelection().removeAllRanges();getSelection().addRange(range);} });
 const node=$('#chapter-data'); if(!node)return;
 const data=JSON.parse(node.textContent);
 let step=0,timer=null;
 function stop(){if(timer)clearInterval(timer);timer=null;$('#flow-play').textContent='자동 재생';$('#flow-play').setAttribute('aria-pressed','false');}
 function renderStep(){all('.flow-node').forEach((b,i)=>b.setAttribute('aria-pressed',i===step));$('#step-number').textContent=String(step+1).padStart(2,'0');$('#step-title').textContent=data.flow[step].label;$('#step-detail').textContent=data.flow[step].detail;$('#flow-prev').disabled=step===0;$('#flow-next').disabled=step===data.flow.length-1;}
 all('.flow-node').forEach(b=>b.onclick=()=>{stop();step=Number(b.dataset.step);renderStep();});
 $('#flow-prev').onclick=()=>{stop();step=Math.max(0,step-1);renderStep();};
 $('#flow-next').onclick=()=>{stop();step=Math.min(data.flow.length-1,step+1);renderStep();};
 $('#flow-reset').onclick=()=>{stop();step=0;renderStep();};
 $('#flow-play').onclick=()=>{if(timer){stop();return;}if(step===data.flow.length-1){step=0;renderStep();}$('#flow-play').textContent='일시 정지';$('#flow-play').setAttribute('aria-pressed','true');timer=setInterval(()=>{step++;renderStep();if(step===data.flow.length-1)stop();},matchMedia('(prefers-reduced-motion:reduce)').matches?3500:2200);};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});renderStep();
 const M=window.KernelModels, spec=M.experiments[data.id], state={};
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const host=$('#experiment-ui');host.replaceChildren();
 host.append(el('h3','',spec.title),el('p','caption',spec.description));
 const controls=el('div','controls');host.append(controls);
 const inputs={};
 spec.controls.forEach(c=>{state[c.id]=c.value;const label=el('label','control'),title=el('span','control-title'),out=el('output','',String(c.value)+(c.unit||''));title.append(el('span','',c.label),out);label.append(title);let input;
 if(c.options){input=el('select');c.options.forEach(o=>{const option=el('option','',o.label);option.value=o.value;input.append(option);});}else{input=el('input');input.type='range';input.min=c.min;input.max=c.max;input.step=c.step||1;}
 input.id='control-'+c.id;input.value=c.value;input.setAttribute('aria-label',c.label);out.htmlFor=input.id;label.append(input);controls.append(label);inputs[c.id]={input,out,c};input.addEventListener('input',()=>{state[c.id]=c.options?input.value:Number(input.value);update();});});
 const presets=el('div','presets');host.append(presets);
 function apply(values){Object.assign(state,values);for(const [key,{input}]of Object.entries(inputs))input.value=state[key];update();}
 spec.presets.forEach(p=>{const b=el('button','',p.label);b.onclick=()=>apply(p.values);presets.append(b);});
 const reset=el('button','','기본값으로');reset.id='experiment-reset';reset.onclick=()=>apply(Object.fromEntries(spec.controls.map(c=>[c.id,c.value])));presets.append(reset);
 const result=el('div','experiment-result');result.setAttribute('aria-live','polite');host.append(result);
 const limit=el('p','model-limit',spec.limitations);host.append(limit);
 function update(){for(const [id,{out,c}]of Object.entries(inputs)){out.textContent=c.options?c.options.find(o=>String(o.value)===String(state[id]))?.label:String(state[id])+(c.unit||'');}
 const r=M.compute(data.id,state);result.replaceChildren();const diagram=window.KernelVisuals?.(data.id,state);if(diagram){const figure=el('div');figure.innerHTML=diagram;result.append(figure);}const metrics=el('div','metrics');for(const m of r.metrics){const box=el('div','metric');box.append(el('span','',m.label),el('strong','',m.value));metrics.append(box);}result.append(metrics);
 const chart=el('div','bar-chart');chart.setAttribute('role','img');chart.setAttribute('aria-label',r.bars.map(b=>`${b.label}: ${b.value} / ${b.max}`).join(', '));for(const b of r.bars){const row=el('div','bar-row'),label=el('div','bar-label');label.append(el('span','',b.label),el('span','',`${b.value} / ${b.max}`));const track=el('div','bar-track'),fill=el('div','bar-fill '+(b.tone==='warn'?'warn':''));fill.style.width=Math.max(0,Math.min(100,b.max?b.value/b.max*100:0))+'%';track.append(fill);row.append(label,track);chart.append(row);}result.append(chart);if(!matchMedia('(prefers-reduced-motion:reduce)').matches){chart.querySelectorAll('.bar-fill').forEach(fill=>fill.animate([{width:'0%'},{width:fill.style.width}],{duration:300,easing:'ease-out'}));}
 const items=el('div','state-items');for(const item of r.items){const box=el('div','state-item '+(item.tone||''));box.append(el('strong','',item.label),el('p','',item.detail));items.append(box);}result.append(items,el('p','model-explanation',r.explanation));}
 update();
 all('.quiz').forEach((field,i)=>{const q=data.quiz[i],feedback=field.querySelector('.quiz-feedback');field.querySelector('.check-answer').onclick=()=>{const checked=field.querySelector('input:checked');feedback.className='quiz-feedback';if(!checked){feedback.textContent='먼저 답을 하나 선택하세요.';return;}const correct=Number(checked.value)===q.answer;feedback.classList.add(correct?'correct':'incorrect');feedback.textContent=(correct?'맞았습니다. ':'다시 살펴보세요. ')+q.explanation;};field.addEventListener('change',()=>{feedback.textContent='';feedback.className='quiz-feedback';});});
})();
