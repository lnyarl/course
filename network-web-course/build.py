#!/usr/bin/env python3
"""Build offline static network textbook from authored chapter JSON."""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
chapters = []
for name in ('part-intro.json', 'part-a.json', 'part-b.json'):
    p = ROOT / 'content' / name
    if p.exists():
        chapters.extend(json.loads(p.read_text()))
chapters.sort(key=lambda c: c['id'])
E = html.escape
TITLE = '웹 네트워크 해부'
LAB_TITLES = {'01':'요청 한 건을 끝까지 따라가기','02':'DNS 위임을 단계별로 따라가기','03':'주소 변경과 TTL 만료 실험','04':'HTTP 메시지 해부','05':'fresh · 304 · 새 본문 비교','06':'CORS는 어디에서 차단할까?','07':'TLS 1.3 핸드셰이크','08':'다중화와 손실 비교','09':'로드밸런서 분배 실험','10':'주소 변환 · 정책 · 암호화 구분','11':'요청 waterfall 만들기','12':'증거로 좁히는 장애 조사'}
CONCEPTS={
'01':('세 가지 성공을 구분하기',[('주소를 찾았다','DNS result','IP ≠ 서버 신원'),('상대를 검증했다','TLS authentication','인증서 ≠ 사용자 권한'),('응답을 읽었다','HTTP + browser policy','수신 ≠ JS 공개')]),
'02':('분산된 이름 공간의 위임',[('재귀 리졸버','대신 결과를 찾아줌','캐시를 보관할 수 있음'),('위임 체인','Root → TLD → zone','referral은 다음 질의 안내'),('권한 데이터','A · AAAA · CNAME','레코드별 의미를 구분')]),
'03':('주소 변경과 캐시 수명',[('t=0 · v1 저장','TTL 60초 시작','이 리졸버의 응답 보관'),('t=30 · 원본 v2','기존 캐시는 v1','원본 변경 ≠ 캐시 삭제'),('t=60 · 재조회','만료 후 새 결과 획득','기존 연결 수명은 별도')]),
'04':('메시지의 서로 다른 책임',[('메서드 + 대상','GET /orders','어떤 작업을 요청하는가'),('헤더','Accept · Content-Type','메시지를 어떻게 해석할까'),('상태 + 본문','200 + JSON','프로토콜 결과와 표현')]),
'05':('재사용과 재검증의 차이',[('Fresh','저장 응답 바로 사용','원본 왕복 생략 가능'),('Stale + unchanged','조건부 요청 → 304','저장된 본문 재사용'),('Stale + changed','조건부 요청 → 200','새 본문으로 교체')]),
'06':('서버 처리와 JS 응답 접근',[('preflight 검사','필요 조건일 때만','실패하면 실제 요청 생략'),('실제 HTTP 요청','서버가 처리할 수 있음','인증 · 인가는 별도'),('응답 공개 검사','브라우저가 CORS 적용','실제 처리 후 차단 가능')]),
'07':('키 합의와 신원 검증',[('키 합의','공유 비밀 계산','개인키를 전송하지 않음'),('서버 인증','이름 · 신뢰 사슬 · 서명','연결 상대를 검증'),('데이터 보호','유도한 트래픽 키','AEAD 암호화와 무결성')]),
'08':('HTTP 의미와 전송 방식',[('HTTP/1.1','텍스트 메시지 프레이밍','연결 재사용 가능'),('HTTP/2','프레임 · 스트림 + TCP','TCP 순서 보장의 영향'),('HTTP/3','프레임 · 스트림 + QUIC','스트림별 전달 순서')]),
'09':('프록시는 두 연결의 종단',[('클라이언트 연결','Browser ↔ Proxy','TLS 종료 · 요청 정책'),('분배 결정','health · algorithm','사용 가능한 대상 선택'),('업스트림 연결','Proxy ↔ Application','별도 타임아웃 · TLS')]),
'10':('같은 장비여도 기능은 다르다',[('NAT','주소 · 포트 변환','정책 허용과 별개'),('방화벽','통신 정책 적용','상태 추적 여부 확인'),('TLS','특정 종단 사이 보호','종료 뒤 구간은 별도')]),
'11':('전체 지연을 관측 가능한 구간으로',[('설정 비용','DNS · 연결 · TLS','재사용 시 생략 가능'),('첫 바이트 대기','전송 · 큐 · 앱 · upstream','서버 함수 시간과 다름'),('본문 전송','크기 · 대역폭 · 혼잡','TTFB 이후도 관찰')]),
'12':('증거와 가설을 구분하기',[('관찰','누가 · 언제 · 무엇을 봤나','오류 원문 · ID 보존'),('경계 확인','어느 단계까지 성공했나','응답 생성 주체 확인'),('가설 검증','다음 검사가 무엇을 가르나','반증 가능한 조사 선택')])}

def make_figure(c):
    title,nodes=CONCEPTS[c['id']]
    for mobile in (False,True):
        w,h=(380,490) if mobile else (930,230)
        parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="t"><title id="t">{E(title)}</title><rect width="{w}" height="{h}" fill="#122b31" rx="12"/><g font-family="sans-serif"><text x="24" y="35" font-size="18" fill="#a0e6c8">{E(title)}</text>']
        for i,(head,line,sub) in enumerate(nodes):
            x,y=(20,65+i*140) if mobile else (22+i*306,65)
            nw=340 if mobile else 276
            if i<2:
                path=f'M190 {y+110}v30' if mobile else f'M{x+nw} 117h30'
                parts.append(f'<path d="{path}" stroke="#8bd7b6" stroke-width="2" fill="none"/>')
            parts.append(f'<rect x="{x}" y="{y}" width="{nw}" height="110" rx="9" fill="#1d4247" stroke="#517a77"/><text x="{x+18}" y="{y+28}" font-size="18" fill="#e6f0ec">{E(head)}</text><text x="{x+18}" y="{y+59}" font-size="16" fill="#9be3c3">{E(line)}</text><text x="{x+18}" y="{y+88}" font-size="14" fill="#c4d9d1">{E(sub)}</text>')
        parts.append('</g></svg>')
        filename=f"concept-{c['id']}{'-mobile' if mobile else ''}.svg"
        (ROOT/'assets'/filename).write_text(''.join(parts))
    return f'<figure class="illustration"><picture><source media="(max-width:600px)" srcset="assets/concept-{c["id"]}-mobile.svg"><img style="display:block;width:100%;height:auto" src="assets/concept-{c["id"]}.svg" alt="{E(title)}: {E(" → ".join(n[0] for n in nodes))}" loading="lazy"></picture><figcaption>{E(" / ".join(n[2] for n in nodes))}</figcaption></figure>'


def sidebar(current):
    links=''.join(f'<li><a href="{c["slug"]}.html" data-chapter-link="{c["id"]}"'+(' aria-current="page"' if current==c['id'] else '')+f'><span class="num">{c["id"]}</span><span>{E(c["title"])}</span></a></li>' for c in chapters)
    return f'<aside class="sidebar"><a class="brand" href="index.html">웹 네트워크<br>해부 실험실</a><small>DNS → HTTP → 보안 → 운영</small><div class="side-actions"><button id="menu" class="mobile-menu" type="button" aria-expanded="false" aria-controls="chapter-list">목차 열기</button><button id="theme" type="button">테마 전환</button></div><nav aria-label="장별 목차"><ol id="chapter-list">{links}</ol></nav><div data-progress>0 / 12장 완료</div><div class="progress" aria-hidden="true"><span data-progress-bar style="width:0"></span></div><a href="../index.html">전체 교재 목록 ↗</a></aside>'


def wrap(title,body,current=''):
    return f'<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="DNS, HTTP, TLS, 프록시와 장애 분석을 도식과 실험으로 배우는 한국어 네트워크 교재"><title>{E(title)} · {TITLE}</title><link rel="stylesheet" href="assets/course.css"></head><body data-chapter="{current}"><a class="skip" href="#main">본문으로 이동</a><div class="shell">{sidebar(current)}<main id="main" class="content">{body}</main></div><script src="assets/course.js"></script><script defer src="../shared/course-comments.js"></script></body></html>\n'

for i,c in enumerate(chapters):
    fig=make_figure(c)
    secnav=''.join(f'<a href="#s{j}">{E(s["title"])}</a>' for j,s in enumerate(c['sections'],1))
    text=f'<header class="hero"><div class="eyebrow">FIELD GUIDE / CHAPTER {c["id"]}</div><h1>{E(c["title"])}</h1><p class="lead">{E(c["lead"])}</p><div class="meta"><span class="pill">첫 읽기 + 핵심 실험 약 {c.get("minutes",90)}분</span><span>오프라인 교재 · 교육용 시뮬레이션</span></div></header>'
    text+=fig+f'<nav class="section-nav" aria-label="이 장의 절">{secnav}<a href="#practice">실제 실습</a><a href="#quiz">확인 문제</a></nav>'
    text+=f'<section class="lab" aria-labelledby="simulation-title"><div class="eyebrow">INTERACTIVE EXPERIMENT</div><h2 id="simulation-title">{LAB_TITLES[c["id"]]}</h2><div id="simulation"><p>자바스크립트를 켜면 실험을 조작할 수 있습니다. 아래 본문·도식·실습은 그대로 읽을 수 있습니다.</p></div></section>'
    for j,s in enumerate(c['sections'],1):
        text+=f'<section class="section" id="s{j}"><h2>{j:02d}. {E(s["title"])}</h2>{s["html"]}</section>'
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

cards=''.join(f'<a class="course-card" href="{c["slug"]}.html"><div class="eyebrow">CHAPTER {c["id"]} / {c.get("minutes",90)} MIN</div><h3>{E(c["title"])}</h3><p>{E(c["lead"])}</p></a>' for c in chapters)
index=f'''<header class="hero"><div class="eyebrow">THE WEB NETWORK FIELD GUIDE</div><h1>요청이 움직이는 과정,<br>직접 바꾸며 이해하기.</h1><p class="lead">이름이 주소가 되고, 안전한 연결 위로 메시지가 오가고, 여러 서버가 응답을 만드는 과정. DNS · HTTP · TLS · 프록시 · 장애 분석을 하나의 요청으로 연결합니다.</p><div class="meta"><span class="pill">12장 · 12개 실험 · 48개 확인 문제</span><span>한국어 상세 교재 · 설치 없는 정적 페이지</span></div></header><figure class="illustration"><picture><source media="(max-width:600px)" srcset="assets/overview-mobile.svg"><img src="assets/overview.svg" style="width:100%;height:auto;display:block" alt="브라우저의 DNS 조회 경로와 프록시·앱 서버 사이의 별도 연결"></picture><figcaption>DNS는 주소를 조회하는 별도 경로. 프록시는 클라이언트 연결과 업스트림 연결을 각각 관리합니다.</figcaption></figure><section class="section"><h2>TCP/IP 다음에 배울 것들</h2><p>TCP/IP 심화는 <a href="../tcpip-course/index.html">기존 TCP/IP 전문가 과정</a>으로 연결합니다. 이 교재는 연결과 RTT를 짧게 복습하고, 애플리케이션과 운영에서 마주치는 나머지 네트워크를 깊게 다룹니다.</p><p>각 장은 원인과 동작을 설명하는 본문, 조작형 실험, 실제 명령 실습, 해설 있는 문제로 구성됩니다. 먼저 결과를 예측한 뒤 값을 바꾸세요. 도식에는 생략한 조건이 적혀 있으며 실제 관찰과 시뮬레이션을 구분합니다.</p><div class="controls"><a href="01-request-journey.html">첫 장부터 시작 →</a><a href="lab-guide.html">실습 환경과 명령 확인 →</a></div></section><section class="section"><h2>학습 지도</h2><p>1주차 1~3장: 주소 찾기 / 2주차 4~5장: HTTP와 캐시 / 3주차 6~7장: 브라우저 보안과 TLS / 4주차 8~10장: 전송 방식과 서비스 경계 / 5~6주차 11~12장: 성능 분석과 종합 실습. 장별 안내 시간은 첫 읽기 기준이며 심화 실습·복습은 별도입니다.</p><div class="course-grid">{cards}</div></section><section class="section"><h2>어떤 실험을 할 수 있나?</h2><table><tr><th>바꿀 조건</th><th>관찰할 것</th></tr><tr><td>권한 DNS 주소를 바꾸고 시간을 전진</td><td>기존 TTL이 남은 리졸버가 어떤 주소를 응답하는지</td></tr><tr><td>응답 나이 · 원본 변경 · Cache-Control</td><td>캐시 직접 사용, 304 재검증, 200 새 본문의 차이</td></tr><tr><td>origin · 메서드 · 사용자 지정 헤더 · credentials</td><td>preflight 필요 여부와 실제 전송·응답 읽기의 분리</td></tr><tr><td>프로토콜 · 데이터 손실 · TLS 종료 위치</td><td>스트림 전달 지연과 구간별 암호화 경계</td></tr><tr><td>분배 알고리즘 · 서버 제외 · 지연 구간</td><td>실제 요청 분배와 전체 요청 waterfall</td></tr></table></section><section class="section"><h2>학습 완료 기준</h2><div class="checklist"><label><input type="checkbox"> URL 한 개의 요청 흐름을 빈 종이에 그릴 수 있다.</label><label><input type="checkbox"> 캐시·CORS·TLS의 실패를 서로 구분해 설명할 수 있다.</label><label><input type="checkbox"> 관찰한 지연을 구간별로 나누고 추가로 필요한 증거를 고를 수 있다.</label><label><input type="checkbox"> 12장 사례를 오류 코드 하나에 의존하지 않고 해결할 수 있다.</label></div><p class="footnote">체크리스트는 현재 페이지에서만 유지됩니다. 장별 완료 표시는 브라우저에 저장됩니다. 외부 서비스 연동·분석 수집·서버 전송은 없습니다.</p></section>'''
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
