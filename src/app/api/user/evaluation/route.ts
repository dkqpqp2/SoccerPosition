import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

/** GET /api/user/evaluation — 내 평가 조회 (마이페이지용) */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  // 내 team_members 행 찾기
  const { data: myMember } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!myMember) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("member_evaluations")
    .select("strengths, weaknesses, notes, ai_recommended_positions, updated_at")
    .eq("team_id", teamId)
    .eq("member_id", myMember.id)
    .maybeSingle();

  return NextResponse.json(data ?? null);
}
