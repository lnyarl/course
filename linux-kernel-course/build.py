#!/usr/bin/env python3
"""Generate the complete, offline Linux 6.18 learning course from authored JSON."""
import html
import json
import subprocess
import sys
from pathlib import Path
R = Path(__file__).resolve().parent
E = html.escape
atlas = json.loads(subprocess.check_output(['node', str(R/'tools/export-atlas.cjs')], text=True))
if '--preview-atlas' not in sys.argv:
    assert sorted(map(int,atlas)) == list(range(1,29)), 'All 28 visual modules required'
    for key,a in atlas.items():
        assert len(a['figures']) == 4 and a['scene']['frameCount'] >= 6, (key, 'visual coverage')
        assert len(set(f['after'] for f in a['figures'])) >= 3, (key, 'spread figures through prose')

def figure_html(fig,index):
    return f'<figure class="atlas-figure" data-figure="{index}"><div class="atlas-head"><h3>{E(fig["title"])}</h3><button class="atlas-expand" type="button" aria-label="{E(fig["title"],quote=True)} 확대">확대 ↗</button></div><div class="atlas-canvas">{fig["svg"]}</div><figcaption>{E(fig["caption"])}<span class="scroll-hint">그림을 확대할 수 있습니다. 작은 화면에서는 좌우로 이동하세요.</span></figcaption></figure>'

def scene_html(scene):
    return '<section class="kernel-scene" id="visual-lab"><p class="eyebrow">WATCH THE STATE CHANGE</p><h2>'+E(scene['title'])+'</h2><p class="scene-intro">'+E(scene['intro'])+'</p><div class="scene-controls"></div><div class="scene-canvas">'+scene['initial']+'</div><p class="scene-scroll-hint">작은 화면에서는 그림을 좌우로 밀어 전체 경로를 볼 수 있습니다.</p><div class="scene-actions"></div><div class="scene-state" aria-live="polite"><h3>'+E(scene['first']['label'])+'</h3><p>'+E(scene['first']['note'])+'</p></div><div class="scene-stats"></div><div class="scene-observe"><h3>이렇게 비교해 보세요</h3><ol>'+''.join('<li>'+E(x)+'</li>' for x in scene['observe'])+'</ol></div><p class="scene-assumptions">'+E(scene['assumptions'])+'</p><noscript><p>현재는 첫 단계입니다. JavaScript를 켜면 재생과 시나리오 비교를 사용할 수 있습니다.</p></noscript></section>'
chapters = sorted((json.loads(p.read_text()) for p in (R/'content').glob('[0-9][0-9]-*.json')), key=lambda c:c['id'])
assert [c['id'] for c in chapters] == list(range(1,29)), 'All 28 authored chapters are required before building'
for c in chapters:
    for k in ('slug','part','title','subtitle','objectives','sections','flow','experiment','lab','quiz','takeaways','pitfalls','sources','source_paths'):
        assert c.get(k), (c['id'], k)
    assert len(c['sections'])>=6 and len(c['flow'])>=4 and len(c['quiz'])>=3 and len(c['sources'])>=2, c['id']
    assert all(len(s['body'])>=3 for s in c['sections']), c['id']
    assert sum(len(p) for s in c['sections'] for p in s['body']) >= 6000, (c['id'], 'explanation depth')
    assert all(0<=q['answer']<len(q['options']) for q in c['quiz']), c['id']
    assert c['slug'].startswith(f'{c["id"]:02d}-'), c['slug']
PARTS=['커널의 전체 지도','프로그램의 실행','인터럽트와 동시성','메모리 관리','파일·디스크·네트워크','격리·보안·확장','관측과 문제 해결']
def ul(xs): return '<ul>'+''.join('<li>'+E(s)+'</li>' for s in xs)+'</ul>'
def sidebar(current):
    out='<a class="brand" href="index.html"><span class="brand-mark">L / K</span>Linux Kernel<br><small>DEEP DIVE · 6.18 LTS</small></a><div class="side-tools"><button id="menu" aria-expanded="false" aria-controls="contents">목차 열기</button><button id="theme" aria-label="밝은 테마와 어두운 테마 전환">테마 전환</button></div><div id="contents"><label class="search-label" for="chapter-search">목차 검색</label><input id="chapter-search" type="search" placeholder="예: malloc, 스케줄러"><nav aria-label="전체 장 목차">'
    for part,title in enumerate(PARTS,1):
        out+=f'<div class="nav-group"><p>{part:02d} / {E(title)}</p><ol>'
        for c in chapters:
            if c['part']==part:
                out+=f'<li><a data-chapter="{c["id"]}" href="{c["slug"]}.html"'+(' aria-current="page"' if c['id']==current else '')+f'><span>{c["id"]:02d}</span>{E(c["title"])}</a></li>'
        out+='</ol></div>'
    out+='</nav><p id="search-empty" hidden>일치하는 장이 없습니다.</p><div class="side-extra"><a href="malloc-lab.html">특별 실험 · malloc의 내부</a><a href="lab-guide.html">실습 환경 · C 보충편</a><a href="references.html">참고 자료 · 버전 정책</a><a href="../index.html">← 전체 교재</a></div></div><div class="progress-label" id="progress-label">0 / 28장 완료</div><progress id="progress" max="28" value="0" aria-label="학습 진도"></progress>'
    return '<aside class="sidebar">'+out+'</aside>'
def wrap(title,body,current=0,data=None):
    payload='' if data is None else '<script type="application/json" id="chapter-data">'+json.dumps(data,ensure_ascii=False).replace('<','\\u003c')+'</script>'
    return '<!doctype html>\n<html lang="ko" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="description" content="Linux 6.18 LTS 커널을 28개 조작형 실험과 실행 흐름 애니메이션으로 배우는 한국어 교재"><title>'+E(title)+('' if title=='리눅스 커널' else ' · Linux Kernel Deep Dive')+'</title><link rel="stylesheet" href="assets/course.css"><link rel="stylesheet" href="../shared/course-design.css"><script src="../shared/course-design.js"></script><link rel="stylesheet" href="assets/atlas.css"></head><body data-id="'+str(current)+'"><a class="skip" href="#main">본문으로 이동</a>'+sidebar(current)+'<main id="main">'+body+'<footer>Linux 6.18 LTS · 도식은 개념 모델, 실측과 구분합니다.<br><a href="references.html">출처와 버전 기준</a> · <a href="../index.html">Course Library</a></footer></main>'+payload+'<script src="assets/models.js"></script><script src="assets/visuals.js"></script><script src="assets/course.js"></script><script src="assets/drawing.js"></script><script src="assets/atlas-execution.js"></script><script src="assets/atlas-memory.js"></script><script src="assets/atlas-io.js"></script><script src="assets/atlas-ui.js"></script><script src="assets/malloc.js"></script><script defer src="../shared/course-comments.js" data-root="main" data-layout="overlay"></script></body></html>\n'
def hero(eyebrow,title,lead):return f'<header class="hero"><p class="eyebrow">{E(eyebrow)}</p><h1>{E(title)}</h1><p class="lead">{E(lead)}</p></header>'
for n,c in enumerate(chapters):
    visual = atlas.get(str(c['id']))
    if visual:
        assert all(1<=f['after']<=len(c['sections']) for f in visual['figures']), c['id']
        assert 1<=visual['scene']['after']<=len(c['sections']), c['id']
    body=hero(f'PART {c["part"]:02d} / CHAPTER {c["id"]:02d}',c['title'],c['subtitle'])
    body+='<div class="chapter-meta"><span class="badge">Linux 6.18 LTS</span><span>개념 → 흐름 → 실험 → 관측</span></div><section class="objectives"><h2>이 장을 마치면</h2>'+ul(c['objectives'])+'</section>'
    body+='<nav class="on-page" aria-label="이 장 바로가기"><a href="#visual-lab">동작 시뮬레이터</a><a href="#experiment">조작 실험</a><a href="#concepts">원리 이해</a><a href="#lab">Linux 실습</a><a href="#quiz">확인 문제</a><a href="#sources">근거</a></nav>'
    body+='<details class="reading"><summary>이 장의 설명 '+str(len(c['sections']))+'개 절</summary><ol>'+''.join(f'<li><a href="#concept-{i}">{E(sec["title"])}</a></li>' for i,sec in enumerate(c['sections'],1))+'</ol></details>'
    flow_html='<section class="panel flow-panel" id="flow"><p class="eyebrow">FOLLOW THE EXECUTION</p><h2>실행 흐름을 따라가세요</h2><p>각 단계를 누르거나 재생 버튼으로 현재 주체와 상태 변화를 살펴보세요. 단계 간 시간은 실제 실행 시간을 뜻하지 않습니다.</p><div class="flow-track">'
    for i,f in enumerate(c['flow']):flow_html+=f'<button class="flow-node" data-step="{i}" aria-pressed="{str(i==0).lower()}"><span>{i+1:02d}</span><strong>{E(f["label"])}</strong><span class="flow-arrow" aria-hidden="true">→</span></button>'
    flow_html+='</div><div class="flow-detail" aria-live="polite"><span id="step-number">01</span><div><h3 id="step-title">'+E(c['flow'][0]['label'])+'</h3><p id="step-detail">'+E(c['flow'][0]['detail'])+'</p></div></div><div class="button-row"><button id="flow-prev">← 이전 단계</button><button class="primary" id="flow-play" aria-pressed="false">자동 재생</button><button id="flow-next">다음 단계 →</button><button id="flow-reset">처음으로</button></div><p class="caption">동작 줄이기 설정에서는 단계 이동을 권장합니다. 자동 재생은 직접 시작할 때만 동작합니다.</p></section>'
    experiment_html='<section class="panel experiment" id="experiment"><p class="eyebrow">CHANGE ONE THING</p><h2>'+E(c['experiment']['title'])+'</h2><p>'+E(c['experiment']['description'])+'</p><div id="experiment-ui"><p>JavaScript를 켜면 조건을 바꾸며 실험할 수 있습니다. 아래 본문과 실습은 그대로 읽을 수 있습니다.</p></div></section>'
    body+='<div id="concepts">'
    for i,s in enumerate(c['sections'],1):
        body+=f'<section class="prose" id="concept-{i}"><div class="section-number">{i:02d}</div><h2>{E(s["title"])}</h2>'
        for paragraph_index,paragraph in enumerate(s['body']):
            body+='<p>'+E(paragraph)+'</p>'
            if paragraph_index==0 and visual:
                for fig_index,fig in enumerate(visual['figures']):
                    if fig['after']==i: body+=figure_html(fig,fig_index)

        if s.get('code'): body+='<pre><code>'+E(s['code'])+'</code></pre>'
        if s.get('table'):
            t=s['table'];body+='<div class="table-wrap"><table><thead><tr>'+''.join('<th scope="col">'+E(x)+'</th>' for x in t['headers'])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+E(str(x))+'</td>' for x in row)+'</tr>' for row in t['rows'])+'</tbody></table></div>'
        body+='</section>'
        if visual and visual['scene']['after']==i: body+=scene_html(visual['scene'])
        if i==4: body+=experiment_html
    body+='</div><details class="reading legacy-flow"><summary>실행 순서 요약 다시 보기</summary>'+flow_html+'</details>'
    if c['id'] in (13,14,16): body+='<a class="feature-link" href="malloc-lab.html"><span>특별 실험실</span><strong>malloc은 실제로 무엇을 하나요? →</strong><p>청크를 할당·해제하며 분할, 병합, 단편화, RSS가 바로 줄지 않는 이유를 확인합니다.</p></a>'
    lab=c['lab'];body+='<section class="lab" id="lab"><p class="eyebrow">OBSERVE ON LINUX</p><h2>실제 환경에서 확인하기</h2><p>'+E(lab['intro'])+'</p><p class="notice">'+E(lab['caution'])+'</p><p><a href="lab-guide.html">환경 준비와 명령 실행 전제</a> · 아래는 제공 실습이며 이 교재 제작 환경에서 Linux 실행 결과를 검증하지 않았습니다.</p><div class="code-head"><span>Linux VM / Shell · C</span><button class="copy-code">명령 복사</button></div><pre><code>'+E(lab['code'])+'</code></pre><h3>예상 관측과 해석</h3><p>'+E(lab['expected'])+'</p></section>'
    body+='<section class="pitfalls"><h2>혼동하기 쉬운 점</h2>'+ul(c['pitfalls'])+'</section><section id="quiz"><p class="eyebrow">CHECK YOUR REASONING</p><h2>관측 결과를 설명해 보세요</h2>'
    for i,q in enumerate(c['quiz']):
        body+=f'<fieldset class="quiz" data-quiz="{i}"><legend>{i+1}. {E(q["q"])}</legend>'
        for j,opt in enumerate(q['options']):body+=f'<label><input type="radio" name="q{i}" value="{j}"><span>{E(opt)}</span></label>'
        body+='<button class="check-answer">답 확인</button><p class="quiz-feedback" aria-live="polite"></p></fieldset>'
    body+='</section><section class="takeaways"><h2>핵심 연결</h2>'+ul(c['takeaways'])+'</section><section id="sources"><h2>문서에서 소스까지</h2><p>내부 구현은 v6.18 태그 기준으로 읽습니다. 배포판 패치와 설정에 따라 실행 결과가 달라질 수 있습니다.</p><ul class="source-list">'
    for s in c['sources']:body+=f'<li><a href="{E(s["url"],quote=True)}">{E(s["title"])}</a></li>'
    body+='</ul><div class="source-paths">'
    for s in c['source_paths']:body+=f'<a href="https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/{E(s["path"],quote=True)}?h=v6.18"><code>{E(s["path"])}</code><span>{E(s["note"])}</span></a>'
    body+='</div></section><div class="completion"><button id="mark-done" class="primary" aria-pressed="false">이 장 학습 완료</button><span id="saved-note" role="status">진도는 이 브라우저에 저장됩니다.</span></div><nav class="pager" aria-label="앞뒤 장">'
    body+=f'<a href="{chapters[n-1]["slug"]+".html" if n else "index.html"}">← {E(chapters[n-1]["title"]) if n else "과정 소개"}</a>'
    body+=f'<a href="{chapters[n+1]["slug"]+".html" if n<len(chapters)-1 else "index.html"}">{E(chapters[n+1]["title"]) if n<len(chapters)-1 else "전체 과정으로"} →</a></nav>'
    (R/(c['slug']+'.html')).write_text(wrap(c['title'],body,c['id'],c))

index=hero('A FIELD GUIDE TO THE OPERATING SYSTEM','리눅스 커널','명령 하나가 실행되는 순간부터 메모리가 회수되고 패킷이 도착할 때까지. 경계·상태·대기를 직접 조작하며 커널의 전체 구조를 연결합니다.')
index+='<div class="hero-stats"><div><strong>28</strong><span>장과 조작 실험</span></div><div><strong>7</strong><span>학습 단계</span></div><div><strong>6.18</strong><span>LTS 기준</span></div></div><div class="hero-map" aria-label="프로그램에서 커널을 거쳐 하드웨어로 이어지는 구조"><div>사용자 프로그램 <small>libc · 런타임 · 서버</small></div><span>시스템 콜 ↓ &nbsp; ↑ 결과·시그널</span><div class="kernel-box"><strong>LINUX KERNEL</strong><div class="kernel-grid"><span>스케줄러</span><span>메모리</span><span>VFS · I/O</span><span>네트워크</span><span>보안 · 격리</span><span>드라이버</span></div></div><span>장치 명령 ↓ &nbsp; ↑ 인터럽트</span><div>CPU · RAM · 저장장치 · NIC</div></div>'
index+=f'<div class="button-row"><a class="button primary" href="{chapters[0]["slug"]}.html">01장부터 시작 →</a><a class="button" href="malloc-lab.html">malloc 실험실</a><a class="button" href="lab-guide.html">실습 환경 준비</a></div><section class="intro-grid"><div><h2>무엇을 배우나요?</h2><p>기능 이름을 외우는 대신 실행 주체, 공유 자원, 대기 조건을 추적합니다. 마지막에는 느린 서버의 관측 증거를 보고 다음 조사 지점을 고릅니다.</p></div><div><h2>어떻게 읽나요?</h2><p>도식의 다음 단계를 예측하고 입력 조건을 바꿔 보세요. 설명을 읽은 뒤 Linux VM에서 관측합니다. 장당 45–90분은 읽기·개념 실험의 계획치이며, 소스 탐색과 실제 실습은 별도입니다.</p></div></section>'
index+='<section class="notice"><h2>움직이는 구조로 먼저 살펴보기</h2><p>부모·자식의 페이지 공유, malloc 뒤의 첫 접근, 패킷 수신 경로를 단계별로 따라가세요. 각 장의 본문 도식은 확대할 수 있고, 시뮬레이터는 조건을 바꿔 결과를 비교할 수 있습니다.</p><div class="visual-intro"><a href="06-fork-exec-exit.html#visual-lab">fork와 COW</a><a href="13-address-space.html#visual-lab">malloc과 물리 페이지</a><a href="20-network-path.html#visual-lab">패킷 수신 경로</a></div></section>'
index+='<section class="notice"><h2>현대 커널 기준</h2><p>Linux 6.18 LTS 계열과 v6.18 소스를 기준으로 구성했습니다. EEVDF, folio, MGLRU, cgroups v2, blk-mq, io_uring, eBPF를 포함합니다. 기능의 존재와 배포판의 기본 활성화는 구분합니다. 메모리 도식은 별도 표시가 없으면 4 KiB 페이지를 가정한 교육 모델입니다.</p><p>책은 원리와 학습 순서의 참고 자료입니다. 오래된 구현을 현재 기본값으로 설명하지 않습니다. <a href="references.html">자료와 버전 정책 →</a></p></section><section><h2>전체 커리큘럼</h2><p>완료한 장에는 표시가 남습니다. 목차 검색으로 개념을 다시 찾을 수 있습니다.</p>'
for part,title in enumerate(PARTS,1):
    index+=f'<div class="part-heading"><span>{part:02d}</span><h3>{E(title)}</h3></div><div class="chapter-grid">'
    for c in chapters:
        if c['part']==part:index+=f'<a class="chapter-card" href="{c["slug"]}.html" data-card-id="{c["id"]}"><span class="card-number">{c["id"]:02d}<span class="done-label"></span></span><h4>{E(c["title"])}</h4><p>{E(c["subtitle"])}</p><span class="card-foot">본문 도식 · 동작 시뮬레이터 · 확인 문제 ↗</span></a>'
    index+='</div>'
index+='</section><section><h2>함께 읽기</h2><div class="related"><a href="../windows-kernel-course/">Windows Kernel Deep Dive</a><a href="../os-memory-course/">현대 운영체제 메모리 관리</a><a href="../tcpip-course/">TCP/IP</a><a href="../container-runtime-course/">컨테이너 런타임 만들기</a></div></section>'
(R/'index.html').write_text(wrap('리눅스 커널',index))
for name in ('lab-guide','references','malloc-lab'):
    (R/(name+'.html')).write_text(wrap({'lab-guide':'실습 환경과 C 보충편','references':'참고 자료와 버전 기준','malloc-lab':'malloc은 무엇을 하는가'}[name],(R/'content'/(name+'.html')).read_text()))
(R/'manifest.json').write_text(json.dumps([{'id':c['id'],'slug':c['slug'],'title':c['title']} for c in chapters],ensure_ascii=False,indent=2)+'\n')
print(f'Built {len(chapters)} chapters + index and 3 guides')
