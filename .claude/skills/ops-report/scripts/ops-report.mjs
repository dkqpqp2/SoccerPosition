// SPM 운영 리포트 — 사용 현황을 숫자(집계)로만 출력. 읽기 전용, 팀원 이름·연락처 같은 개인정보는 출력하지 않음.
// 사용: 프로젝트 루트에서
//   node .claude/skills/ops-report/scripts/ops-report.mjs                 # 전체 + 팀별 요약
//   node .claude/skills/ops-report/scripts/ops-report.mjs --team <팀id>    # 한 팀 상세
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const env = Object.fromEntries(
  readFileSync(join(process.cwd(), ".env.local"), "utf-8")
    .split("\n")
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const teamArg = (() => { const i = process.argv.indexOf("--team"); return i >= 0 ? process.argv[i + 1] : null; })();
const DAY = 24 * 60 * 60 * 1000;
const since30 = new Date(Date.now() - 30 * DAY).toISOString();
const since30Date = since30.slice(0, 10);

async function count(table, build = q => q) {
  const { count: c, error } = await build(db.from(table).select("*", { count: "exact", head: true }));
  if (error) throw new Error(`${table}: ${error.message}`);
  return c ?? 0;
}

// 계정이 연결된 활성 팀원(용병 제외) = 실제로 가입해서 쓰는 사람 수의 기준
const activeMembers = teamId => count("team_members", q => q.eq("team_id", teamId).is("left_at", null).eq("is_mercenary", false).not("user_id", "is", null));

async function teamStats(teamId) {
  const { data: dues } = await db.from("dues").select("id").eq("team_id", teamId);
  const dueIds = (dues ?? []).map(d => d.id);
  const [members, mercs, matches, matches30, assigns, assigns30, tactics, feedbacks, evals, payments, payments30, expenses] = await Promise.all([
    activeMembers(teamId),
    count("team_members", q => q.eq("team_id", teamId).is("left_at", null).eq("is_mercenary", true)),
    count("matches", q => q.eq("team_id", teamId)),
    count("matches", q => q.eq("team_id", teamId).gte("match_date", since30Date)),
    count("position_assignments", q => q.eq("team_id", teamId)),
    count("position_assignments", q => q.eq("team_id", teamId).gte("created_at", since30)),
    count("tactics_boards", q => q.eq("team_id", teamId)),
    count("match_feedbacks", q => q.eq("team_id", teamId)),
    count("member_evaluations", q => q.eq("team_id", teamId)),
    dueIds.length ? count("dues_payments", q => q.in("dues_id", dueIds)) : 0,
    dueIds.length ? count("dues_payments", q => q.in("dues_id", dueIds).gte("paid_at", since30)) : 0,
    count("dues_expenses", q => q.eq("team_id", teamId)),
  ]);
  const first = await db.from("matches").select("match_date").eq("team_id", teamId).order("match_date", { ascending: true }).limit(1);
  const last = await db.from("matches").select("match_date").eq("team_id", teamId).order("match_date", { ascending: false }).limit(1);
  return {
    members, mercs, matches, matches30, assigns, assigns30, tactics, feedbacks, evals,
    dueMonths: dueIds.length, payments, payments30, expenses,
    period: first.data?.[0] ? `${first.data[0].match_date} ~ ${last.data?.[0]?.match_date}` : "-",
  };
}

console.log(`# SPM 운영 리포트 (${new Date().toISOString().slice(0, 10)} 기준, 최근 30일 = ${since30Date} 이후)\n`);

if (teamArg) {
  const { data: team } = await db.from("teams").select("id,name,sport,created_at").eq("id", teamArg).limit(1);
  if (!team?.[0]) {
    console.error("팀을 찾을 수 없어요:", teamArg);
    process.exitCode = 1;
  } else {
    const s = await teamStats(teamArg);
    console.log(`## ${team[0].name} (${team[0].sport ?? "-"}, 생성 ${String(team[0].created_at).slice(0, 10)})`);
    console.log(`- 가입한 활성 팀원(용병 제외): ${s.members}명   / 수동 등록 용병: ${s.mercs}명`);
    console.log(`- 경기: ${s.matches}개 등록 (최근 30일 ${s.matches30}개), 경기 기간 ${s.period}`);
    console.log(`- 포지션 배정: ${s.assigns}건 (최근 30일 ${s.assigns30}건)`);
    console.log(`- 전술판: ${s.tactics}개   경기 피드백: ${s.feedbacks}건   선수 평가: ${s.evals}건`);
    console.log(`- 회비: ${s.dueMonths}개월, 납부 기록 ${s.payments}건 (최근 30일 ${s.payments30}건), 지출 기록 ${s.expenses}건`);
  }
} else {
  const [users, teams, memberRows] = await Promise.all([
    count("users"), count("teams"),
    count("team_members", q => q.is("left_at", null).eq("is_mercenary", false).not("user_id", "is", null)),
  ]);
  console.log("## 전체 (테스트 계정·테스트 팀이 섞여 있어 '실사용자 수'로 쓰면 안 됨)");
  console.log(`- 가입자(users): ${users}명   팀(teams): ${teams}개   가입한 활성 팀원 행: ${memberRows}개\n`);

  const { data: allTeams } = await db.from("teams").select("id,name,sport");
  const rows = [];
  for (const t of allTeams ?? []) {
    const members = await activeMembers(t.id);
    if (members === 0) continue;
    const matches = await count("matches", q => q.eq("team_id", t.id));
    const assigns = await count("position_assignments", q => q.eq("team_id", t.id));
    const assigns30 = await count("position_assignments", q => q.eq("team_id", t.id).gte("created_at", since30));
    rows.push({ id: t.id, name: t.name, members, matches, assigns, assigns30 });
  }
  rows.sort((a, b) => b.matches + b.assigns - (a.matches + a.assigns) || b.members - a.members);
  console.log("## 팀별 요약 (활성 팀원 1명 이상, 활동 많은 순)");
  console.log("팀id(앞8자리)  팀원  경기  배정  배정(30일)  팀이름");
  for (const r of rows) console.log(`${r.id.slice(0, 8).padEnd(13)}  ${String(r.members).padStart(4)}  ${String(r.matches).padStart(4)}  ${String(r.assigns).padStart(4)}  ${String(r.assigns30).padStart(9)}   ${r.name}`);
  console.log(`\n활동 있는 팀(경기 또는 배정 1건 이상): ${rows.filter(r => r.matches + r.assigns > 0).length}개 / 팀원이 있는 팀: ${rows.length}개`);
  console.log("→ 한 팀 상세: node .claude/skills/ops-report/scripts/ops-report.mjs --team <팀id 전체>");
}

console.log("\n※ 집계 숫자만 출력합니다. 사용자 수로 쓸 값은 '가입한 활성 팀원(용병 제외)'이며, 지인 테스트 계정이 일부 섞일 수 있어요.");
