import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, isOwner } from "@/lib/team";

// TODO: 내전 기능 테스트 중 — 지금은 owner에게만 공개. 정식 오픈 시 이 체크 제거
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json([]);

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) return NextResponse.json([]);

  const { data: scrimmages } = await supabaseAdmin.from("scrimmages").select("id").eq("team_id", teamId);
  const scrimmageIds = (scrimmages ?? []).map(s => s.id);
  if (scrimmageIds.length === 0) return NextResponse.json([]);

  const { data: stats, error } = await supabaseAdmin
    .from("scrimmage_stats")
    .select("member_id, goals, assists")
    .in("scrimmage_id", scrimmageIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!stats?.length) return NextResponse.json([]);

  const totals: Record<string, { goals: number; assists: number }> = {};
  for (const s of stats) {
    if (!totals[s.member_id]) totals[s.member_id] = { goals: 0, assists: 0 };
    totals[s.member_id].goals += s.goals;
    totals[s.member_id].assists += s.assists;
  }

  const memberIds = Object.keys(totals);
  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, name")
    .in("id", memberIds);

  const nameMap: Record<string, string> = {};
  (members ?? []).forEach(m => { nameMap[m.id] = m.name; });

  const leaderboard = memberIds
    .map(id => ({ member_id: id, name: nameMap[id] ?? "알 수 없음", goals: totals[id].goals, assists: totals[id].assists }))
    .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists) || b.goals - a.goals);

  return NextResponse.json(leaderboard);
}
