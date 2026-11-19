-- 팀 라운지 방(lounge_rooms)
-- 관리자급이 방을 열면 최대 24시간 동안 열려 있고, 강제로 닫을 수 있다. 접속 인원과 상관없이 서버에 남는 "방 상태"다.
-- 앱은 서버(supabaseAdmin)로만 접근하므로 RLS만 켜고 정책은 만들지 않는다(공개 키로는 읽기·쓰기 모두 막힘).

create table if not exists lounge_rooms (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  closed_at   timestamptz,                                   -- 관리자가 닫았거나 만료돼서 정리된 시각 (null이면 아직 닫힘 표시 없음)
  closed_by   uuid references users(id) on delete set null,
  constraint lounge_rooms_expires_after_created check (expires_at > created_at)
);

-- 팀당 "닫히지 않은" 방은 하나만: 두 관리자가 동시에 열어도 방이 둘 생기지 않는다.
-- (만료됐지만 아직 closed_at이 비어 있는 방은 서버가 새 방을 만들기 전에 먼저 닫아 준다)
create unique index if not exists lounge_rooms_one_open_per_team
  on lounge_rooms (team_id)
  where closed_at is null;

create index if not exists lounge_rooms_team_created_idx
  on lounge_rooms (team_id, created_at desc);

alter table lounge_rooms enable row level security;          -- 정책은 만들지 않는다(서버 전용)
