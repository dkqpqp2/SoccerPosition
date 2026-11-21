-- 팀 규칙(team_rules)
-- 라운지 게시판에 걸리는 팀 규칙 글. 팀당 한 줄(글 하나)이고, 관리자급이 쓰고 팀원 모두가 읽는다.
-- 앱은 서버(supabaseAdmin)로만 접근하므로 RLS만 켜고 정책은 만들지 않는다(공개 키로는 읽기·쓰기 모두 막힘).

create table if not exists team_rules (
  team_id     uuid primary key references teams(id) on delete cascade,
  content     text not null default '',
  updated_by  uuid references users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  constraint team_rules_content_len check (char_length(content) <= 3000)
);

alter table team_rules enable row level security;            -- 정책은 만들지 않는다(서버 전용)
