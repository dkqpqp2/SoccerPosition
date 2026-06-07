import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageDues } from "@/lib/team";

// PATCH - 팀원 개인 금액 + 상태 설정
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageDues(role)) return NextResponse.json({ error: "관리자 또는 총무만 설정할 수 있습니다" }, { status: 403 });

  const { id: duesId } = await params;
  const { user_id: targetUserId, custom_amount, status } = await req.json();

  // custom_amount도 null이고 status도 null이면 설정 전체 삭제 (기본값 복원)
  if (custom_amount === null && (status === null || status === undefined)) {
    await supabaseAdmin
      .from("dues_members")
      .delete()
      .eq("dues_id", duesId)
      .eq("user_id", targetUserId);
    return NextResponse.json({ success: true, custom_amount: null, status: null });
  }

  // upsert (status가 null이면 그대로 null 저장)
  const upsertData: Record<string, unknown> = {
    dues_id: duesId,
    user_id: targetUserId,
  };
  if (custom_amount !== undefined) upsertData.custom_amount = custom_amount;
  if (status !== undefined) upsertData.status = status === "" ? null : status;

  const { data, error } = await supabaseAdmin
    .from("dues_members")
    .upsert(upsertData, { onConflict: "dues_id,user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
