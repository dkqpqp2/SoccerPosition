import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";

/** GET /api/match-stats?matchId=xxx */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json([], { status: 200 });

  const matchId = req.nextUrl.searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("match_stats")
    .select("member_id, goals, assists")
    .eq("match_id", matchId)
    .eq("team_id", teamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/match-stats
 *  body: { match_id, stats: [{ member_id, goals, assists }] }
 *  → 해당 경기의 기존 기록 삭제 후 재삽입 (0 제외)
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const { match_id, stats } = await req.json() as {
    match_id: string;
    stats: { member_id: string; goals: number; assists: number }[];
  };

  if (!match_id || !Array.isArray(stats)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // match_id가 실제 이 팀 소속인지 검증
  const { data: match } = await supabaseAdmin.from("matches").select("id").eq("id", match_id).eq("team_id", teamId).maybeSingle();
  if (!match) return NextResponse.json({ error: "경기를 찾을 수 없어요" }, { status: 404 });

  // 기존 기록 삭제
  await supabaseAdmin
    .from("match_stats")
    .delete()
    .eq("match_id", match_id)
    .eq("team_id", teamId);

  // 골 또는 어시가 1 이상인 것만 저장 (member_id가 실제 이 팀 소속인 것만 허용)
  const nonZero = stats.filter(s => s.goals > 0 || s.assists > 0);
  if (nonZero.length > 0) {
    const { data: validMembers } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .in("id", nonZero.map(s => s.member_id));
    const validIds = new Set((validMembers ?? []).map(m => m.id));
    const rows = nonZero
      .filter(s => validIds.has(s.member_id))
      .map(s => ({
        team_id: teamId,
        match_id,
        member_id: s.member_id,
        goals: s.goals,
        assists: s.assists,
      }));
    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from("match_stats").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
