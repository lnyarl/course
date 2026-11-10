const assert=require('node:assert/strict');
const H=require('../assets/malloc.js');
let s=H.create();assert.equal(H.stats(s).resident,0);
const a=H.allocate(s,96),b=H.allocate(s,192),c=H.allocate(s,96);
assert.equal(H.stats(s).live,384);assert.equal(H.stats(s).overhead,48);
H.touch(s,a);H.touch(s,b);H.touch(s,c);assert.equal(H.stats(s).resident,512);
H.free(s,b);assert.equal(H.stats(s).resident,512);const d=H.allocate(s,80);assert.equal(s.blocks.find(x=>x.id===d).offset,112);
H.free(s,a);H.free(s,c);H.free(s,d);assert.equal(H.stats(s).largest,1024);assert.equal(H.trim(s),1024);assert.equal(H.stats(s).resident,0);assert.equal(s.reserved,0);H.allocate(s,512);assert.equal(s.reserved,1024);
s=H.create();s.cache=true;const x=H.allocate(s,96);H.touch(s,x);H.free(s,x);assert.equal(H.stats(s).cached,112);H.trim(s);assert.equal(s.reserved,256);assert.equal(H.stats(s).resident,256);const y=H.allocate(s,96);assert.equal(s.blocks.find(b=>b.id===y).offset,0);H.free(s,y);H.flush(s);assert.equal(H.stats(s).cached,0);H.trim(s);assert.equal(s.reserved,0);
// Every supported request preserves a contiguous partition and aligned live chunks.
for(let size=1;size<=512;size++){s=H.create();const id=H.allocate(s,size);const st=H.stats(s);assert.equal(st.live,size);assert.equal(s.blocks.reduce((n,b)=>n+b.size,0),s.reserved);assert.equal(s.blocks[0].size%16,0);H.touch(s,id);assert.ok(H.stats(s).resident<=s.reserved);H.free(s,id);H.trim(s);assert.equal(s.reserved,0);}
console.log('Heap lifecycle and 512 request sizes passed');
