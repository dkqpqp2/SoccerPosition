import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageScrimmage } from "@/lib/team";

// POST - 새 회차(매치데이) 생성. 리그의 고정 팀·인원을 그대로 복사해서 새 내전을 만듦
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageScrimmage(role)) return NextResponse.json({ error: "관리자·매니저·회장만 회차를 만들 수 있어요" }, { status: 403 });

  const { match_date } = await req.json();

  const [{ data: league }, { data: leagueSquads }, { data: leagueSquadMembers }, { data: existingRounds }] = await Promise.all([
    supabaseAdmin.from("scrimmage_leagues").select("*").eq("id", id).eq("team_id", teamId).single(),
    supabaseAdmin.from("scrimmage_league_squads").select("*").eq("league_id", id).order("sort_order", { ascending: true }),
    supabaseAdmin.from("scrimmage_league_squad_members").select("squad_id, member_id").eq("league_id", id),
    supabaseAdmin.from("scrimmages").select("league_round").eq("league_id", id).order("league_round", { ascending: false }).limit(1),
  ]);

  if (!league) return NextResponse.json({ error: "리그를 찾을 수 없어요" }, { status: 404 });
  if (!leagueSquads || leagueSquads.length === 0) return NextResponse.json({ error: "리그에 팀이 없어요" }, { status: 400 });

  const nextRound = (existingRounds?.[0]?.league_round ?? 0) + 1;

  const { data: scrimmage, error: scrimmageError } = await supabaseAdmin
    .from("scrimmages")
    .insert({
      team_id: teamId,
      title: `${league.title} ${nextRound}회차`,
      sport: league.sport,
      match_date: match_date || null,
      squad_count: leagueSquads.length,
      created_by: userId,
      league_id: id,
      league_round: nextRound,
    })
    .select()
    .single();

  if (scrimmageError || !scrimmage) return NextResponse.json({ error: scrimmageError?.message ?? "생성 실패" }, { status: 500 });

  // 리그의 고정 팀을 이번 회차용으로 복사
  const { data: roundSquads, error: squadError } = await supabaseAdmin
    .from("scrimmage_squads")
    .insert(
      leagueSquads.map(ls => ({
        scrimmage_id: scrimmage.id,
        name: ls.name,
        color: ls.color,
        captain_member_id: ls.captain_member_id,
        sort_order: ls.sort_order,
        league_squad_id: ls.id,
      }))
    )
    .select();

  if (squadError || !roundSquads) {
    await supabaseAdmin.from("scrimmages").delete().eq("id", scrimmage.id);
    return NextResponse.json({ error: squadError?.message ?? "생성 실패" }, { status: 500 });
  }

  // 리그 소속 인원 전원을 이번 회차 출석으로 기본 복사 (결석자는 회차 화면에서 배정 해제하면 됨)
  const leagueSquadIdToRoundSquadId: Record<string, string> = {};
  roundSquads.forEach(rs => { if (rs.league_squad_id) leagueSquadIdToRoundSquadId[rs.league_squad_id] = rs.id; });

  const roundMembers = (leagueSquadMembers ?? [])
    .map(m => {
      const roundSquadId = leagueSquadIdToRoundSquadId[m.squad_id];
      return roundSquadId ? { scrimmage_id: scrimmage.id, squad_id: roundSquadId, member_id: m.member_id } : null;
    })
    .filter((m): m is { scrimmage_id: string; squad_id: string; member_id: string } => m !== null);

  if (roundMembers.length > 0) {
    const { error: memberError } = await supabaseAdmin.from("scrimmage_squad_members").insert(roundMembers);
    if (memberError) {
      await supabaseAdmin.from("scrimmages").delete().eq("id", scrimmage.id);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }
  }

  // 스쿼드 간 맞대결 라운드로빈 자동 생성
  const sortedSquads = [...roundSquads].sort((a, b) => a.sort_order - b.sort_order);
  const fixtures: { scrimmage_id: string; squad_a_id: string; squad_b_id: string; sort_order: number }[] = [];
  for (let i = 0; i < sortedSquads.length; i++) {
    for (let j = i + 1; j < sortedSquads.length; j++) {
      fixtures.push({ scrimmage_id: scrimmage.id, squad_a_id: sortedSquads[i].id, squad_b_id: sortedSquads[j].id, sort_order: fixtures.length });
    }
  }
  const { error: fixtureError } = await supabaseAdmin.from("scrimmage_fixtures").insert(fixtures);
  if (fixtureError) {
    await supabaseAdmin.from("scrimmages").delete().eq("id", scrimmage.id);
    return NextResponse.json({ error: fixtureError.message }, { status: 500 });
  }

  return NextResponse.json(scrimmage);
}
