/* Chapter 05: bounded SQL subset; Rust/JS parity is checked against examples/ch05/sql.rs. */
(function () {
  const utf8=new TextEncoder(),decoder=new TextDecoder(),$=id=>document.getElementById(id);
  const reserved='create table int text not null insert into values select from where and or is order by asc desc limit join on as update delete drop primary key true false'.split(' ');
  function fail(pos,message){const e=new Error(message);e.pos=pos;throw e;}
  const letter=b=>b>=65&&b<=90||b>=97&&b<=122,digit=b=>b>=48&&b<=57;
  function lex(sql){
    const b=utf8.encode(sql),tokens=[];let i=0;
    if(b.length>16384)fail(16384,'SQL exceeds 16384 UTF-8 bytes');
    while(i<b.length){
      if([9,10,12,13,32].includes(b[i])){i++;continue;}
      if(b[i]===45&&b[i+1]===45){while(i<b.length&&b[i]!==10)i++;continue;}
      const start=i;let kind,value;
      if(letter(b[i])||b[i]===95){i++;while(i<b.length&&(letter(b[i])||digit(b[i])||b[i]===95))i++;kind='word';value=decoder.decode(b.slice(start,i)).toLowerCase();}
      else if(digit(b[i])||(b[i]===45&&digit(b[i+1]))){
        i++;while(i<b.length&&digit(b[i]))i++;const n=BigInt(decoder.decode(b.slice(start,i)));
        if(n<-(1n<<63n)||n>(1n<<63n)-1n)fail(start,'integer is outside i64');kind='int';value=n.toString();
      }else if(b[i]===39){
        i++;let segment=i,closed=false,text='';
        while(i<b.length){if(b[i]===39){text+=decoder.decode(b.slice(segment,i));if(b[i+1]===39){text+="'";i+=2;segment=i;continue;}i++;closed=true;break;}i++;}
        if(!closed)fail(start,'unterminated string');kind='text';value=text;
      }else{
        const two=decoder.decode(b.slice(i,i+2)),one=String.fromCharCode(b[i]);
        if(['<=','>=','<>','!='].includes(two)){i+=2;kind='symbol';value=two;}
        else if('(),;*=<>'.includes(one)){i++;kind='symbol';value=one;}
        else fail(start,'unsupported character');
      }
      tokens.push({kind,value,start,end:i});if(tokens.length>1024)fail(start,'more than 1024 tokens');
    }
    tokens.push({kind:'eof',value:null,start:i,end:i});return tokens;
  }
  class Parser{
    constructor(tokens,events=[]){this.tokens=tokens;this.at=0;this.nodes=0;this.events=events;this.stack=[];this.latest=null;}
    current(){return this.tokens[this.at];}
    emit(label){this.events.push({label,stack:[...this.stack],at:this.at,tree:this.latest?JSON.parse(JSON.stringify(this.latest)):null});}
    within(rule,fn){this.stack.push(rule);this.emit(rule+' 진입');try{return fn();}finally{this.stack.pop();this.emit(rule+' 반환');}}
    error(message){const e=new Error(message);e.pos=this.current().start;e.stackFrames=[...this.stack];throw e;}
    consume(){const t=this.current();this.at++;this.emit('소비: '+(t.value===null?'EOF':String(t.value)));return t;}
    word(s){if(this.current().kind==='word'&&this.current().value===s){this.consume();return true;}return false;}
    sym(s){if(this.current().kind==='symbol'&&this.current().value===s){this.consume();return true;}return false;}
    expectWord(s){if(!this.word(s))this.error('expected '+s);}
    expectSym(s){if(!this.sym(s))this.error('expected '+s);}
    name(){const t=this.current();if(t.kind==='word'&&t.value.length<=32&&/^[a-z]/.test(t.value)&&!reserved.includes(t.value))return this.consume().value;this.error('expected identifier (letter first, at most 32 bytes; no reserved word)');}
    names(){const out=[this.name()];while(this.sym(','))out.push(this.name());return out;}
    literal(){const t=this.current();if(t.kind==='int'||t.kind==='text'){this.consume();return {type:t.kind,value:t.value};}if(this.word('null'))return {type:'null'};this.error('expected integer, string or NULL');}
    operand(){const t=this.current();return t.kind==='int'||t.kind==='text'||t.kind==='word'&&t.value==='null'?this.literal():{type:'column',name:this.name()};}
    node(e){this.nodes++;if(this.nodes>128)this.error('more than 128 expression nodes');this.latest=e;this.emit('AST 생성: '+e.type);return e;}
    expr(depth){return this.within('OR',()=>{let e=this.and(depth);while(this.word('or'))e=this.node({type:'or',left:e,right:this.and(depth)});return e;});}
    and(depth){return this.within('AND',()=>{let e=this.not(depth);while(this.word('and'))e=this.node({type:'and',left:e,right:this.not(depth)});return e;});}
    not(depth){return this.within('NOT / 조건',()=>{
      if(depth>32)this.error('expression nesting exceeds 32');
      if(this.word('not'))return this.node({type:'not',value:this.not(depth+1)});
      if(this.sym('(')){const e=this.expr(depth+1);this.expectSym(')');return e;}
      const left=this.operand();if(this.word('is')){const negated=this.word('not');this.expectWord('null');return this.node({type:'is_null',negated,value:left});}
      const t=this.current();if(t.kind!=='symbol'||!['=','!=','<>','<','<=','>','>='].includes(t.value))this.error('expected comparison or IS [NOT] NULL');
      this.consume();return this.node({type:'compare',op:t.value==='<>'?'!=':t.value,left,right:this.operand()});
    });}
    statement(){return this.within('statement',()=>{
      let ast;
      if(this.word('create'))ast=this.within('CREATE TABLE',()=>{
        this.expectWord('table');const table=this.name();this.expectSym('(');const columns=[];
        do{const name=this.name();let data_type;if(this.word('int'))data_type='int';else if(this.word('text'))data_type='text';else this.error('expected INT or TEXT');let nullable=true;if(this.word('not')){this.expectWord('null');nullable=false;}columns.push({name,data_type,nullable});}while(this.sym(','));
        this.expectSym(')');return {type:'create',table,columns};
      });
      else if(this.word('insert'))ast=this.within('INSERT',()=>{
        this.expectWord('into');const table=this.name();let columns=null;if(this.sym('(')){columns=this.names();this.expectSym(')');}
        this.expectWord('values');this.expectSym('(');const values=[this.literal()];while(this.sym(','))values.push(this.literal());this.expectSym(')');return {type:'insert',table,columns,values};
      });
      else if(this.word('select'))ast=this.within('SELECT',()=>{
        const columns=this.sym('*')?null:this.names();this.expectWord('from');const table=this.name(),filter=this.word('where')?this.expr(0):null,order=[];
        if(this.word('order')){this.expectWord('by');do{const column=this.name();let descending=false;if(this.word('desc'))descending=true;else this.word('asc');order.push({column,descending});}while(this.sym(','));}
        let limit=null;if(this.word('limit')){const t=this.current();if(t.kind!=='int'||BigInt(t.value)<0n)this.error('expected nonnegative LIMIT');limit=this.consume().value;}
        return {type:'select',table,columns,filter,order,limit};
      });
      else this.error('expected CREATE, INSERT or SELECT');
      this.sym(';');if(this.current().kind!=='eof')this.error('expected end of input (one statement only)');
      this.latest=ast;this.emit('문장 AST 완성: EOF 확인');return ast;
    });}
  }
  const parse=sql=>new Parser(lex(sql)).statement();
  window.SQLLesson={lex,parse};
  // Other chapters reuse the parser API without mounting Chapter 05 controls.
  if (!$("sql-input")) return;
  const viewers = new WeakMap();
  function drawTree(svg, node) {
    let viewer = viewers.get(svg);
    if (!viewer) { viewer = new ASTViewer(svg); viewers.set(svg, viewer); }
    viewer.setNode(node);
  }
  let tokenPlayer=null,parserPlayer=null;
  function resetPlayers(){tokenPlayer?.destroy();parserPlayer?.destroy();tokenPlayer=parserPlayer=null;}
  function sourceView(sql,start,end){
    const b=utf8.encode(sql);$('source-view').replaceChildren();
    $('source-view').append(document.createTextNode(decoder.decode(b.slice(0,start))));const mark=document.createElement('mark');mark.textContent=start===end?'▏':decoder.decode(b.slice(start,end));$('source-view').append(mark,document.createTextNode(decoder.decode(b.slice(end))));if(window.CourseSyntax)CourseSyntax.highlight($('source-view'),'sql');
  }
  function analyze(){
    resetPlayers();$('parser-finish').disabled=true;$('parser-finish').onclick=null;$('parser-cursor').textContent='';const sql=$('sql-input').value;let tokens,ast=null,error=null;const events=[];
    $('analysis-status').textContent='';$('ast-json').textContent='';$('token-list').replaceChildren();
    try{tokens=lex(sql);}catch(e){error=e;$('analysis-status').textContent=`ERROR byte=${e.pos}: ${e.message}`;sourceView(sql,e.pos,e.pos);$('token-state').textContent='토큰화 중단';$('parser-state').textContent='토큰화 오류로 파서를 시작하지 않습니다.';$('rule-stack').replaceChildren();drawTree($('ast-svg'),null);return;}
    tokens.forEach((t,i)=>{const button=document.createElement('button');button.type='button';button.className='token';button.dataset.step=i;button.textContent=`${t.kind}: ${t.value===null?'EOF':String(t.value).slice(0,24)}`;button.onclick=()=>tokenPlayer?.go(i);$('token-list').append(button);});
    tokenPlayer=MM.stepper($('token-player'),{steps:tokens.length,interval:850,render(i){
      const t=tokens[i];sourceView(sql,t.start,t.end);$('token-list').querySelectorAll('.token').forEach((e,k)=>{e.classList.toggle('current',k===i);e.setAttribute('aria-current',k===i?'step':'false');});
      $('token-state').textContent=`토큰 ${i+1}: ${t.kind}, UTF-8 byte [${t.start}, ${t.end})`;
      return t.kind==='eof'?'EOF: 문장 뒤에 남은 입력이 있는지 검사할 끝 표시입니다.':`원문 ${t.end-t.start}바이트를 ${MM.esc(t.kind)} 토큰으로 읽었습니다. 해석한 값: <code>${MM.esc(String(t.value))}</code>`;
    }});
    const parser=new Parser(tokens,events);
    try{ast=parser.statement();$('ast-json').textContent=JSON.stringify(ast,null,2);if(window.CourseSyntax)CourseSyntax.highlight($('ast-json'),'json');$('analysis-status').textContent=`파싱 성공 · 토큰 ${tokens.length-1}개 + EOF · 추적 ${events.length}단계. 실행은 하지 않습니다.`;}
    catch(e){error=e;events.push({label:`ERROR byte=${e.pos}: ${e.message}`,stack:e.stackFrames||[],at:parser.at,tree:parser.latest});$('analysis-status').textContent=events.at(-1).label;$('ast-json').textContent='구문 오류로 완성된 AST가 없습니다.';}
    parserPlayer=MM.stepper($('parser-player'),{steps:events.length,interval:650,render(i){
      const e=events[i],t=tokens[Math.min(e.at,tokens.length-1)];$('parser-state').textContent=e.label;
      $('rule-stack').replaceChildren(...e.stack.map(s=>{const span=document.createElement('span');span.className='rule-frame';span.textContent=s;return span;}));
      $('parser-cursor').textContent=`다음 토큰: ${t.kind} ${t.value??'EOF'} · byte ${t.start}`;drawTree($('ast-svg'),e.tree);
      return `${MM.esc(e.label)}<br>위의 스택은 현재 문법 함수, 도식은 이 시점에 완성한 마지막 부분 트리입니다.`;
    }});
    $('parser-finish').disabled=false;$('parser-finish').onclick=()=>{parserPlayer.go(events.length-1);if(error)tokenPlayer.go(Math.min(parser.at,tokens.length-1));};
    if(error)$('parser-finish').textContent='오류 단계 보기';else $('parser-finish').textContent='완성 AST 보기';
  }
  $('analyze-sql').onclick=analyze;
  $('sql-input').oninput=()=>{
    resetPlayers();
    $('analysis-status').textContent='입력이 바뀌었습니다. 분석을 눌러 새 과정을 만드세요.';
    $('parser-finish').disabled=true;$('parser-finish').onclick=null;
    $('token-list').replaceChildren();$('source-view').textContent=$('sql-input').value;
    $('token-state').textContent='미분석 입력';$('parser-state').textContent='분석 전';
    $('parser-cursor').textContent='';$('rule-stack').replaceChildren();$('ast-json').textContent='';
    drawTree($('ast-svg'),null);
  };
  const samples={select:"SELECT name FROM people WHERE age >= 20 OR id = 1 AND name IS NOT NULL ORDER BY id LIMIT 5;",insert:"INSERT INTO people (id, name, age) VALUES (1, 'O''Reilly 한글', NULL);",create:"CREATE TABLE people (id INT NOT NULL, name TEXT, age INT);",error:"SELECT name FROM people WHERE age >= ;"};
  $('sql-sample').onchange=()=>{$('sql-input').value=samples[$('sql-sample').value];analyze();};
  let predictionAst;
  function precedence(){
    const grouped=$('group-first').checked,sql='SELECT * FROM t WHERE '+(grouped?'(a=1 OR b=2) AND c=3':'a=1 OR b=2 AND c=3');predictionAst=parse(sql).filter;
    $('precedence-sql').textContent=sql;if(window.CourseSyntax)CourseSyntax.highlight($('precedence-sql'),'sql');drawTree($('precedence-svg'),predictionAst);
    const a=$('truth-a').checked,b=$('truth-b').checked,c=$('truth-c').checked,result=grouped?(a||b)&&c:a||b&&c;
    $('truth-result').textContent=`조건 결과 A=${a}, B=${b}, C=${c} → 전체=${result}. 이 실습은 세 조건의 참/거짓 결합만 계산합니다.`;$('prediction-result').textContent='루트 연산자를 예측하고 확인하세요.';
  }
  for(const id of ['group-first','truth-a','truth-b','truth-c'])$(id).onchange=precedence;
  $('check-root').onclick=()=>{$('prediction-result').textContent=predictionAst.type===$('root-guess').value?'정답: 루트는 '+predictionAst.type.toUpperCase()+'입니다.':'다시 확인하세요. 루트는 '+predictionAst.type.toUpperCase()+'입니다.';};
  analyze();precedence();
})();
