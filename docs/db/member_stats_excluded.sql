-- 팀원 관리에서 "골·어시 통계에서 잠시 제외"(부상 등) 표시를 저장하는 컬럼.
-- 새 테이블이 아니라서 RLS 설정은 따로 필요 없다 (team_members는 이미 서버 전용).
alter table team_members
  add column if not exists stats_excluded boolean not null default false;
