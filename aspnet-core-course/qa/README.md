# 검증 기록

## 실행 결과

- `models.test.cjs`: 9개 테스트 통과. 18장 구조·출처, 모든 선택값·범위 끝값의 모델 상태, 미들웨어 단락 처리, DI 공유·해제, 소유권 인가, 큐 보존식·종료 유실, 비동기 점유, SQL·캐시 비용, 과부하·버퍼 사용량.
- 실제 headless Chromium: 18장, 320/390/768/1440px 72개 레이아웃 조합, 실험 입력 85개 조합, 총 316개 검사 통과. JavaScript 오류 0.
- 자동 재생·정지·이전·초기화, 퀴즈 제출, 모바일 목차·검색, Escape/Enter 키, reduced-motion, 완료·테마·노트 저장, 노트 내려받기, file:// 직접 실행, C# 안내 페이지 확인.
- 화면 캡처 `screenshots/`: 홈, 프레임워크 비교 데스크톱/모바일, 파이프라인, DI 모바일 다크 모드. 홈과 모바일 비교 화면을 직접 시각 검토.
- 콘텐츠·모델은 별도 검토자가 실제 파일을 읽고 검토. 지시/모델 불일치와 실패 경로를 수정.

`browser-results.json`은 실행된 검사와 브라우저 버전을 기록합니다. 개념 모델 테스트는 실제 CLR·DB·네트워크 동작이나 성능 측정을 증명하지 않습니다. .NET SDK가 없으므로 C# 프로젝트 컴파일·실행은 미검증입니다. 다른 브라우저 엔진 및 실제 스크린리더는 검증하지 않았습니다.

## 재실행

```sh
node --test aspnet-core-course/qa/models.test.cjs
node aspnet-core-course/qa/browser.mjs /path/to/existing/playwright/index.mjs /path/to/existing/chromium
```

브라우저 테스트는 자체 로컬 HTTP 서버를 열고 종료합니다. 설치된 Playwright와 Chromium을 사용하며 패키지를 다운로드하지 않습니다. 테스트용 브라우저 프로필의 저장 데이터만 사용합니다.
