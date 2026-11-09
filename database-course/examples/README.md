# mydb 참조 구현

Rust 2024로 1~9장을 제공합니다. 1장은 독립 KV이고 2~9장은 페이지 SQL 엔진으로 이어집니다. 폴더 구조를 유지하세요. 2~9장은 외부 Rust 크레이트 없이 표준 라이브러리만 사용하며, 7~9장은 macOS/Linux의 `flock`과 디렉터리 동기화가 필요합니다.

- `ch01`: Cargo 프로젝트·로그 KV·17개 완료 검사 (`anyhow`, `crc32fast`)
- `ch02/pages.rs`: 4096바이트 페이지·CLOCK 버퍼 풀
- `ch03/btree.rs`: 실제 페이지 기반 B+트리
- `ch04/tables.rs`: 카탈로그·튜플·기본키 색인
- `ch05/sql.rs`: SQL 토큰·AST
- `ch06/executor.rs`: 바인딩·pull 연산자·조인 API
- `engine.rs`: typed SQL 결과·기본키 접근 선택·보수적인 8MiB 결과 바이트 예산
- `ch07/wal.rs`: private workspace·CRC afterimage WAL·복구
- `ch08/transactions.rs`: 전체 DB snapshot·전역 revision OCC
- `ch09/server.rs`: PostgreSQL v3 simple-query 서버·EXPLAIN

1장의 독립 로그 KV는 [HTML의 참조 구현](../01-log-kv.html)과 `ch01/src/main.rs`가 같습니다. `Cargo.lock`을 포함하며 첫 빌드에는 Cargo 의존성 다운로드 또는 기존 캐시가 필요합니다. 각 검사 빌드는 임시 폴더에서 수행합니다.

```sh
sh check-all.sh
# Rust/Cargo·Bash·Python 3가 필요합니다. 각 check.sh도 독립 실행 가능합니다.
rustc --edition=2024 ch09/server.rs -o /tmp/mydb-server
/tmp/mydb-server serve /tmp/mydb-final 127.0.0.1:55432
```

별도 터미널에서 이미 설치된 psql을 사용합니다. Q 메시지당 SQL 한 문장만 받으므로 `-c 'BEGIN;INSERT...;COMMIT'`처럼 묶지 마세요. 표준 입력은 psql이 문장마다 전송합니다.

```sh
psql -X -At 'host=127.0.0.1 port=55432 user=mydb dbname=mydb sslmode=disable' <<'SQL'
CREATE TABLE people (id INT NOT NULL, name TEXT);
BEGIN;
INSERT INTO people VALUES (1, '한글');
INSERT INTO people VALUES (2, NULL);
COMMIT;
SELECT * FROM people ORDER BY id;
EXPLAIN ANALYZE SELECT * FROM people WHERE id = 1;
SQL
```

서버 종료 후 같은 경로로 재실행하면 커밋 데이터를 복구합니다. 같은 DB 디렉터리는 한 프로세스만 열 수 있습니다. `ch06` 이전 도구로 서버와 같은 디렉터리를 동시에 열지 마세요.

서버는 loopback 데모용으로 TLS·암호 인증·extended query·COPY·취소·psql 역슬래시 메타 명령을 지원하지 않습니다. SQL은 CREATE TABLE·한 행 INSERT·단일 테이블 SELECT와 BEGIN/COMMIT/ROLLBACK입니다. SQL UPDATE/DELETE/JOIN·집계는 없습니다. 명령 실행은 직렬화하고 네트워크 대기 중 DB 잠금은 해제합니다.

7장 WAL은 private workspace/no-steal + redo-only 전체 파일 afterimage입니다. ARIES undo나 실제 행 버전 MVCC는 구현하지 않습니다. 프로세스 크래시 검사는 전원 차단 내구성을 증명하지 않습니다. EXPLAIN의 비용은 모델 단위이고 scan_rows는 논리 행 수입니다. 전체 파일 snapshot 비용은 카운터 밖입니다.

`mydb-source.zip`은 이 폴더의 생성 시점 소스 스냅샷입니다. 파일을 수정했다면 개별 원본이 최신 기준입니다.

마지막 통합 실습은 설치된 psql로 실행합니다. COMMIT 응답 후 강제 종료·복구, ROLLBACK 행 부재, Seq/Index 결과 동등성과 논리 scan_rows를 검증합니다. 기본 check-all은 별도 psql이 필요 없는 소켓 검사를 실행하고, 아래 실습은 선택 실행합니다.

```sh
python3 ch09/capstone.py /tmp/mydb-server
```
