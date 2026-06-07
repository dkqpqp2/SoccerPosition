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

  // 현재 유저의 team_members.id
  const { data: myMembers } = userId
    ? await supabaseAdmin
        .from("team_members")
        .select("id")
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .limit(1)
    : { data: null };
  const myMemberId = myMembers?.[0]?.id ?? null;

  // 정규 팀원 목록
  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, name")
    .eq("team_id", teamId)
    .eq("is_mercenary", false)
    .order("name");

  if (!members || members.length === 0) return NextResponse.json([]);

  // 해당 연도 경기 ID 목록
  const { data: yearMatches } = await supabaseAdmin
    .from("matches")
    .select("id")
    .eq("team_id", teamId)
    .gte("match_date", `${year}-01-01`)
    .lte("match_date", `${year}-12-31`);

  const matchIds = (yearMatches ?? []).map(m => m.id);

  // match_attendees 자동 출전 카운트
  const autoCountMap: Record<string, number> = {};
  if (matchIds.length > 0) {
    const { data: attendanceData } = await supabaseAdmin
      .from("match_attendees")
      .select("member_id")
      .eq("team_id", teamId)
      .in("match_id", matchIds);

    (attendanceData ?? []).forEach(a => {
      autoCountMap[a.member_id] = (autoCountMap[a.member_id] ?? 0) + 1;
    });
  }

  // 추가 경기수 (미등록 경기 수동 입력)
  const { data: yearStats } = await supabaseAdmin
    .from("team_year_stats")
    .select("total_matches")
    .eq("team_id", teamId)
    .eq("year", year)
    .single();

  const registeredMatchCount = matchIds.length;
  const extraMatchCount      = yearStats?.total_matches ?? 0;
  const totalMatchCount      = registeredMatchCount + extraMatchCount;

  // match_stats에서 골/어시 자동 집계 (경기관리에서 입력된 것)
  const autoGoalsMap: Record<string, number> = {};
  const autoAssistsMap: Record<string, number> = {};
  if (matchIds.length > 0) {
    const { data: matchStatsData } = await supabaseAdmin
      .from("match_stats")
      .select("member_id, goals, assists")
      .eq("team_id", teamId)
      .in("match_id", matchIds);
    (matchStatsData ?? []).forEach(s => {
      autoGoalsMap[s.member_id]   = (autoGoalsMap[s.member_id]   ?? 0) + s.goals;
      autoAssistsMap[s.member_id] = (autoAssistsMap[s.member_id] ?? 0) + s.assists;
    });
  }

  // player_stats (extra_goals, extra_assists, games_played=추가출전)
  const { data: statsData } = await supabaseAdmin
    .from("player_stats")
    .select("member_id, goals, assists, games_played")
    .eq("team_id", teamId)
    .eq("year", year);

  const statsMap: Record<string, { goals: number; assists: number; extra_games: number }> = {};
  (statsData ?? []).forEach(s => {
    statsMap[s.member_id] = {
      goals:       s.goals,   // 미등록 경기 추가 골
      assists:     s.assists, // 미등록 경기 추가 어시
      extra_games: s.games_played,
    };
  });

  return NextResponse.json(
    members.map(m => {
      const autoGames   = autoCountMap[m.id]    ?? 0;
      const extraGames  = statsMap[m.id]?.extra_games ?? 0;
      const totalGames  = autoGames + extraGames;
      const autoGoals   = autoGoalsMap[m.id]    ?? 0;
      const autoAssists = autoAssistsMap[m.id]  ?? 0;
      const extraGoals   = statsMap[m.id]?.goals   ?? 0;
      const extraAssists = statsMap[m.id]?.assists  ?? 0;
      return {
        id:              m.id,
        name:            m.name,
        is_me:           m.id === myMemberId,
        goals:           autoGoals + extraGoals,
        assists:         autoAssists + extraAssists,
        games_played:    totalGames,
        auto_games:      autoGames,
        extra_games:     extraGames,
        total_matches:   totalMatchCount,
        attendance_rate: totalMatchCount > 0 ? Math.round((totalGames / totalMatchCount) * 100) : 0,
      };
    })
  );
}
