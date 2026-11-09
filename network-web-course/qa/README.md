# 브라우저 검증 결과

실제 headless Chromium 153.0.8010.12에서 검사했습니다. 14페이지, 4가지 화면 폭(320·390·768·1440px), 총 56개 배치 조건과 320개 검사가 통과했습니다. 브라우저 JavaScript 예외는 0건입니다.

[기계 판독 결과](browser-results.json) · [데스크톱 학습 지도](screenshots/index-desktop.png) · [모바일 DNS](screenshots/02-dns-mobile.png) · [모바일 CORS](screenshots/06-browser-security-mobile.png) · [다크 테마](screenshots/02-dns-dark-mobile.png) · [실제 로컬 CORS](screenshots/real-cors.png)

확인한 동작은 다음과 같습니다.

- 모든 페이지의 가로 넘침, 이미지 로딩, SVG 글자 크기와 노드 경계
- 48문항 정답·해설, 모바일 목차, 진행률·테마 새로고침 후 유지
- DNS 조회·TTL 만료, HTTP 캐시, CORS, HTTP 버전, 로드밸런서, TLS 경계, waterfall, 장애 사례의 조작
- 실제 SMIL 패킷 이동과 CSS 경로 애니메이션의 일시정지, 마지막 단계 이동, 동작 감소 설정
- 실제 브라우저 GET의 CORS 읽기 차단과 허용, OPTIONS 실패 시 실제 GET 미전송, 허용 시 OPTIONS 이후 GET 전송. 로컬 서버 접근 로그와 JS 결과를 함께 확인
- 인터넷을 끊은 브라우저 컨텍스트에서 파일로 연 교재의 이미지와 실험 동작

검증에서 발견한 문제는 수정했습니다. 화면 폭이 바뀌어도 일부 도식이 데스크톱 좌표를 유지하던 문제, 체크박스 정렬, CSS 애니메이션이 일시정지되지 않던 문제, 마지막 단계 이동이 즉시 멈추던 문제, 전체 지도에서 DNS 경로가 프록시에 연결되던 문제입니다.

재실행은 교재 폴더에서 아래 명령을 사용합니다. 기존에 설치된 도구 경로가 필요하며 스크립트는 별도 임시 HTTP 서버·실습 서버를 열고 종료합니다.

```sh
node tools/verify-browser.mjs /absolute/path/to/playwright/index.mjs /absolute/path/to/chromium
```

TLS 패킷 핸드셰이크, 실제 HTTP/2·HTTP/3 서버, Safari·Firefox 동작은 검증하지 않았습니다. 화면 폭 변경은 데스크톱 Chromium에서 수행했으며 실제 휴대폰 하드웨어 검증을 뜻하지 않습니다.
