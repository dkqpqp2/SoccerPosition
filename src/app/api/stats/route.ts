import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

/** GET /api/stats?year=2026 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json([], { status: 200 });

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));

  // 현재 유저의 team_members.id 찾기 (list로 받아 첫 번째 사용)
  const { data: myMembers } = userId
    ? await supabaseAdmin
        .from("team_members")
        .select("id")
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .limit(1)
    : { data: null };
  const myMemberId = myMembers?.[0]?.id ?? null;

  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, name")
    .eq("team_id", teamId)
    .eq("is_mercenary", false)
    .order("name");

  if (!members || members.length === 0) return NextResponse.json([]);

  const [{ count: matchCount }, { data: yearStats }] = await Promise.all([
    supabaseAdmin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .gte("match_date", `${year}-01-01`)
      .lte("match_date", `${year}-12-31`),
    supabaseAdmin
      .from("team_year_stats")
      .select("total_matches")
      .eq("team_id", teamId)
      .eq("year", year)
      .single(),
  ]);

  const total = (matchCount ?? 0) + (yearStats?.total_matches ?? 0);

  const { data: statsData } = await supabaseAdmin
    .from("player_stats")
    .select("member_id, goals, assists, games_played")
    .eq("team_id", teamId)
    .eq("year", year);

  const statsMap: Record<string, { goals: number; assists: number; games_played: number }> = {};
  (statsData ?? []).forEach(s => {
    statsMap[s.member_id] = { goals: s.goals, assists: s.assists, games_played: s.games_played };
  });

  return NextResponse.json(
    members.map(m => {
      const gp = statsMap[m.id]?.games_played ?? 0;
      return {
        id:              m.id,
        name:            m.name,
        is_me:           m.id === myMemberId,
        goals:           statsMap[m.id]?.goals   ?? 0,
        assists:         statsMap[m.id]?.assists  ?? 0,
        games_played:    gp,
        total_matches:   total,
        attendance_rate: total > 0 ? Math.round((gp / total) * 100) : 0,
      };
    })
  );
}
