import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";

/** GET /api/player-stats?year=2026 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json({ members: [], registered_matches: 0, extra_matches: 0, total_matches: 0 });

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));

  // 정규 팀원 목록
  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, name")
    .eq("team_id", teamId)
    .eq("is_mercenary", false)
    .order("name");

  if (!members || members.length === 0) {
    return NextResponse.json({ members: [], registered_matches: 0, extra_matches: 0, total_matches: 0 });
  }

  // 등록 경기 ID 목록 (자동)
  const { data: yearMatches } = await supabaseAdmin
    .from("matches")
    .select("id")
    .eq("team_id", teamId)
    .gte("match_date", `${year}-01-01`)
    .lte("match_date", `${year}-12-31`);

  const matchIds  = (yearMatches ?? []).map(m => m.id);
  const registered = matchIds.length;

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

  // 추가 경기수 (미등록)
  const { data: yearStats } = await supabaseAdmin
    .from("team_year_stats")
    .select("total_matches")
    .eq("team_id", teamId)
    .eq("year", year)
    .single();

  const extra = yearStats?.total_matches ?? 0;
  const total = registered + extra;

  // 선수별 골/어시/추가출전
  const { data: statsData } = await supabaseAdmin
    .from("player_stats")
    .select("member_id, goals, assists, games_played")
    .eq("team_id", teamId)
    .eq("year", year);

  const statsMap: Record<string, { goals: number; assists: number; extra_games: number }> = {};
  (statsData ?? []).forEach(s => {
    statsMap[s.member_id] = {
      goals:       s.goals,
      assists:     s.assists,
      extra_games: s.games_played,
    };
  });

  return NextResponse.json({
    registered_matches: registered,
    extra_matches:      extra,
    total_matches:      total,
    members: members.map(m => {
      const autoGames  = autoCountMap[m.id]  ?? 0;
      const extraGames = statsMap[m.id]?.extra_games ?? 0;
      const totalGames = autoGames + extraGames;
      return {
        id:           m.id,
        name:         m.name,
        goals:        statsMap[m.id]?.goals   ?? 0,
        assists:      statsMap[m.id]?.assists  ?? 0,
        auto_games:   autoGames,
        extra_games:  extraGames,
        games_played: totalGames,
        attendance_rate: total > 0 ? Math.round((totalGames / total) * 100) : 0,
      };
    }),
  });
}

/** POST /api/player-stats
 *  body: { year, extra_matches, entries: [{ member_id, goals, assists, extra_games }] }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (role !== "owner" && role !== "manager" && role !== "president") {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  }

  const { year, extra_matches, entries } = await req.json() as {
    year: number;
    extra_matches: number;
    entries: { member_id: string; goals: number; assists: number; extra_games: number }[];
  };

  if (!year || !Array.isArray(entries)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // 추가 경기수 저장
  await supabaseAdmin
    .from("team_year_stats")
    .upsert(
      { team_id: teamId, year, total_matches: extra_matches ?? 0, updated_at: new Date().toISOString() },
      { onConflict: "team_id,year" }
    );

  // 선수별 통계 저장 (games_played = extra_games)
  if (entries.length > 0) {
    const rows = entries.map(e => ({
      team_id:      teamId,
      member_id:    e.member_id,
      year,
      goals:        e.goals,
      assists:      e.assists,
      games_played: e.extra_games,  // extra_games → games_played 컬럼에 저장
      updated_at:   new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin
      .from("player_stats")
      .upsert(rows, { onConflict: "team_id,member_id,year" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
