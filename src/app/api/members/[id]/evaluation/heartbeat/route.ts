import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

/** POST /api/members/[id]/evaluation/heartbeat — "작성 중" 상태 갱신 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

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

  const { data: memberRow } = await supabaseAdmin
    .from("team_members")
    .select("name")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();

  const { id: memberId } = await params;

  const { error } = await supabaseAdmin
    .from("member_evaluations")
    .upsert(
      {
        team_id: teamId,
        member_id: memberId,
        editing_user_id: session.user.id,
        editing_user_name: memberRow?.name ?? "다른 관리자",
        editing_at: new Date().toISOString(),
      },
      { onConflict: "team_id,member_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
