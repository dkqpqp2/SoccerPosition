import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canFeedback } from "@/lib/team";

/** GET /api/members/evaluations — 팀 전체 장단점 조회, 관리자급만 가능 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json([]);
  if (!userId) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const role = await getUserRole(userId, teamId);
  if (!canFeedback(role)) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  }

  // 정규 팀원 목록
  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, name, position_1st, position_2nd")
    .eq("team_id", teamId)
    .eq("is_mercenary", false)
    .order("name");

  if (!members || members.length === 0) return NextResponse.json([]);

  // 장단점 전체 조회
  const { data: evals } = await supabaseAdmin
    .from("member_evaluations")
    .select("member_id, strengths, weaknesses, notes, updated_at")
    .eq("team_id", teamId);

  const evalMap = Object.fromEntries(
    (evals ?? []).map(e => [e.member_id, e])
  );

  return NextResponse.json(
    members.map(m => ({
      id:           m.id,
      name:         m.name,
      position_1st: m.position_1st,
      position_2nd: m.position_2nd,
      strengths:    evalMap[m.id]?.strengths  ?? "",
      weaknesses:   evalMap[m.id]?.weaknesses ?? "",
      notes:        evalMap[m.id]?.notes      ?? "",
      updated_at:   evalMap[m.id]?.updated_at ?? null,
    }))
  );
}
