import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canFeedback } from "@/lib/team";

/** GET /api/members/[id]/evaluation — 관리자급(감독·코치·회장·매니저)만 조회 가능 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canFeedback(role)) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  }

  const { id: memberId } = await params;

  const { data } = await supabaseAdmin
    .from("member_evaluations")
    .select("strengths, weaknesses, notes, ai_recommended_positions, editing_user_id, editing_user_name, editing_at, updated_at")
    .eq("team_id", teamId)
    .eq("member_id", memberId)
    .single();

  return NextResponse.json({
    strengths:  data?.strengths  ?? "",
    weaknesses: data?.weaknesses ?? "",
    notes:      data?.notes      ?? "",
    ai_recommended_positions: data?.ai_recommended_positions ?? [],
    editing_user_id:   data?.editing_user_id   ?? null,
    editing_user_name: data?.editing_user_name ?? null,
    editing_at:        data?.editing_at        ?? null,
    updated_at: data?.updated_at ?? null,
  });
}

/** PUT /api/members/[id]/evaluation */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  // 권한 확인: owner/manager/president/coach
  const { data: tu } = await supabaseAdmin
    .from("team_users")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  const role = tu?.role ?? "";
  if (!["owner", "manager", "president", "coach"].includes(role)) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  }

  const { id: memberId } = await params;
  const { strengths, weaknesses, notes, ai_recommended_positions } = await req.json();

  const { error } = await supabaseAdmin
    .from("member_evaluations")
    .upsert(
      {
        team_id:    teamId,
        member_id:  memberId,
        strengths:  strengths  ?? "",
        weaknesses: weaknesses ?? "",
        notes:      notes      ?? "",
        ai_recommended_positions: Array.isArray(ai_recommended_positions) ? ai_recommended_positions : [],
        editing_user_id: null,
        editing_user_name: null,
        editing_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id,member_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
