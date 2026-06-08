import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageDues } from "@/lib/team";

function getMonthRange(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
  const next = new Date(year, mon, 1);
  const endDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
  return { startDate, endDate, year, mon };
}

const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

// POST - 납부 처리 (dues 자동 생성 포함)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageDues(role)) return NextResponse.json({ error: "관리자 또는 총무만 처리할 수 있습니다" }, { status: 403 });

  const { month, user_id: targetUserId, is_manual } = await req.json();
  if (!month || !targetUserId) return NextResponse.json({ error: "month, user_id 필요" }, { status: 400 });

  const { startDate, endDate, year, mon } = getMonthRange(month);

  // 항상 최신 기본 회비 조회
  const { data: settings } = await supabaseAdmin
    .from("dues_settings")
    .select("default_amount")
    .eq("team_id", teamId)
    .maybeSingle();
  const currentDefault = settings?.default_amount ?? 0;

  // 이 달의 dues 찾기 (없으면 자동 생성)
  const { data: existing } = await supabaseAdmin
    .from("dues")
    .select("id, amount")
    .eq("team_id", teamId)
    .gte("due_date", startDate)
    .lt("due_date", endDate)
    .maybeSingle();

  let dueId: string;
  const dueAmount = currentDefault; // 항상 최신 default_amount 사용

  if (existing) {
    dueId = existing.id;
    // dues.amount가 현재 기본 회비와 다르면 동기화 (초기화 후 재설정 케이스)
    if (existing.amount !== currentDefault) {
      await supabaseAdmin
        .from("dues")
        .update({ amount: currentDefault })
        .eq("id", existing.id);
    }
  } else {
    // 신규 생성
    const { data: newDue, error: dueErr } = await supabaseAdmin
      .from("dues")
      .insert({
        team_id: teamId,
        title: `${year}년 ${MONTH_NAMES[mon - 1]} 회비`,
        amount: currentDefault,
        due_date: startDate,
        status: "active",
        created_by: userId,
      })
      .select()
      .single();

    if (dueErr || !newDue) return NextResponse.json({ error: "dues 생성 실패" }, { status: 500 });
    dueId = newDue.id;
  }

  // 이 멤버의 실제 납부 금액 (개인 설정 > 기본 금액) - 임의 추가 멤버는 설정 없음
  let amount = dueAmount;
  if (!is_manual) {
    const { data: memberSetting } = await supabaseAdmin
      .from("team_member_dues_settings")
      .select("custom_amount")
      .eq("team_id", teamId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    amount = memberSetting?.custom_amount ?? dueAmount;
  }

  let payError;
  if (is_manual) {
    // 임의 추가 멤버: member_id 컬럼 사용
    // partial index는 onConflict upsert가 안 되므로 수동 체크
    const { data: existing } = await supabaseAdmin
      .from("dues_payments")
      .select("id")
      .eq("dues_id", dueId)
      .eq("member_id", targetUserId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("dues_payments")
        .update({ amount, recorded_by: userId })
        .eq("id", existing.id);
      payError = error;
    } else {
      const { error } = await supabaseAdmin
        .from("dues_payments")
        .insert({ dues_id: dueId, member_id: targetUserId, amount, recorded_by: userId });
      payError = error;
    }
  } else {
    // 계정 있는 멤버: user_id 컬럼 사용
    const { error } = await supabaseAdmin
      .from("dues_payments")
      .upsert(
        { dues_id: dueId, user_id: targetUserId, amount, recorded_by: userId },
        { onConflict: "dues_id,user_id" }
      );
    payError = error;
  }

  if (payError) return NextResponse.json({ error: payError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE - 납부 취소
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageDues(role)) return NextResponse.json({ error: "관리자 또는 총무만 처리할 수 있습니다" }, { status: 403 });

  const { month, user_id: targetUserId, is_manual } = await req.json();
  if (!month || !targetUserId) return NextResponse.json({ error: "month, user_id 필요" }, { status: 400 });

  const { startDate, endDate } = getMonthRange(month);

  const { data: due } = await supabaseAdmin
    .from("dues")
    .select("id")
    .eq("team_id", teamId)
    .gte("due_date", startDate)
    .lt("due_date", endDate)
    .maybeSingle();

  if (!due) return NextResponse.json({ success: true }); // 이미 없음

  let delError;
  if (is_manual) {
    const { error } = await supabaseAdmin
      .from("dues_payments")
      .delete()
      .eq("dues_id", due.id)
      .eq("member_id", targetUserId);
    delError = error;
  } else {
    const { error } = await supabaseAdmin
      .from("dues_payments")
      .delete()
      .eq("dues_id", due.id)
      .eq("user_id", targetUserId);
    delError = error;
  }

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
