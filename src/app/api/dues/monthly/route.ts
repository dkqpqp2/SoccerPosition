import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

// GET /api/dues/monthly?month=2026-06
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  const [year, mon] = month.split("-").map(Number);
  const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
  const next = new Date(year, mon, 1);
  const endDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;

  // 1차 병렬 조회
  const [
    { data: teamMembers },
    { data: duesSettings },
    { data: memberSettings },
    { data: dueData },
    { data: expenses },
    { data: incomeList },
  ] = await Promise.all([
    supabaseAdmin.from("team_members").select("id, user_id, name").eq("team_id", teamId).eq("is_mercenary", false),
    supabaseAdmin.from("dues_settings").select("*").eq("team_id", teamId).maybeSingle(),
    supabaseAdmin.from("team_member_dues_settings").select("*").eq("team_id", teamId),
    supabaseAdmin
      .from("dues")
      .select("*")
      .eq("team_id", teamId)
      .gte("due_date", startDate)
      .lt("due_date", endDate)
      .maybeSingle(),
    supabaseAdmin.from("dues_expenses").select("*").eq("team_id", teamId).order("used_at", { ascending: false }),
    supabaseAdmin.from("dues_income").select("*").eq("team_id", teamId).order("received_at", { ascending: false }),
  ]);

  const defaultAmount = duesSettings?.default_amount ?? 0;
  const due = dueData ?? null;

  // 이달 납부 기록
  let payments: { user_id: string | null; member_id: string | null; amount: number; paid_at: string }[] = [];
  if (due) {
    const { data: p } = await supabaseAdmin
      .from("dues_payments")
      .select("*")
      .eq("dues_id", due.id);
    payments = p ?? [];
  }

  // 전체 팀 납부 합계 (잔액 계산용) - team_id 기준으로 필터
  const { data: teamDueIds } = await supabaseAdmin
    .from("dues")
    .select("id")
    .eq("team_id", teamId);

  const dueIds = (teamDueIds ?? []).map((d) => d.id);
  const { data: allPayments } =
    dueIds.length > 0
      ? await supabaseAdmin.from("dues_payments").select("amount").in("dues_id", dueIds)
      : { data: [] };

  // 사용자 이름 조회 (계정 있는 멤버만)
  const linkedUserIds = (teamMembers ?? []).filter(m => m.user_id).map(m => m.user_id as string);
  const expenseCreatorIds = (expenses ?? []).map((e) => e.created_by).filter(Boolean);
  const allUserIds = [...new Set([...linkedUserIds, ...expenseCreatorIds])];

  const { data: usersData } =
    allUserIds.length > 0
      ? await supabaseAdmin.from("users").select("id, name").in("id", allUserIds)
      : { data: [] };

  const userMap: Record<string, string> = {};
  (usersData ?? []).forEach((u) => { userMap[u.id] = u.name; });

  // 팀원별 상태 + 납부 현황 조합 (team_members 기반 - 임의 추가 포함)
  const members = (teamMembers ?? []).map((tm) => {
    const isManual = !tm.user_id;
    const setting = !isManual ? (memberSettings ?? []).find((m) => m.user_id === tm.user_id) : null;
    // 임의 추가 멤버는 member_id 컬럼으로, 계정 멤버는 user_id로 납부 기록 조회
    const payment = isManual
      ? payments.find((p) => p.member_id === tm.id)
      : payments.find((p) => p.user_id === tm.user_id);
    const effectiveAmount = setting?.custom_amount ?? defaultAmount;
    const displayName = tm.user_id ? (userMap[tm.user_id] ?? tm.name) : tm.name;
    return {
      user_id: tm.user_id,
      member_id: tm.id,
      name: displayName,
      is_manual: isManual,
      status: setting?.status ?? null,
      custom_amount: setting?.custom_amount ?? null,
      effective_amount: effectiveAmount,
      paid: !!payment,
      paid_at: payment?.paid_at ?? null,
      payment_amount: payment?.amount ?? null,
    };
  });

  // 지출 + 작성자 이름
  const enrichedExpenses = (expenses ?? []).map((e) => ({
    ...e,
    created_by_name: e.created_by ? (userMap[e.created_by] ?? null) : null,
  }));

  // 기타 수입 + 작성자 이름
  const enrichedIncome = (incomeList ?? []).map((inc) => ({
    ...inc,
    created_by_name: inc.created_by ? (userMap[inc.created_by] ?? null) : null,
  }));

  // 잔액 계산
  const initialBalance = duesSettings?.initial_balance ?? 0;
  const totalCollected = (allPayments ?? []).reduce((s, p) => s + p.amount, 0);
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const totalIncome = (incomeList ?? []).reduce((s, inc) => s + inc.amount, 0);

  return NextResponse.json({
    due,
    default_amount: defaultAmount,
    members,
    expenses: enrichedExpenses,
    income: enrichedIncome,
    summary: {
      initial_balance: initialBalance,
      total_collected: totalCollected,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      balance: initialBalance + totalCollected + totalIncome - totalExpenses,
    },
  });
}
