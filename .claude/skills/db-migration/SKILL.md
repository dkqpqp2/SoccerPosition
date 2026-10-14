---
name: db-migration
description: SPM에서 Supabase 테이블·컬럼·DB 함수(RPC)를 새로 만들거나 바꿀 때 사용. 새 테이블에 RLS를 켜고 공개(anon) 키 접근을 막고, 만든 직후 전 테이블을 anon 키로 점검한다. "테이블 추가", "컬럼 추가", "SQL 만들어줘", "RPC/함수 만들기", "RLS", "마이그레이션" 같은 요청에 사용.
---

# DB 변경 절차 (RLS 포함)

공개 키(`NEXT_PUBLIC_SUPABASE_ANON_KEY`)는 브라우저에 노출돼 있다. SQL 에디터로 만든 테이블은 **RLS가 꺼진 채** 생겨서 누구나 전 팀 데이터를 읽고 쓸 수 있다.
(실제로 `tactics_boards`, `tactics_ai_usage`, `notifications`, `team_profiles`가 이 상태였다.)
앱은 서버(`supabaseAdmin`)로만 DB에 접근하므로, **정책 없이 RLS만 켜면** 앱은 그대로 동작하고 공개 키는 막힌다.

## 이 환경의 제약
- Claude는 DB에 DDL을 직접 실행할 수 없다(직접 연결 문자열·CLI 없음). **SQL을 만들어 사용자에게 주고, Supabase SQL 에디터에서 실행하게 한다.**
- 데이터 조회·집계(읽기)는 `.env.local`의 서비스 키로 `node` 스크립트에서 할 수 있다. 쓰기/삭제는 사용자 승인 후에만.

## 절차

1. **SQL 작성** — 새 테이블은 항상 아래 형태로 만든다.
   ```sql
   create table if not exists 새테이블 ( ... );
   alter table 새테이블 enable row level security;   -- 정책은 만들지 않는다(서버 전용)
   ```
   DB 함수(RPC)를 만들면 기본적으로 anon도 실행할 수 있으니 서버 전용이면 막는다.
   ```sql
   revoke execute on function 함수명(인자타입...) from public, anon, authenticated;
   grant  execute on function 함수명(인자타입...) to service_role;
   ```
2. **사용자에게 SQL을 주고 "실행했다"는 답을 기다린다.** 실행 전에 코드를 배포하지 않는다(테이블이 없어 API가 깨짐).
3. **점검 실행** (프로젝트 루트에서):
   ```bash
   node .claude/skills/db-migration/scripts/rls-scan.mjs
   ```
   - 코드에서 `.from("...")`로 쓰는 모든 테이블을 anon 키로 읽어보고 `EXPOSED`가 있으면 실패(종료 코드 1).
   - `empty`(행 0개)·`unknown`(개수 못 읽음)은 이 점검으로 판단 불가 → 아래 SQL로 직접 확인.
4. **RLS는 켰는데도 EXPOSED면** 예전에 만든 "누구나 읽기" 정책이 남아 있는 것이다. 정책 목록을 보고 삭제한다.
   ```sql
   select tablename, policyname, roles, cmd, qual from pg_policies where schemaname = 'public';
   -- 서버 전용 테이블이면 해당 테이블의 정책을 모두 삭제
   ```
   빈 테이블의 RLS 여부는 이렇게 확인한다.
   ```sql
   select tablename, rowsecurity from pg_tables where schemaname = 'public' order by rowsecurity, tablename;
   ```
5. **함수를 만들었다면** anon 키로 호출이 막히는지, 서비스 키로는 되는지 둘 다 확인한다(`permission denied for function`이 나와야 정상).
6. **서버 쪽 동작 확인** — 스크립트의 `서버 접근 오류: 0개`를 확인한다(RLS를 켜도 서비스 키는 영향 없어야 함).

## 함께 지킬 것 (CLAUDE.md 체크리스트와 연결)
- 새 테이블의 모든 쿼리에 `.eq("team_id", teamId)` 필터(멀티 팀 격리).
- 요청 바디의 자식 id(`member_id` 등)가 같은 팀 소속인지 따로 검증.
- 정수형(`int`) 파라미터에 큰 값을 넘기지 말 것 — JS `Number.MAX_SAFE_INTEGER`는 Postgres `integer` 범위를 넘어 오류가 난다(실제로 한 번 겪음).
- 카운터는 "읽고 나서 쓰기" 말고 DB에서 원자적으로 증가(동시 요청 시 한도 초과 방지).

## 보고 형식
- 실행해야 할 SQL 전체(코드 블록 하나)
- 실행 후 점검 결과(EXPOSED 0개, 서버 오류 0개) 또는 남은 문제
