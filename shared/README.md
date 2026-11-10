# 로컬 문서 코멘트

`course-comments.js`는 코스 코드와 독립적인 브라우저 스크립트입니다. 파일 하나를 복사하고 HTML에 연결하면 사용할 수 있습니다. 외부 라이브러리·빌드·서버 API가 필요하지 않습니다.

```html
<script defer src="/assets/course-comments.js"
        data-namespace="my-handbook"
        data-root="main"
        data-title="문서 메모"></script>
```

본문을 선택하면 코멘트를 작성할 수 있습니다. 드래그, 세 번 클릭, 키보드 선택을 지원합니다. UI는 Shadow DOM으로 격리하며 원문 DOM을 감싸거나 변경하지 않습니다. 같은 문서에 중복 로드해도 패널은 하나만 생성합니다. `defer` 없이 head에 넣어도 DOM 준비 후 시작합니다.

## 설정

| 속성 | 기본값 | 용도 |
| --- | --- | --- |
| `data-namespace` | 기존 코스 저장 키 | 프로젝트별 저장 영역. 다른 프로젝트에 복사할 때 고유한 값을 지정하세요. |
| `data-root` | `body` | 선택·원문 복원 대상 CSS 선택자. `main`, `#article` 등 한 요소를 지정합니다. |
| `data-page-id` | 현재 pathname (`index.html`·마지막 `/` 제거) | 문서 식별자. 쿼리나 hash로 다른 문서를 표시할 때 명시적으로 지정합니다. |
| `data-title` | 내 코멘트 | 패널 제목. HTML이 아닌 텍스트로 표시합니다. |
| `data-layout` | `reserve` | 넓은 화면에서 오른쪽 340px을 확보합니다. `overlay`는 본문 레이아웃을 변경하지 않습니다. 좁은 화면은 항상 겹쳐 표시합니다. |

기존 코스는 설정 없이 사용하므로 저장 키와 기존 코멘트가 그대로 유지됩니다. 새 프로젝트에서는 `data-namespace`를 고정하세요. 이후 namespace 또는 page-id를 바꾸면 기존 메모가 다른 저장 영역/문서에 남습니다. 스크립트 파일 위치를 바꿀 때도 명시한 namespace는 유지됩니다.

한 문서에 인스턴스 하나를 지원합니다. 설정은 시작 시 읽습니다. SPA에서 다른 문서로 전환하는 자동 재초기화는 제공하지 않습니다. 같은 문서 안에서 내용이 추가·교체되면 원문 하이라이트를 다시 찾습니다. root 요소 자체는 유지해야 합니다.

## 저장과 내보내기

localStorage에 코멘트별로 저장하며, 같은 origin·namespace의 탭에 변경을 반영합니다. JSON 내보내기는 현재 namespace의 모든 페이지 메모를 포함합니다. 데이터에는 `version`, `id`, `page`, `url`, `title`, `hash`, `quote`, `anchor`(문자 위치·앞뒤 문맥), `text`, `createdAt`, `updatedAt`가 들어갑니다. 문서 수정으로 원문이 사라져도 인용문과 메모는 보존합니다.

브라우저 데이터 삭제 시 메모가 사라집니다. 다른 브라우저·기기·origin 간 동기화와 JSON 가져오기는 제공하지 않습니다. `file://` 저장 동작은 브라우저마다 달라 HTTP(S) 사용을 권장합니다. CSS Highlight API가 없는 브라우저에서도 메모를 저장할 수 있지만 원문 색상 표시는 지원하지 않습니다.

## 확인

[독립 실행 예제](examples/standalone.html)는 코스 CSS·JS 없이 동작합니다. 이 폴더를 다른 프로젝트에 복사해 그대로 열 수 있습니다.

```sh
node tools/verify-comments.mjs /path/to/playwright/index.mjs /path/to/chromium
```

## 공통 코스 디자인

`course-design.css`와 `course-design.js`는 코스 목록, C# GC 단일 교재와 모든 코스 HTML에서 공유합니다. 흰색·중립 회색·파란색을 기준으로 밝은 테마를 고정하며, 각 코스의 학습 기능은 기존 스크립트가 담당합니다. 공통 CSS는 코스별 스타일 뒤에, 공통 JS는 head 마지막에 연결합니다.

새 페이지를 추가하거나 HTML을 생성한 뒤 다음 명령으로 연결합니다. 여러 번 실행해도 중복 태그가 생기지 않습니다. 네트워크·Linux 코스 생성기는 공통 디자인 태그를 직접 포함합니다.

```sh
python3 tools/connect-design.py
```

## 공통 코드 하이라이팅

`course-design.js`가 `course-syntax.js`와 `course-syntax.css`를 로컬에서 불러옵니다. `pre` 코드 블록을 자동으로 색칠하고 동적으로 교체되는 코드에도 적용합니다. 언어를 확정하려면 `<code class="language-csharp">` 또는 `data-language="sql"`을 지정하세요. C#, JavaScript/TypeScript, Rust, C/C++, Java, Python, SQL, Bash, JSON 등을 지원합니다. 실행 결과는 `data-language="console"`, 일반 텍스트는 `data-language="text"`로 명시할 수 있습니다. 원문을 텍스트 노드로 유지하며 코드를 실행하지 않습니다.
