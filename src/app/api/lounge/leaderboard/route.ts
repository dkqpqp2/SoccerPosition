import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";
import { isLoungeEnabled } from "@/lib/lounge";

export const dynamic = "force-dynamic";

/** 올해 전체 경기의 이 비율(%) 이상 출전한 팀원만 순위 후보가 된다 */
const MIN_ATTENDANCE_PERCENT = 30;
const TOP_N = 5;

type Player = { name: string; jersey: number | null; goals: number; assists: number; games: number };
type Row = { name: string; jersey_number: number | null; value: number; games_played: number };
type Board = { rows: Row[]; tied: number }; // tied: 1등과 같은 기록인 사람 수(공동 1위 표시용)

/** 선수 목록 → 득점/도움/참석률 순위판. 후보(전체 경기의 30% 이상 출전)만 포함한다 */
function buildBoards(players: Player[], totalMatches: number) {
  const eligible = totalMatches > 0 ? players.filter(p => p.games * 100 >= totalMatches * MIN_ATTENDANCE_PERCENT) : [];

  const make = (valueOf: (p: Player) => number, positiveOnly: boolean): Board => {
    const sorted = eligible
      .map(p => ({ p, v: valueOf(p) }))
      .filter(x => !positiveOnly || x.v > 0) // 골·도움이 0이면 순위에 올리지 않는다
      .sort((a, b) => b.v - a.v || b.p.games - a.p.games || a.p.name.localeCompare(b.p.name, "ko"));
    const top = sorted[0]?.v;
    return {
      rows: sorted.slice(0, TOP_N).map(x => ({ name: x.p.name, jersey_number: x.p.jersey, value: x.v, games_played: x.p.games })),
      tied: top === undefined ? 0 : sorted.filter(x => x.v === top).length,
    };
  };

  return {
    goals: make(p => p.goals, true),
    assists: make(p => p.assists, true),
    attendance: make(p => Math.round((p.games / totalMatches) * 100), false),
  };
}

function respond(year: number, players: Player[], totalMatches: number, demo = false) {
  return NextResponse.json({
    year,
    totalMatches,
    minGames: Math.ceil((totalMatches * MIN_ATTENDANCE_PERCENT) / 100),
    minPercent: MIN_ATTENDANCE_PERCENT,
    boards: buildBoards(players, totalMatches),
    ...(demo ? { demo: true } : {}),
  });
}

// 로컬 개발에서 로그인 없이 화면을 볼 때만 쓰는 예시 데이터
function demoResponse(year: number) {
  const players: Player[] = [
    { name: "김민수", jersey: 9, goals: 12, assists: 4, games: 18 },
    { name: "이준호", jersey: 10, goals: 9, assists: 11, games: 20 },
    { name: "박지성", jersey: 7, goals: 9, assists: 6, games: 15 },
    { name: "최영훈", jersey: 4, goals: 2, assists: 11, games: 19 },
    { name: "정우성", jersey: 1, goals: 0, assists: 1, games: 20 },
    { name: "한상우", jersey: 11, goals: 20, assists: 0, games: 3 }, // 출전이 적어서 후보에서 빠지는 예
  ];
  return respond(year, players, 20, true);
}

/** GET /api/lounge/leaderboard — 라운지 벽 "명예의 전당"용 득점왕·도움왕·참석왕 */
export async function GET() {
  const isDev = process.env.NODE_ENV === "development";
  const year = new Date().getFullYear();

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    if (isDev) return demoResponse(year);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId || !isLoungeEnabled(teamId)) {
    if (isDev) return demoResponse(year);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const role = await getUserRole(userId, teamId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 현재 정규 팀원만 (나간 팀원·용병 제외). 모든 조회에 team_id 조건.
  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, name, jersey_number")
    .eq("team_id", teamId)
    .eq("is_mercenary", false)
    .eq("stats_excluded", false) // 부상 등으로 통계에서 잠시 뺀 팀원
    .is("left_at", null);
  if (!members?.length) return respond(year, [], 0);

  const { data: yearMatches } = await supabaseAdmin
    .from("matches")
    .select("id")
    .eq("team_id", teamId)
    .gte("match_date", `${year}-01-01`)
    .lte("match_date", `${year}-12-31`);
  const matchIds = (yearMatches ?? []).map(m => m.id as string);

  // 등록 경기에서 자동 집계한 출전·골·어시
  const autoGames: Record<string, number> = {};
  const autoGoals: Record<string, number> = {};
  const autoAssists: Record<string, number> = {};
  if (matchIds.length > 0) {
    const [attendees, matchStats] = await Promise.all([
      supabaseAdmin.from("match_attendees").select("member_id").eq("team_id", teamId).in("match_id", matchIds),
      supabaseAdmin.from("match_stats").select("member_id, goals, assists").eq("team_id", teamId).in("match_id", matchIds),
    ]);
    (attendees.data ?? []).forEach(a => {
      autoGames[a.member_id] = (autoGames[a.member_id] ?? 0) + 1;
    });
    (matchStats.data ?? []).forEach(s => {
      autoGoals[s.member_id] = (autoGoals[s.member_id] ?? 0) + (s.goals ?? 0);
      autoAssists[s.member_id] = (autoAssists[s.member_id] ?? 0) + (s.assists ?? 0);
    });
  }

  // 미등록 경기 수동 입력분(추가 출전·골·어시)과 추가 경기 수
  const [{ data: extra }, { data: yearStats }] = await Promise.all([
    supabaseAdmin.from("player_stats").select("member_id, goals, assists, games_played").eq("team_id", teamId).eq("year", year),
    supabaseAdmin.from("team_year_stats").select("total_matches").eq("team_id", teamId).eq("year", year).limit(1),
  ]);
  const extraMap: Record<string, { goals: number; assists: number; games: number }> = {};
  (extra ?? []).forEach(s => {
    extraMap[s.member_id] = { goals: s.goals ?? 0, assists: s.assists ?? 0, games: s.games_played ?? 0 };
  });
  const totalMatches = matchIds.length + (yearStats?.[0]?.total_matches ?? 0);

  // /api/stats와 같은 합산 방식: 자동 집계 + 수동 입력
  const players: Player[] = members.map(m => ({
    name: m.name as string,
    jersey: (m.jersey_number as number | null) ?? null,
    goals: (autoGoals[m.id] ?? 0) + (extraMap[m.id]?.goals ?? 0),
    assists: (autoAssists[m.id] ?? 0) + (extraMap[m.id]?.assists ?? 0),
    games: (autoGames[m.id] ?? 0) + (extraMap[m.id]?.games ?? 0),
  }));

  return respond(year, players, totalMatches);
}
