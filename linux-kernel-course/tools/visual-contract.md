# Inline visual authoring contract

Main owns `drawing.js`, `atlas-ui.js`, `atlas.css`, build integration and verification. Executors own one `atlas-*.js` module only. Preserve all unrelated edits and rich chapter JSON.

Register `globalThis.KernelAtlas[id]` inside `(function(D,A){ ... })(globalThis.KernelDrawing, globalThis.KernelAtlas ||= {});`.

Each chapter entry:

```js
{
 figures: [ // FOUR distinct explanatory SVGs placed inside relevant prose
  {after:1, title:'...', caption:'...', width:900, height:340, shapes:[...]},
  // after = existing prose section index (1-based); inserted after its first paragraph
 ],
 scene: {
  after:2, title:'...', intro:'...', width:900,height:420,
  controls:[{id:'scenario',label:'...',value:'normal',options:[{value:'normal',label:'...'},{value:'blocked',label:'...'}]}],
  build(values) { return [
   {label:'...',note:'...',shapes:[...],stats:[['지표','값'],['...','...']]},
   // 6–10 frames; moving entities keep identical shape keys across frames.
  ]; },
  observe:['...', '...'],
  assumptions:'A precise model boundary, no actual performance claims.'
 }
}
```

Helpers in D (all return single shape except block/token return arrays):
- `rect(key,x,y,w,h,tone='blue',rx=5)`
- `text(key,x,y,text,size=16,anchor='start',tone='ink')`; newline supported
- `line(key,x1,y1,x2,y2,tone='muted',arrow=false,dash='')`
- `circle(key,cx,cy,r,tone='blue')`
- `path(key,d,tone='muted',fill='none')`; static path geometry only
- `block(key,x,y,w,h,title,subtitle='',tone='blue')`: rect + centered title (+ subtitle)
- `token(key,x,y,label,tone='blue',r=18)`: circle + text at x,y
- tones: blue,purple,green,orange,red,muted,ink,white. Palette supports fill/stroke distinctly.
- Raw shape `{key,type:'rect|text|circle|line|path',attrs:{...},tone:'...',text:'...',tooltip:'...'}` supported.
- `D.svg(shapes,width,height,title,prefix)` renders deterministic SVG markup (main exporter uses).

Every frame contains complete shapes for that moment. Numeric attrs tween in common engine: x/y/cx/cy/width/height/x1/y1/x2/y2/r/opacity. Keep entity key+type stable for real movement. Text switches at boundary. New/disappearing shapes fade. Do not animate a highlight across text cards as the main demonstration.

Quality:
- Four figures must depict domain geometry, e.g. address ranges, page grids, register layouts, trees, lifelines, buffer/queue slots, nested namespaces, dependency graphs, timelines. Not four variants of generic box-arrow chains.
- A scene has recognizable actors/resources and entities visibly moving or expanding. Scenario selection changes causal sequence/state, not only a label or number.
- All controls must be meaningful; scenario changes reset playback. Main provides play/pause/next/prev/reset/scrub/speed and event history.
- Caption teaches what to notice and explains color/geometry. Color alone must not encode the entire meaning.
- All Korean descriptions, v6.18 baseline. Validate against existing chapter text and official sources if uncertain. No GPU.
- SVG nominal width900, labels≥15 where possible. Keep all labels within bounds; no long paragraph inside shape. Use multiline text for >16 Korean chars. Prefer vertical space to tiny text.
- Each scene should fit 900×400–560. Four figures usually900×250–400. Mobile preserves minimum readable width in a scroll container with explicit hint.
- Do not edit build/UI/shared CSS, JSON prose, generated HTML. Return chapter ids, counts, educational coverage and checks. No commits/deploy/install.
