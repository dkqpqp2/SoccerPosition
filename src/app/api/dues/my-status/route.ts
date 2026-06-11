import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

// GET /api/dues/my-status
// 현재 유저의 이번 달 회비 납부 여부 반환
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ paid: null, amount: 0 });

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, mon] = month.split("-").map(Number);
  const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
  const next = new Date(year, mon, 1);
  const endDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;

  // 팀 멤버 여부 확인 (mercenary 제외)
  const { data: memberRow } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("is_mercenary", false)
    .is("left_at", null)
    .maybeSingle();

  if (!memberRow) return NextResponse.json({ paid: null, amount: 0 });

  // 이달 dues
  const { data: due } = await supabaseAdmin
    .from("dues")
    .select("id")
    .eq("team_id", teamId)
    .gte("due_date", startDate)
    .lt("due_date", endDate)
    .maybeSingle();

  // 기본 회비 금액
  const { data: settings } = await supabaseAdmin
    .from("dues_settings")
    .select("default_amount")
    .eq("team_id", teamId)
    .maybeSingle();

  const { data: memberSetting } = await supabaseAdmin
    .from("team_member_dues_settings")
    .select("custom_amount, status")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();

  const defaultAmount = settings?.default_amount ?? 0;
  const effectiveAmount = memberSetting?.custom_amount ?? defaultAmount;

  // 면제 상태면 미납 배너 숨김
  if (memberSetting?.status === "exempt") {
    return NextResponse.json({ paid: true, amount: effectiveAmount, month });
  }

  if (!due) {
    // 이달 dues 항목 자체가 없으면 알림 불필요
    return NextResponse.json({ paid: null, amount: effectiveAmount, month });
  }

  // 납부 기록 확인
  const { data: payment } = await supabaseAdmin
    .from("dues_payments")
    .select("id")
    .eq("dues_id", due.id)
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({
    paid: !!payment,
    amount: effectiveAmount,
    month,
  });
}
