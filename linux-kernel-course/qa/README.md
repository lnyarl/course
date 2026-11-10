# 검증 기록

기존 제작 검증과 2026-11-10 시각 자료 보강 검증을 구분합니다. 테스트 스크립트는 이미 설치된 Playwright/Chromium을 사용했고 의존성을 설치하지 않았습니다.

| 범위 | 결과 | 근거 |
|---|---|---|
| 생성·콘텐츠 계약 | 28장, 288개 설명 절, 84문항, 148개 흐름 단계 | `content-results.json`, `python3 linux-kernel-course/build.py` |
| 본문 깊이 | 장별 설명 6,003–6,873자. 실습·퀴즈·출처 제외 | `content-results.json` |
| 개념 모델 | 2,281개 검사 통과 | `node tools/models.test.cjs` |
| malloc 상태 모델 | 수명·캐시·반환과 512가지 요청 크기 검사 통과 | `node tools/heap.test.cjs` |
| 전체 브라우저 | 28장, 1,206개 검사, pageerror 0 | `browser-results.json`, `tools/verify.mjs` |
| 특화 SVG | 8개 도식 × 3개 프리셋 = 24회 텍스트 경계 확인, 잘림 0 | `diagram-results.json` |
| 기존 강좌 목록 | 14개 강좌·223개 장 링크, 검색·필터·모바일·코멘트 등 255개 검사 통과 | 루트 `tools/verify-library.mjs` |
| 참고 자료 링크 | 81개 중 80개 HTTP 200. O'Reilly 목차는 자동 요청에 403, 웹 검색에서는 확인 | `source-links.json` |
| v6.18 소스 파일 | 67개 고유 파일 경로 HTTP 200 | `source-paths.json` |
| C 문법 | 별도 예제 2개, 13·15·17·18장의 C 블록은 호스트 clang 구문 검사 통과 | `host-c-syntax.json`, 예제 직접 검사 |

브라우저 검사는 프리셋에 따른 결과 변화, 기본값 복원, 키보드 range/select 조작, 단계 전환·자동 재생·일시 정지, 퀴즈 미선택·오답·정답, 진도 저장과 재로드, 목차 검색, 공통 밝은 테마, 320/390/1440px 가로 overflow, malloc 페이지 상주·해제·캐시·반환, 로컬 링크, 공통 코멘트를 확인합니다.

독립 검토로 발견한 `no_llseek`의 6.18 비지원, 잘못된 SLUB 문서 경로, initramfs PID 1과 최종 init의 혼동, 일반 page fault와 oops의 혼동, 본문과 실험 입력 불일치, SVG 축 라벨 잘림을 수정했습니다.

## 2026-11-10 본문 시각 자료 보강

각 장의 관련 본문에 SVG 도식 4개를 배치하고, 구조의 위치·참조·소유권이 바뀌는 시뮬레이터를 추가했습니다. 기존 상세 설명, 수치 실험, 퀴즈는 유지했습니다. 전체 원본이 있어야 하는 기본 빌드에서 28장·112도식·28장면과 본문 내 분산 배치를 검사합니다.

`tools/verify-atlas.mjs`는 전체 UI와 SVG를 검사하며 결과는 `atlas-browser-results.json`에 기록합니다. 확대·닫기, 비교 조건 전환, 이전/다음·초기화·키보드 단계 이동, 중간 프레임 좌표 변화, 일시 정지·재개, reduced-motion과 모바일 가로 넘침을 확인합니다. SVG 경계와 라벨 겹침도 검사합니다. 단순히 프레임 번호만 바뀌는 것을 애니메이션 검증으로 세지 않습니다. 전체 28장 검사 결과는 898개 검사, 56개 비교 시나리오, 556개 SVG 상태, 브라우저 오류 0입니다. 최종 교차 검토 수정분은 `atlas-browser-targeted-results.json`에 별도 재검증 기록을 남깁니다.

교차 검토에서는 TLB hit의 페이지 테이블 우회, COW 참조선, buddy 가용 블록 지표, FIFO 회수의 고정 슬롯, rename 전후 디렉터리 참조, CPU quota 경계 상태를 확인하고 시각적 의미가 어긋난 부분을 교정했습니다.

대표 화면은 `atlas-06-*`, `atlas-13-*`, `atlas-14-*`, `atlas-17-*`, `atlas-20-*`입니다. 기존 회귀 검증도 1,206개 검사·브라우저 오류 0으로 통과했습니다. 루트 목록·외부 링크·C 문법의 위 기록은 이전 제작 시점의 결과이며 이번 시각 자료 보강에서 재실행한 결과가 아닙니다.

## 대표 화면

- `index-desktop.png`: 과정 첫 화면
- `experiment-desktop.png`: 장별 조작 실험
- `malloc-desktop.png`: 청크와 상주 페이지 실험
- `cgroup-desktop.png`: 두 CPU의 quota 시간선
- `chapter-mobile.png`: 모바일 밝은 테마
- `chapter-dark-mobile.png`: 이전 제작의 보관 화면이며 현재 밝은 공통 디자인 검증에 사용하지 않습니다.

## 검증하지 않은 것

Linux 6.18 VM에서의 실제 C 실행, kernel module 빌드·로드, perf/eBPF 추적, 실측 성능은 검증하지 않았습니다. 호스트 C 문법 검사는 glibc 전용 분기나 Linux 런타임 동작을 보장하지 않습니다. 제공 실습과 예상 관측을 실제 실행 결과로 표시하지 않았습니다. 배포·게시도 수행하지 않았습니다.
