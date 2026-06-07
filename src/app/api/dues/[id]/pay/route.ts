import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageDues } from "@/lib/team";

// POST - 납부 처리
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageDues(role)) return NextResponse.json({ error: "관리자 또는 총무만 처리할 수 있습니다" }, { status: 403 });

  const { id: duesId } = await params;
  const { user_id: targetUserId } = await req.json();

  // 실제 납부 금액 계산 (개인 설정 > 기본 금액)
  const [{ data: setting }, { data: due }] = await Promise.all([
    supabaseAdmin
      .from("dues_members")
      .select("custom_amount")
      .eq("dues_id", duesId)
      .eq("user_id", targetUserId)
      .maybeSingle(),
    supabaseAdmin.from("dues").select("amount").eq("id", duesId).single(),
  ]);

  if (!due) return NextResponse.json({ error: "회비 항목을 찾을 수 없습니다" }, { status: 404 });

  const amount = setting?.custom_amount ?? due.amount;

  const { data, error } = await supabaseAdmin
    .from("dues_payments")
    .upsert(
      { dues_id: duesId, user_id: targetUserId, amount, recorded_by: userId },
      { onConflict: "dues_id,user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE - 납부 취소
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageDues(role)) return NextResponse.json({ error: "관리자 또는 총무만 처리할 수 있습니다" }, { status: 403 });

  const { id: duesId } = await params;
  const { user_id: targetUserId } = await req.json();

  const { error } = await supabaseAdmin
    .from("dues_payments")
    .delete()
    .eq("dues_id", duesId)
    .eq("user_id", targetUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
