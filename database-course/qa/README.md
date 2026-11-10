# 데이터베이스 코스 검증

외부 의존성을 새로 설치하지 않습니다. 이미 설치된 Playwright 모듈과 Chrome 실행 파일의 절대 경로를 전달하세요.

```sh
node database-course/qa/verify.mjs /path/to/playwright/index.mjs /path/to/chrome
bash database-course/examples/check-all.sh
```

브라우저 검사는 37개 위젯 안내의 누락 여부, 9장의 단계 진행·초기화, 360/1440px 라이트/다크 레이아웃, 슬롯 삽입과 용량 초과, B+트리의 구분 키 복사/이동, 동작 줄이기 설정을 확인합니다. Rust 검사는 실제 저장·재시작·손상 복구·트랜잭션·wire protocol을 실행합니다. 브라우저 모델의 통과는 실제 파일 내구성의 증명이 아닙니다.
