import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageScrimmage } from "@/lib/team";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const [{ data: league }, { data: leagueSquads }, { data: leagueSquadMembers }, { data: roster }, { data: rounds }] = await Promise.all([
    supabaseAdmin.from("scrimmage_leagues").select("*").eq("id", id).eq("team_id", teamId).single(),
    supabaseAdmin.from("scrimmage_league_squads").select("*").eq("league_id", id).order("sort_order", { ascending: true }),
    supabaseAdmin.from("scrimmage_league_squad_members").select("squad_id, member_id").eq("league_id", id),
    supabaseAdmin
      .from("team_members")
      .select("id, user_id, name, position_1st, position_2nd, jersey_number, is_mercenary, is_cafe_mercenary, referrer")
      .eq("team_id", teamId)
      .is("left_at", null)
      .order("name", { ascending: true }),
    supabaseAdmin.from("scrimmages").select("id, title, match_date, league_round, created_at").eq("league_id", id).order("league_round", { ascending: true }),
  ]);

  if (!league) return NextResponse.json({ error: "리그를 찾을 수 없어요" }, { status: 404 });

  const roundIds = (rounds ?? []).map(r => r.id);

  let standingsBySquad: Record<string, { w: number; d: number; l: number; gf: number; ga: number; pts: number }> = {};
  let leaderboard: { member_id: string; name: string; goals: number; assists: number }[] = [];

  if (roundIds.length > 0) {
    const [{ data: roundSquads }, { data: fixtures }, { data: stats }] = await Promise.all([
      supabaseAdmin.from("scrimmage_squads").select("id, league_squad_id").in("scrimmage_id", roundIds),
      supabaseAdmin.from("scrimmage_fixtures").select("squad_a_id, squad_b_id, score_a, score_b").in("scrimmage_id", roundIds),
      supabaseAdmin.from("scrimmage_stats").select("member_id, goals, assists").in("scrimmage_id", roundIds),
    ]);

    const squadToLeagueSquad: Record<string, string> = {};
    (roundSquads ?? []).forEach(s => { if (s.league_squad_id) squadToLeagueSquad[s.id] = s.league_squad_id; });

    for (const ls of leagueSquads ?? []) standingsBySquad[ls.id] = { w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };

    for (const f of fixtures ?? []) {
      if (f.score_a === null || f.score_b === null) continue;
      const la = squadToLeagueSquad[f.squad_a_id];
      const lb = squadToLeagueSquad[f.squad_b_id];
      const a = la ? standingsBySquad[la] : undefined;
      const b = lb ? standingsBySquad[lb] : undefined;
      if (!a || !b) continue;
      a.gf += f.score_a; a.ga += f.score_b;
      b.gf += f.score_b; b.ga += f.score_a;
      if (f.score_a > f.score_b) { a.w++; a.pts += 3; b.l++; }
      else if (f.score_a < f.score_b) { b.w++; b.pts += 3; a.l++; }
      else { a.d++; b.d++; a.pts++; b.pts++; }
    }

    const totals: Record<string, { goals: number; assists: number }> = {};
    for (const s of stats ?? []) {
      if (!totals[s.member_id]) totals[s.member_id] = { goals: 0, assists: 0 };
      totals[s.member_id].goals += s.goals;
      totals[s.member_id].assists += s.assists;
    }
    const memberIds = Object.keys(totals);
    if (memberIds.length > 0) {
      const { data: members } = await supabaseAdmin.from("team_members").select("id, name").eq("team_id", teamId).in("id", memberIds);
      const nameMap: Record<string, string> = {};
      (members ?? []).forEach(m => { nameMap[m.id] = m.name; });
      leaderboard = memberIds
        .map(mid => ({ member_id: mid, name: nameMap[mid] ?? "알 수 없음", goals: totals[mid].goals, assists: totals[mid].assists }))
        .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists) || b.goals - a.goals);
    }
  } else {
    for (const ls of leagueSquads ?? []) standingsBySquad[ls.id] = { w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  }

  const standings = (leagueSquads ?? [])
    .map(ls => ({ squad_id: ls.id, name: ls.name, ...standingsBySquad[ls.id] }))
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));

  return NextResponse.json({
    league,
    squads: leagueSquads ?? [],
    squad_members: leagueSquadMembers ?? [],
    roster: roster ?? [],
    rounds: rounds ?? [],
    standings,
    leaderboard,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageScrimmage(role)) return NextResponse.json({ error: "관리자·매니저·회장만 삭제할 수 있어요" }, { status: 403 });

  const { error } = await supabaseAdmin.from("scrimmage_leagues").delete().eq("id", id).eq("team_id", teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
