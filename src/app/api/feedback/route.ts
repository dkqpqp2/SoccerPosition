import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canFeedback } from "@/lib/team";

/** 피드백 조회 (match_id 기준) */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const matchId = req.nextUrl.searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

  // 경기 + 배정 정보
  const { data: match } = await supabaseAdmin
    .from("matches")
    .select("*, position_assignments(*)")
    .eq("id", matchId)
    .eq("team_id", teamId)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  // 기존 피드백
  const { data: feedback } = await supabaseAdmin
    .from("match_feedbacks")
    .select("*")
    .eq("match_id", matchId)
    .eq("team_id", teamId)
    .single();

  // 쿼터별 선수 추출 (배정 순서대로)
  type QuarterPlayers = {
    session_id: string;
    session_name: string;
    players: { member_id: string; name: string; positions: string[] }[];
  };


  const assignments = [...(match.position_assignments ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // 배정된 멤버 용병 정보 조회
  const allMemberIds = new Set<string>();
  for (const a of assignments) {
    const result: Record<string, { id: string } | null> = a.result ?? {};
    for (const m of Object.values(result)) {
      if (m?.id) allMemberIds.add(m.id);
    }
  }

  const memberInfoMap: Record<string, { is_mercenary: boolean }> = {};
  if (allMemberIds.size > 0) {
    const { data: memberRows } = await supabaseAdmin
      .from("team_members")
      .select("id, is_mercenary")
      .in("id", [...allMemberIds]);
    for (const row of memberRows ?? []) {
      memberInfoMap[row.id] = { is_mercenary: !!row.is_mercenary };
    }
  }

  const quarters: QuarterPlayers[] = assignments.map(a => {
    const slots: { id: string; label: string }[] = a.formation_slots ?? [];
    const result: Record<string, { id: string; name: string } | null> = a.result ?? {};
    const playerMap: Record<string, { member_id: string; name: string; positions: string[] }> = {};

    for (const slot of slots) {
      const member = result[slot.id];
      if (member) {
        const info = memberInfoMap[member.id];
        // 용병 제외
        if (info?.is_mercenary) continue;
        if (!playerMap[member.id]) {
          playerMap[member.id] = { member_id: member.id, name: member.name, positions: [] };
        }
        if (!playerMap[member.id].positions.includes(slot.label)) {
          playerMap[member.id].positions.push(slot.label);
        }
      }
    }

    return {
      session_id: a.id,
      session_name: a.session_name,
      players: Object.values(playerMap),
    };
  });

  return NextResponse.json({
    match,
    quarters,
    feedback: feedback ?? null,
    can_feedback: canFeedback(await getUserRole(userId, teamId)),
  });
}

/** 피드백 저장 (upsert) */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canFeedback(role)) {
    return NextResponse.json({ error: "피드백 작성 권한이 없어요." }, { status: 403 });
  }

  const { match_id, team_feedback, quarter_feedbacks } = await req.json();
  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("match_feedbacks")
    .upsert(
      {
        match_id,
        team_id: teamId,
        author_id: userId,
        team_feedback: team_feedback ?? null,
        player_feedbacks: quarter_feedbacks ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "match_id,team_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
