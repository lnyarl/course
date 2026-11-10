#!/usr/bin/env python3
"""Build offline static network textbook from authored chapter JSON."""
import html
import json
import re
from pathlib import Path
from visuals import render_visuals

ROOT = Path(__file__).resolve().parent
chapters = []
for name in ('part-intro.json', 'part-a.json', 'part-b.json'):
    p = ROOT / 'content' / name
    if p.exists():
        chapters.extend(json.loads(p.read_text()))
chapters.sort(key=lambda c: c['id'])
E = html.escape
TITLE = '웹 네트워크 해부'
LAB_TITLES = {'01':'요청 한 건을 끝까지 따라가기','02':'DNS 위임을 단계별로 따라가기','03':'주소 변경과 TTL 만료 실험','04':'HTTP 메시지와 재시도 결과 해부','05':'fresh · 304 · 새 본문 비교','06':'CORS는 어디에서 차단할까?','07':'TLS 1.3 핸드셰이크','08':'다중화와 손실 비교','09':'로드밸런서 분배 실험','10':'주소 변환 · 정책 · 암호화 구분','11':'요청 waterfall 만들기','12':'증거로 좁히는 장애 조사'}
# Content contracts prevent generating prose-only or incomplete chapters.
assert [c['id'] for c in chapters] == [f'{n:02d}' for n in range(1,13)], 'Expected all twelve chapter sources'
for c in chapters:
    assert all(c.get('case',{}).get(k) for k in ('question','scenario','predict','answer')), c['id']+' needs a worked case'
    assert c.get('experiment',{}).get('steps'), c['id']+' needs experiment instructions'
    assert sum(s['html'].count('<table') for s in c['sections']) >= 3, c['id']+' needs comparisons in context'


def sidebar(current):
    links=''.join(f'<li><a href="{c["slug"]}.html" data-chapter-link="{c["id"]}"'+(' aria-current="page"' if current==c['id'] else '')+f'><span class="num">{c["id"]}</span><span>{E(c["title"])}</span></a></li>' for c in chapters)
    return f'<aside class="sidebar"><a class="brand" href="index.html">웹 네트워크<br>해부 실험실</a><small>DNS → HTTP → 보안 → 운영</small><div class="side-actions"><button id="menu" class="mobile-menu" type="button" aria-expanded="false" aria-controls="chapter-list">목차 열기</button><button id="theme" type="button">테마 전환</button></div><nav aria-label="장별 목차"><ol id="chapter-list">{links}</ol></nav><div data-progress>0 / 12장 완료</div><div class="progress" aria-hidden="true"><span data-progress-bar style="width:0"></span></div><a href="../index.html">전체 교재 목록 ↗</a></aside>'


def wrap(title,body,current=''):
    return f'<!doctype html>\n<html lang="ko" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="DNS, HTTP, TLS, 프록시와 장애 분석을 도식과 실험으로 배우는 한국어 네트워크 교재"><title>{E(title)} · {TITLE}</title><link rel="stylesheet" href="assets/course.css"><link rel="stylesheet" href="../shared/course-design.css"><script src="../shared/course-design.js"></script></head><body data-chapter="{current}"><a class="skip" href="#main">본문으로 이동</a><div class="shell">{sidebar(current)}<main id="main" class="content">{body}</main></div><script src="assets/teaching-ui.js"></script><script src="assets/course.js"></script><script defer src="../shared/course-comments.js"></script></body></html>\n'

VISUAL_AFTER={'01':2,'02':3,'03':2,'04':1,'05':3,'06':5,'07':2,'08':5,'09':2,'10':2,'11':2,'12':2}
EXPERIMENT_AFTER={'01':6,'02':4,'03':2,'04':4,'05':4,'06':6,'07':4,'08':5,'09':3,'10':5,'11':4,'12':7}

for i,c in enumerate(chapters):
    case,experiment=c['case'],c['experiment']
    secnav=''.join(f'<a href="#s{j}">{E(section["title"])}</a>' for j,section in enumerate(c['sections'],1))
    text=f'<header class="hero"><div class="eyebrow">FIELD GUIDE / CHAPTER {c["id"]}</div><h1>{E(c["title"])}</h1><p class="lead">{E(c["lead"])}</p><div class="meta"><span class="pill">첫 읽기 + 핵심 실험 약 {c.get("minutes",90)}분</span><span>질문 → 역할 → 흐름 → 조건별 결과 → 직접 확인</span></div></header>'
    text+=f'<section class="case-study" id="case"><div class="eyebrow">이 장에서 풀 문제</div><h2>{E(case["question"])}</h2><p>{E(case["scenario"])}</p><div class="prediction"><strong>먼저 예측해 보기</strong><p>{E(case["predict"])}</p></div></section>'
    text+=f'<nav class="section-nav" aria-label="이 장의 절"><a href="#case">사례와 질문</a><a href="#concept-map">흐름과 관계</a><a href="#experiment">직접 확인</a>{secnav}<a href="#practice">실제 실습</a><a href="#quiz">확인 문제</a></nav>'
    for j,section in enumerate(c['sections'],1):
        text+=f'<section class="section" id="s{j}"><h2>{j:02d}. {E(section["title"])}</h2>{section["html"]}</section>'
        if j==VISUAL_AFTER[c['id']]:
            text+=f'<section class="concept-maps" id="concept-map" aria-label="이 장의 흐름과 관계">{render_visuals(c["id"])}</section>'
        if j==EXPERIMENT_AFTER[c['id']]:
            actions=''.join(f'<li>{E(step)}</li>' for step in experiment['steps'])
            text+=f'<section class="lab" id="experiment" aria-labelledby="simulation-title"><div class="eyebrow">예측한 내용을 직접 확인</div><h2 id="simulation-title">{LAB_TITLES[c["id"]]}</h2><div class="prediction"><strong>조작 전 질문</strong><p>{E(experiment["predict"])}</p></div><ol class="experiment-steps">{actions}</ol><div id="simulation"><p>자바스크립트를 켜면 실험을 조작할 수 있습니다. 아래 본문·도식·실습은 그대로 읽을 수 있습니다.</p></div><details class="experiment-reading"><summary>관찰한 결과를 해석하기</summary><p>{E(experiment["interpretation"])}</p></details></section>'
    text+=f'<section class="case-answer"><h2>처음 질문에 답해 보기</h2><p>{E(case["question"])}</p><details><summary>설명과 비교하기</summary><p>{E(case["answer"])}</p></details></section>'
    text+=f'<section class="section" id="practice"><div class="eyebrow">HANDS ON</div><h2>{E(c["lab"]["title"])}</h2>{c["lab"]["html"]}<p class="footnote">로컬 실습 서버 실행과 공통 명령은 <a href="lab-guide.html">실습 안내</a>에서 확인하세요. 실제 HTTPS·HTTP/2·HTTP/3 서버를 제공하는 실습은 아닙니다.</p></section>'
    text+='<section class="section" id="quiz"><div class="eyebrow">CHECK YOUR UNDERSTANDING</div><h2>이해도 확인</h2><p>선택 후 이유를 설명하고 정답을 확인하세요.</p>'
    for j,q in enumerate(c['questions']):
        opts=''.join(f'<label class="quiz-option"><input type="radio" name="q{j}" value="{k}"><span>{E(o)}</span></label>' for k,o in enumerate(q['options']))
        text+=f'<div class="quiz-item" data-answer="{q["answer"]}" data-explain="{E(q["explain"],quote=True)}"><fieldset><legend>{j+1}. {E(q["q"])}</legend>{opts}</fieldset><button type="button" data-check-quiz>정답과 해설</button><div class="feedback" aria-live="polite" hidden></div><noscript><details><summary>해설</summary><p>정답: {E(q["options"][q["answer"]])}. {E(q["explain"])}</p></details></noscript></div>'
    text+='</section><section class="section"><h2>원전과 더 읽을 자료</h2><ul class="source-list">'+''.join(f'<li><a href="{E(s["url"],quote=True)}" target="_blank" rel="noopener">{E(s["title"])}</a></li>' for s in c['sources'])+'</ul><p class="footnote">표준과 공식 문서를 참고해 독립적으로 구성한 학습 설명입니다. 예시 결과와 시간은 명시한 경우를 제외하면 교육용입니다. 확인 기준: 2026-11-09.</p></section>'
    prev=f'<a href="{chapters[i-1]["slug"]}.html">← 이전 장</a>' if i else '<a href="index.html">← 학습 지도</a>'
    nxt=f'<a href="{chapters[i+1]["slug"]}.html">다음 장 →</a>' if i+1<len(chapters) else '<a href="index.html">학습 지도 →</a>'
    text+=f'<div class="pager">{prev}<button id="complete" type="button" aria-pressed="false">이 장 학습 완료</button>{nxt}</div><p id="save-status" class="footnote" aria-live="polite">진행률은 현재 브라우저에 저장됩니다. 파일 직접 열기와 HTTP 접속은 저장 공간이 다를 수 있습니다.</p>'
    (ROOT/(c['slug']+'.html')).write_text(wrap(c['title'],text,c['id']))

cards=''.join(f'<a class="course-card" href="{c["slug"]}.html"><div class="eyebrow">CHAPTER {c["id"]} / {c.get("minutes",90)} MIN</div><h3>{E(c["title"])}</h3><p>{E(c["case"]["question"])}</p></a>' for c in chapters)
index=f'''<header class="hero"><div class="eyebrow">THE WEB NETWORK FIELD GUIDE</div><h1>요청이 움직이는 과정,<br>직접 바꾸며 이해하기.</h1><p class="lead">이름이 주소가 되고, 안전한 연결 위로 메시지가 오가고, 여러 서버가 응답을 만드는 과정. DNS · HTTP · TLS · 프록시 · 장애 분석을 하나의 요청으로 연결합니다.</p><div class="meta"><span class="pill">12장 · 12개 실험 · 48개 확인 문제</span><span>한국어 상세 교재 · 설치 없는 정적 페이지</span></div></header><figure class="illustration"><picture><source media="(max-width:600px)" srcset="assets/overview-mobile.svg"><img src="assets/overview.svg" style="width:100%;height:auto;display:block" alt="브라우저의 DNS 조회 경로와 프록시·앱 서버 사이의 별도 연결"></picture><figcaption>DNS는 주소를 조회하는 별도 경로. 프록시는 클라이언트 연결과 업스트림 연결을 각각 관리합니다.</figcaption></figure><section class="section"><h2>TCP/IP 다음에 배울 것들</h2><p>TCP/IP 심화는 <a href="../tcpip-course/index.html">기존 TCP/IP 전문가 과정</a>으로 연결합니다. 이 교재는 연결과 RTT를 짧게 복습하고, 애플리케이션과 운영에서 마주치는 나머지 네트워크를 깊게 다룹니다.</p><p>각 장은 구체적인 문제에서 출발합니다. 역할과 조건을 표로 구분하고, 주제에 맞는 트리·메시지 순서·시간축·분기·신뢰 경계를 읽습니다. 실험에서는 원본·캐시·연결 같은 상태를 직접 바꾸고 예측과 결과를 비교합니다. 생략한 조건과 교육용 값은 각 그림과 실험에서 밝힙니다.</p><div class="controls"><a href="01-request-journey.html">첫 장부터 시작 →</a><a href="lab-guide.html">실습 환경과 명령 확인 →</a></div></section><section class="section"><h2>학습 지도</h2><p>1주차 1~3장: 주소 찾기 / 2주차 4~5장: HTTP와 캐시 / 3주차 6~7장: 브라우저 보안과 TLS / 4주차 8~10장: 전송 방식과 서비스 경계 / 5~6주차 11~12장: 성능 분석과 종합 실습. 장별 안내 시간은 첫 읽기 기준이며 심화 실습·복습은 별도입니다.</p><div class="course-grid">{cards}</div></section><section class="section"><h2>어떤 실험을 할 수 있나?</h2><table><tr><th>바꿀 조건</th><th>관찰할 것</th></tr><tr><td>권한 DNS 주소를 바꾸고 시간을 전진</td><td>기존 TTL이 남은 리졸버가 어떤 주소를 응답하는지</td></tr><tr><td>응답 나이 · 원본 변경 · Cache-Control</td><td>캐시 직접 사용, 304 재검증, 200 새 본문의 차이</td></tr><tr><td>origin · 메서드 · 사용자 지정 헤더 · credentials</td><td>preflight 필요 여부와 실제 전송·응답 읽기의 분리</td></tr><tr><td>프로토콜 · 데이터 손실 · TLS 종료 위치</td><td>스트림 전달 지연과 구간별 암호화 경계</td></tr><tr><td>분배 알고리즘 · 서버 제외 · 지연 구간</td><td>실제 요청 분배와 전체 요청 waterfall</td></tr></table></section><section class="section"><h2>학습 완료 기준</h2><div class="checklist"><label><input type="checkbox"> URL 한 개의 요청 흐름을 빈 종이에 그릴 수 있다.</label><label><input type="checkbox"> 캐시·CORS·TLS의 실패를 서로 구분해 설명할 수 있다.</label><label><input type="checkbox"> 관찰한 지연을 구간별로 나누고 추가로 필요한 증거를 고를 수 있다.</label><label><input type="checkbox"> 12장 사례를 오류 코드 하나에 의존하지 않고 해결할 수 있다.</label></div><p class="footnote">체크리스트는 현재 페이지에서만 유지됩니다. 장별 완료 표시는 브라우저에 저장됩니다. 외부 서비스 연동·분석 수집·서버 전송은 없습니다.</p></section>'''
(ROOT/'index.html').write_text(wrap('학습 지도',index))

labguide='''<header class="hero"><div class="eyebrow">LOCAL LAB / REPEATABLE OBSERVATION</div><h1>실제 요청으로<br>확인하는 실습 환경</h1><p class="lead">교재는 파일로 열어도 동작합니다. 실제 HTTP 요청 실습에는 Python 표준 라이브러리 서버를 사용합니다.</p></header><section class="section"><h2>1. 교재 열기</h2><p>network-web-course/index.html을 브라우저로 열거나, 교재 폴더에서 아래 정적 서버를 실행하세요. 두 서버는 목적과 포트가 다릅니다.</p><pre><code>cd network-web-course
python3 -m http.server 8088 --bind 127.0.0.1
# 브라우저: http://127.0.0.1:8088/</code></pre><p>정적 교재는 서버 없이도 본문·그림·시뮬레이터·문제가 작동합니다. 외부 원전 링크와 example.com 실습은 인터넷 연결이 필요합니다.</p></section><section class="section"><h2>2. 실제 HTTP 실습 서버</h2><p>별도 터미널에서 실행하세요. 의존성 설치는 필요하지 않습니다. Python 3가 필요합니다. 기존 8765 포트를 쓰고 있다면 --port 8877처럼 바꿀 수 있으며 명령의 포트도 함께 바꿔야 합니다. 종료는 Ctrl+C입니다.</p><pre><code>cd network-web-course
python3 tools/lab_server.py
# 브라우저: http://127.0.0.1:8765/</code></pre><table><tr><th>경로</th><th>직접 관찰할 결과</th></tr><tr><td>/inspect</td><td>메서드, 경로, 헤더, 본문을 JSON으로 반환</td></tr><tr><td>/cache</td><td>ETag: "v1", max-age=60. 조건 일치 시 304</td></tr><tr><td>/redirect</td><td>302 + Location: /inspect</td></tr><tr><td>/delay?ms=800</td><td>응답 헤더 전 최대 5000ms 대기</td></tr><tr><td>/status?code=503</td><td>지정한 교육용 HTTP 오류 응답</td></tr><tr><td>/cors?mode=allow 또는 deny</td><td>허용 모드에서 로컬 Origin을 명시적으로 허용</td></tr></table><aside>이 서버는 HTTP/1.1 교육 도구입니다. 실제 TLS·HTTP/2·HTTP/3·DNS·프록시·방화벽을 구현하지 않습니다. /status의 502·504는 상태 코드만 만든 합성 응답이며 실제 업스트림 장애를 증명하지 않습니다.</aside></section><section class="section"><h2>3. 메서드와 리다이렉트</h2><pre><code>curl -i http://127.0.0.1:8765/inspect
curl -i -H 'Content-Type: application/json' \\
  --data '{"lesson":"http"}' http://127.0.0.1:8765/inspect
curl -i http://127.0.0.1:8765/redirect
curl -i -L http://127.0.0.1:8765/redirect</code></pre><p>--data는 이 예제에서 POST를 선택합니다. /inspect 결과의 method와 body를 비교하세요. -L이 없으면 302에서 멈추고, 있으면 새 대상의 응답까지 따라갑니다. -i는 응답 헤더를 표시합니다.</p></section><section class="section"><h2>4. 실제 304 확인</h2><pre><code>curl -i http://127.0.0.1:8765/cache
curl -i -H 'If-None-Match: "v1"' http://127.0.0.1:8765/cache</code></pre><p>첫 요청은 200과 JSON 본문, 두 번째는 304와 본문 없음이 예상됩니다. curl이 브라우저처럼 자동 캐시한 결과가 아닙니다. 여러분이 저장 응답의 검증자를 직접 넣어 조건부 요청을 만든 것입니다. 브라우저 자동 캐시는 Network 탭과 함께 관찰하세요.</p></section><section class="section"><h2>5. 타임아웃과 서버 작업 분리</h2><pre><code>curl -sS -o /dev/null -w 'first=%{time_starttransfer}s total=%{time_total}s\\n' \\
  'http://127.0.0.1:8765/delay?ms=800'
curl --max-time 0.2 'http://127.0.0.1:8765/delay?ms=800'</code></pre><p>첫 명령은 약 0.8초 이상 첫 바이트를 기다립니다. 정확한 시간은 환경에 따라 달라집니다. 두 번째는 약 0.2초에 클라이언트 타임아웃 오류가 예상됩니다. 서버는 이미 시작한 대기를 계속할 수 있습니다. 클라이언트 포기와 서버 취소는 같은 사건이 아닙니다.</p></section><section class="section"><h2>6. 실제 브라우저 CORS 비교</h2><ol><li>http://127.0.0.1:8765/를 브라우저에서 엽니다. 개발자 도구 Network·Console을 켭니다.</li><li>CORS 허용 없음 버튼을 누릅니다. 기본 GET은 서버까지 도달할 수 있지만 JS 응답 읽기는 차단됩니다.</li><li>CORS 허용 버튼을 누릅니다. 다른 origin의 응답을 JS에서 읽을 수 있습니다.</li><li>X-Demo를 켜고 반복합니다. 허용 없음이면 OPTIONS 후 실제 GET이 전송되지 않는지 확인하세요.</li></ol><p>127.0.0.1과 localhost는 같은 장치로 연결되어도 origin의 호스트 이름이 다릅니다. 이 실습은 실제 fetch 동작을 관찰하며 교재의 CORS 시뮬레이터와 구분됩니다. HTTP를 사용하므로 HTTPS 쿠키 보안이나 TLS 검증을 실습한 것은 아닙니다.</p></section><section class="section"><h2>도구 차이와 결과 해석</h2><p>macOS/Linux의 curl·dig·openssl 예제를 사용합니다. Windows는 WSL 등 해당 도구가 있는 환경에서 실행하세요. curl -V로 프로토콜·TLS 지원을 먼저 확인하세요. openssl 옵션은 구현과 버전에 따라 다릅니다. dig +trace는 시스템이나 브라우저가 실제 사용한 리졸버·DoH 경로를 그대로 재현하지 않습니다.</p><p>인증서·DNS·상태 코드·타이밍은 외부 환경에서 달라집니다. 교재의 예시 출력은 관찰할 필드와 의미를 안내합니다. 명령이 실패하면 오류 문구와 어느 단계까지 완료됐는지 먼저 기록하세요.</p></section><div class="pager"><a href="index.html">← 학습 지도</a><a href="01-request-journey.html">첫 장 시작 →</a></div>'''
(ROOT/'lab-guide.html').write_text(wrap('실습 안내',labguide))
print(json.dumps({'chapters':len(chapters),'sections':sum(len(c['sections']) for c in chapters),'questions':sum(len(c['questions']) for c in chapters),'chars':sum(len(re.sub('<[^>]+>','',json.dumps(c,ensure_ascii=False))) for c in chapters)},ensure_ascii=False))
