# Linux Kernel Deep Dive

Linux 6.18 LTS 기준 한국어 학습 자료. 7부·28장에 본문 도식 112개, 상태 변화 애니메이션 28개, 조건 조작 실험, 상세 설명, Linux 관측 실습, 해설형 퀴즈를 제공합니다. `malloc` 특별 실험실에서는 청크 분할·병합·캐시·페이지 상주·힙 반환을 조작합니다.

- 시작: [index.html](index.html)
- 할당자 실험: [malloc-lab.html](malloc-lab.html)
- 실습 환경과 C 보충: [lab-guide.html](lab-guide.html)
- 서적·아티클·버전 정책: [references.html](references.html)

## 자료 기준

커널 문서는 `https://docs.kernel.org/6.18/`, 소스는 `v6.18` 태그 기준입니다. kernel.org의 LTS 상태를 2026-11-10 확인했습니다. 실제 실행 커널의 patch release, 아키텍처, config, libc 버전은 실습자가 별도 기록합니다. 기능 지원과 기본 활성화는 다릅니다.

Robert Love의 Linux Kernel Development는 개념 골격, Michael Kerrisk의 TLPI는 사용자 API, Brendan Gregg의 Systems Performance와 USE Method는 관측 방법을 참고했습니다. 오래된 책의 API를 현대 커널의 기본값으로 취급하지 않습니다. Ben M. Andrew의 malloc 아티클을 참고해 별도의 할당자 모형과 C 관측 예제를 작성했습니다. GPU 내용은 포함하지 않습니다.

## 구성과 생성

- `content/NN-*.json`: 28장 원본. 각 장에는 6개 이상의 상세 설명 절, 흐름 단계, 실습, 3개 이상의 해설형 문제가 있습니다.
- `content/{lab-guide,references,malloc-lab}.html`: 보충 문서 본문.
- `build.py`: 완전성과 설명 분량을 확인한 뒤 정적 HTML을 생성합니다. 전체 28장 원본이 필요합니다.
- `assets/models.js`: 실제 커널 실행을 대신하지 않는 28개 개념 모델. 입력·결과·한계를 명시합니다.
- `assets/malloc.js`: 별도로 설계한 상태 기반 청크 모델.
- `assets/atlas-*.js`: 각 장의 도식과 비교 시나리오. 주소 공간·페이지·큐·참조선 등의 실제 좌표와 상태가 변합니다.
- `assets/drawing.js`, `atlas-ui.js`, `atlas.css`: SVG 생성, 확대, 재생·일시 정지·단계 이동·속도·시나리오 비교.
- `assets/course.js`, `course.css`: 수치 실험, 퀴즈, 진도, 반응형 화면.
- `examples/`: Linux용 C 관측 예제. 호스트에서는 실행하지 않습니다.
- `qa/`: 검증 결과와 대표 화면.

```sh
# 생성에는 Python 3와 Node.js가 필요합니다.
python3 linux-kernel-course/build.py
python3 -m http.server 8000
# http://localhost:8000/linux-kernel-course/
```

생성된 HTML은 배포 시 빌드나 외부 JS 의존성이 필요 없습니다. 파일로 직접 열 수도 있지만, 코멘트·진도 저장은 HTTP 환경을 권장합니다. 저장은 같은 브라우저의 localStorage에 한정됩니다. 자동 재생은 수동 시작이고 일시 정지·이전/다음·초기화를 지원합니다. reduced-motion 설정에서는 전환 효과를 끕니다.

## 검증

```sh
node linux-kernel-course/tools/models.test.cjs
node linux-kernel-course/tools/heap.test.cjs
node linux-kernel-course/tools/verify.mjs /path/to/playwright/index.mjs /path/to/chromium
node linux-kernel-course/tools/verify-atlas.mjs /path/to/playwright/index.mjs /path/to/chromium
```

검증 도구는 이미 설치된 Playwright와 Chromium 경로를 받습니다. 설치하거나 다운로드하지 않습니다. 모든 장의 프리셋·초기화·키보드 조작·퀴즈·진도 저장·모바일 overflow, 애니메이션 재생/정지, malloc 상태 전이, 로컬 링크와 공통 코멘트를 확인합니다.

브라우저 및 모델 검증과 실제 Linux 실습은 별개입니다. 제공한 Linux 실습은 제작 환경에서 실행 검증하지 않았습니다. `examples/`의 두 C 파일과 13·15·17·18장의 사용자 C 블록은 호스트 clang으로 문법 검사만 수행했으며 glibc 전용 분기와 Linux 런타임을 검증한 결과는 아닙니다.
