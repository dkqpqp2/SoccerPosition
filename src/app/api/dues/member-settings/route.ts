import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageDues } from "@/lib/team";

// PATCH - 팀원 영구 상태 + 금액 설정 (관리자 or 총무)
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageDues(role)) return NextResponse.json({ error: "관리자 또는 총무만 설정할 수 있습니다" }, { status: 403 });

  const { user_id: targetUserId, status, custom_amount } = await req.json();
  if (!targetUserId) return NextResponse.json({ error: "user_id 필요" }, { status: 400 });

  // status, custom_amount 모두 null이면 설정 삭제 (기본값 복원)
  if ((status === null || status === undefined || status === "") && custom_amount === null) {
    await supabaseAdmin
      .from("team_member_dues_settings")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", targetUserId);
    return NextResponse.json({ success: true });
  }

  const upsertData: Record<string, unknown> = { team_id: teamId, user_id: targetUserId };
  if (status !== undefined) upsertData.status = status === "" ? null : status;
  if (custom_amount !== undefined) upsertData.custom_amount = custom_amount;

  const { data, error } = await supabaseAdmin
    .from("team_member_dues_settings")
    .upsert(upsertData, { onConflict: "team_id,user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
