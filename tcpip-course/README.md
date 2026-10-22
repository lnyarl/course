# TCP/IP 전문가 과정

오프라인에서 동작하는 인터랙티브 학습 자료. `index.html`을 브라우저로 열면 시작.

- Part 1 개론 (01~06): 계층 모델 → 링크 → IP → ICMP/DNS/DHCP → UDP/TCP 기초 → 응용/소켓
- Part 2 심화 (07~14): TCP 신뢰성 → 혼잡 제어 → TCP 옵션 → IPv6 → 라우팅 → NAT/보안/TLS → 성능/도구 → 종합 실습

구성
- `assets/style.css` 공통 스타일, `assets/common.js` 사이드바·진행률·퀴즈·헤더 도식·단계 애니메이션 공통 엔진
- 각 장은 독립 HTML. 외부 의존성 없음(CDN 미사용). 진행률은 localStorage에 저장.
