-- 선수별 AI 코칭 가이드(member_coaching_guides)
-- 관리자급이 만든 코칭 가이드를 선수당 1개 저장한다(다시 만들면 덮어씀). 관리자급만 읽고 쓴다.
-- 앱은 서버(supabaseAdmin)로만 접근하므로 RLS만 켜고 정책은 만들지 않는다(공개 키로는 읽기·쓰기 모두 막힘).

create table if not exists member_coaching_guides (
  team_id       uuid not null references teams(id) on delete cascade,
  member_id     uuid not null references team_members(id) on delete cascade,
  content       jsonb not null,                       -- { play, avoid, drills[], talk }
  basis_hash    text not null,                        -- 만들 때 쓴 입력(희망 포지션·장점·단점)의 지문. 지금 입력과 다르면 "평가가 바뀌었어요"
  delivered_at  timestamptz,                          -- 선수에게 피드백을 전달했다고 표시한 시각(없으면 아직 전달 전)
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (team_id, member_id)
);

alter table member_coaching_guides enable row level security;   -- 정책은 만들지 않는다(서버 전용)
