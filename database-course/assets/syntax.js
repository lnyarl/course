/* Offline course syntax colorizer. No code evaluation and no HTML source insertion. */
(function () {
  'use strict';
  const names = {rust:'Rust',sql:'SQL',bash:'Bash',json:'JSON',python:'Python',ebnf:'EBNF',text:'Text',console:'Console',hexdump:'Hexdump'};
  const aliases = {rs:'rust',sh:'bash',shell:'bash',py:'python',grammar:'ebnf',plaintext:'text',txt:'text'};
  const sets = {
    rust: new Set('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while abstract become box do final macro override priv typeof unsized virtual yield try union'.split(' ')),
    sql: new Set('SELECT FROM WHERE INSERT INTO VALUES CREATE TABLE INT INTEGER TEXT NOT NULL IS AND OR ORDER BY ASC DESC LIMIT JOIN INNER LEFT RIGHT FULL OUTER CROSS ON AS UPDATE SET DELETE DROP ALTER ADD PRIMARY KEY UNIQUE DEFAULT CHECK REFERENCES GROUP HAVING DISTINCT UNION ALL OFFSET TRUE FALSE BEGIN COMMIT ROLLBACK EXISTS IN LIKE BETWEEN CASE WHEN THEN ELSE END COUNT SUM AVG MIN MAX'.split(' ')),
    bash: new Set('if then else elif fi for while until do done in case esac function select time coproc return break continue'.split(' ')),
    python: new Set('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'.split(' '))
  };
  const rustTypes = new Set('bool char str String usize isize u8 u16 u32 u64 u128 i8 i16 i32 i64 i128 f32 f64 Vec Option Result Some None Ok Err Box Self HashMap HashSet BTreeMap Path PathBuf File IoResult Ordering AtomicU64'.split(' '));
  const shellCommands = new Set('alias bg bind builtin cd command declare dirs disown echo enable eval exec exit export false fg getopts hash help history jobs kill let local logout mapfile printf pwd read readonly readarray set shift shopt source test trap true type typeset ulimit umask unalias unset wait cargo rustc rustfmt git dd od xxd head tail wc tr mktemp dirname sed awk grep seq bash sh env python python3 cat tee cp mv rm mkdir touch chmod curl jq'.split(' '));
  const pythonBuiltins = new Set('print len str int float bool bytes bytearray list dict set tuple range enumerate zip open input isinstance assert sum min max sorted any all Exception ValueError True False None'.split(' '));
  const quoted = (source, start, quote, doubled=false, escapes=true) => {
    let i=start+1;
    while(i<source.length) {
      if(escapes && source[i]==='\\') { i=Math.min(source.length,i+2); continue; }
      if(source[i]===quote) {if(doubled && source[i+1]===quote){i+=2;continue;}return i+1;}
      i++;
    }
    return i;
  };
  function blockComment(source,start) {
    let depth=1,i=start+2;
    while(i<source.length && depth) {if(source.startsWith('/*',i)){depth++;i+=2;}else if(source.startsWith('*/',i)){depth--;i+=2;}else i++;}
    return i;
  }
  function variableEnd(source,start) {
    if(source[start+1]==='{') {
      let depth=1,i=start+2;
      while(i<source.length&&depth){if(source[i]==='{')depth++;if(source[i]==='}')depth--;i++;}return i;
    }
    const m=source.slice(start).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!_-])/);return m?start+m[0].length:start+1;
  }
  function plainTokens(source, language) {
    const out=[];let i=0;
    function add(end,type) {if(end<=i)end=i+1;out.push({start:i,end,type});i=end;}
    while(i<source.length) {
      const tail=source.slice(i), c=source[i];let m;
      if(/\s/.test(c)){m=tail.match(/^\s+/);add(i+m[0].length,'');continue;}
      if((language==='rust'&&tail.startsWith('//'))||(language==='sql'&&tail.startsWith('--'))||((language==='python'||language==='bash')&&c==='#'&&(language==='python'||i===0||/[\s;|&()]/.test(source[i-1])))) {
        const end=source.indexOf('\n',i);add(end<0?source.length:end,'comment');continue;
      }
      if((language==='rust'||language==='sql')&&tail.startsWith('/*')){add(blockComment(source,i),'comment');continue;}
      if(language==='rust') {
        if((m=tail.match(/^(?:br|cr|r)(#{0,32})"/))) {const end=source.indexOf('"'+m[1],i+m[0].length);add(end<0?source.length:end+1+m[1].length,'string');continue;}
        if((m=tail.match(/^b?'(?:\\(?:u\{[0-9a-fA-F_]+\}|x[0-9a-fA-F]{2}|.)|[^'\\\r\n])'/u))){add(i+m[0].length,'string');continue;}
        if((m=tail.match(/^'[A-Za-z_][A-Za-z0-9_]*/))){add(i+m[0].length,'lifetime');continue;}
        if((m=tail.match(/^#!?\[[^\]\n]*\]/))){add(i+m[0].length,'meta');continue;}
        if(c==='"'||((c==='b'||c==='c')&&source[i+1]==='"')){const start=c==='"'?i:i+1;add(quoted(source,start,'"'),'string');continue;}
      }
      if(language==='python') {
        if((m=tail.match(/^(?:[rRuUbBfF]{0,2})(?:"""|''')/))){const quote=m[0].slice(-3),end=source.indexOf(quote,i+m[0].length);add(end<0?source.length:end+3,'string');continue;}
        if((m=tail.match(/^[rRuUbBfF]{1,2}(?=["'])/))){const at=i+m[0].length;add(quoted(source,at,source[at]),'string');continue;}
        if((m=tail.match(/^@[A-Za-z_][\w.]*/))){add(i+m[0].length,'meta');continue;}
      }
      if(language==='sql'&&(c==='e'||c==='E')&&source[i+1]==="'"){add(quoted(source,i+1,"'",true,true),'string');continue;}
      if(c==='"'||(c==="'"&&language!=='rust')) {
        let end=quoted(source,i,c,language==='sql',language==='sql'?false:(language!=='bash'||c!="'"));
        const type=language==='json'&&/^\s*:/.test(source.slice(end))?'property':(language==='sql'&&c==='"'?'type':'string');add(end,type);continue;
      }
      if(language==='bash'&&c==='$'&&source[i+1]!=='('){add(variableEnd(source,i),'variable');continue;}
      if(language==='sql'&&(m=tail.match(/^\$\d+/))){add(i+m[0].length,'variable');continue;}
      if((m=tail.match(/^(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)(?:u(?:8|16|32|64|128|size)|i(?:8|16|32|64|128|size)|f(?:32|64))?/))) {add(i+m[0].length,'number');continue;}
      if((m=tail.match(/^[A-Za-z_][A-Za-z0-9_]*/))) {
        const word=m[0], after=source.slice(i+word.length);let type='';
        if(language==='rust')type=sets.rust.has(word)?(['true','false'].includes(word)?'literal':'keyword'):rustTypes.has(word)||/^[A-Z]/.test(word)?'type':/^\s*!/.test(after)?'macro':/^\s*\(/.test(after)?'function':'';
        if(language==='sql')type=sets.sql.has(word.toUpperCase())?(['NULL','TRUE','FALSE'].includes(word.toUpperCase())?'literal':'keyword'):'';
        if(language==='bash')type=sets.bash.has(word)?'keyword':shellCommands.has(word)?'function':/^=/.test(after)?'variable':/^\s*\(\s*\)/.test(after)?'function':'';
        if(language==='python')type=sets.python.has(word)?'keyword':pythonBuiltins.has(word)?'literal':/^\s*\(/.test(after)?'function':'';
        if(language==='json'&&['true','false','null'].includes(word))type='literal';
        if(language==='ebnf')type=word==='EOF'?'keyword':/^\s*=/.test(after)?'function':'';
        add(i+word.length,type);continue;
      }
      if(/[()[\]{}.,;:]/.test(c)){add(i+1,'punctuation');continue;}
      if(/[=+\-*\/<>!&|%?^~]/.test(c)){m=tail.match(/^[=+\-*\/<>!&|%?^~]+/);add(i+m[0].length,'operator');continue;}
      add(i+1,'');
    }
    return out;
  }
  function tokens(source, language) {
    if(language!=='bash')return plainTokens(source,language);
    // Explicit Python heredocs in the course check.sh remain Python, not shell.
    const startLine=/^[ \t]*python(?:3)?[ \t][^\n]*<<-?[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[^\n]*\n/gm;
    const result=[];let start=0,match;
    function append(part,offset,lang){for(const token of plainTokens(part,lang))result.push({...token,start:token.start+offset,end:token.end+offset});}
    while((match=startLine.exec(source))) {
      if(match.index<start)continue;
      const bodyStart=startLine.lastIndex,closing=new RegExp('^'+match[2]+'\\r?$','gm');
      closing.lastIndex=bodyStart;const end=closing.exec(source);if(!end)continue;
      append(source.slice(start,bodyStart),start,'bash');append(source.slice(bodyStart,end.index),bodyStart,'python');
      result.push({start:end.index,end:end.index+end[0].length,type:'meta'});
      start=end.index+end[0].length;startLine.lastIndex=start;
    }
    append(source.slice(start),start,'bash');return result;
  }
  function marksIn(element) {
    const marks=[];let offset=0;
    function visit(node){if(node.nodeType===3){offset+=node.data.length;return;}const start=offset;for(const child of node.childNodes)visit(child);if(node.nodeType===1&&node.tagName==='MARK')marks.push({start,end:offset,className:node.className});}
    visit(element);return marks;
  }
  function highlight(element, requested, options={}) {
    if(!element || element.nodeType!==1)return false;
    const input=(requested||element.dataset.language||'text').toLowerCase(),language=aliases[input]||input;
    if(!Object.prototype.hasOwnProperty.call(names,language))return false;
    element.dataset.language=language;
    const pre=element.tagName==='PRE'?element:element.parentElement?.tagName==='PRE'?element.parentElement:null;
    if(pre){pre.classList.add('syntax-block');pre.dataset.language=language;pre.dataset.languageLabel=element.dataset.languageLabel||names[language];}
    element.classList.add('syntax-code');
    if(['text','console','hexdump'].includes(language))return true;
    const source=element.textContent,parts=tokens(source,language),marks=options.preserveMarks===false?[]:marksIn(element),fragment=document.createDocumentFragment();
    let markIndex=0;
    marks.sort((a,b)=>a.start-b.start);
    for(const token of parts){
      const boundaries=[token.start,token.end];for(const mark of marks){if(mark.start>token.start&&mark.start<token.end)boundaries.push(mark.start);if(mark.end>token.start&&mark.end<token.end)boundaries.push(mark.end);}
      boundaries.sort((a,b)=>a-b);
      for(let k=0;k<boundaries.length-1;k++) {
        const start=boundaries[k],end=boundaries[k+1];if(start===end)continue;
        while(markIndex<marks.length&&marks[markIndex].end<=start)markIndex++;
        let node=document.createTextNode(source.slice(start,end));
        if(token.type){const span=document.createElement('span');span.className='syntax-'+token.type;span.append(node);node=span;}
        const mark=marks[markIndex];if(mark&&mark.start<=start&&mark.end>=end){const wrapper=document.createElement('mark');wrapper.className=mark.className;wrapper.append(node);node=wrapper;}
        fragment.append(node);
      }
    }
    element.replaceChildren(fragment);return true;
  }
  function highlightAll(root=document){
    const elements=[];if(root.nodeType===1&&root.matches('[data-language]'))elements.push(root);
    elements.push(...root.querySelectorAll('[data-language]'));
    for(const element of elements){if(element.tagName==='PRE'&&element.querySelector(':scope > code[data-language]'))continue;highlight(element,element.dataset.language);}
  }
  window.CourseSyntax={highlight,highlightAll};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>highlightAll(),{once:true});else highlightAll();
})();
