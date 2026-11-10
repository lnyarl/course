# 동시성과 비동기 학습자료 제작

- 목표: 기존 8주 커리큘럼을 한국어 정적 웹 교재로 구현한다.
- 범위: 8장 설명, SVG 도식, 상태 기반 조작 실험 8개, C# / .NET 실습, 확인 문제, 진도 저장.
- 기존 교재와 수정 중인 파일을 보존한다. 배포와 커밋은 수행하지 않는다.
- 역할: 메인은 화면·실험 모델·통합 검증, 콘텐츠 담당은 content.js·examples만 소유한다.
- 계약: window.COURSE = [{id:1..8,title,kicker,lead,objectives:string[],sections:[{title,body}],trap:{myth,truth},exercise:{file,steps:string[],expected:string},quiz:[{question,options:string[],correct:number,explanation}],takeaway:string}].
- 실험: 실행 스택, CPU 스케줄링, I/O 대기, 경쟁과 락, 비동기 상태 머신과 continuation, 유한 큐, 취소와 정리, 처리 방식 비교.
- 완료 조건: 각 장에서 입력→상태 변화→설명이 연결되고 초기화·단계 실행·재생/정지가 작동한다. 모든 장에 개별 SVG 도식과 퀴즈 피드백이 있다. C# 예제가 실행되며 모델 한계를 표시한다. 모바일·키보드·동작 줄이기를 지원한다.
- 검증: 순수 모델의 시나리오 테스트, JS 구문 검사, C# 예제 실행, 링크 검사, 브라우저 실제 확인. 브라우저 API 가용성에 따라 네이티브 UI를 사용한다.
