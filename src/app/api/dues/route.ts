import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageDues } from "@/lib/team";
import { sendPushToTeam } from "@/lib/push";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // 1차: dues, team_users, expenses 병렬 조회
  const [
    { data: duesData },
    { data: teamUsers },
    { data: expenses },
  ] = await Promise.all([
    supabaseAdmin.from("dues").select("*").eq("team_id", teamId).order("created_at", { ascending: false }),
    supabaseAdmin.from("team_users").select("user_id").eq("team_id", teamId),
    supabaseAdmin.from("dues_expenses").select("*").eq("team_id", teamId).order("used_at", { ascending: false }),
  ]);

  const dueIds = (duesData ?? []).map((d) => d.id);

  // 2차: dues_members, dues_payments (dueIds 기준)
  const [{ data: duesMembers }, { data: payments }] =
    dueIds.length > 0
      ? await Promise.all([
          supabaseAdmin.from("dues_members").select("*").in("dues_id", dueIds),
          supabaseAdmin.from("dues_payments").select("*").in("dues_id", dueIds),
        ])
      : [{ data: [] }, { data: [] }];

  // 사용자 이름 일괄 조회
  const memberIds = [...new Set((teamUsers ?? []).map((u) => u.user_id))];
  const expenseCreatorIds = (expenses ?? []).map((e) => e.created_by).filter(Boolean);
  const duesCreatorIds = (duesData ?? []).map((d) => d.created_by).filter(Boolean);
  const allUserIds = [...new Set([...memberIds, ...expenseCreatorIds, ...duesCreatorIds])];

  const { data: usersData } =
    allUserIds.length > 0
      ? await supabaseAdmin.from("users").select("id, name").in("id", allUserIds)
      : { data: [] };

  const userMap: Record<string, string> = {};
  (usersData ?? []).forEach((u) => { userMap[u.id] = u.name; });

  // dues 조합
  const result = (duesData ?? []).map((due) => {
    const memberSettings = (duesMembers ?? []).filter((m) => m.dues_id === due.id);
    const duePayments = (payments ?? []).filter((p) => p.dues_id === due.id);

    const members = (teamUsers ?? []).map((tu) => {
      const setting = memberSettings.find((m) => m.user_id === tu.user_id);
      const payment = duePayments.find((p) => p.user_id === tu.user_id);
      const effectiveAmount = setting?.custom_amount ?? due.amount;
      return {
        user_id: tu.user_id,
        name: userMap[tu.user_id] ?? "알 수 없음",
        custom_amount: setting?.custom_amount ?? null,
        effective_amount: effectiveAmount,
        paid: !!payment,
        paid_at: payment?.paid_at ?? null,
        payment_amount: payment?.amount ?? null,
      };
    });

    return {
      ...due,
      members,
      total_collected: duePayments.reduce((sum, p) => sum + p.amount, 0),
      paid_count: duePayments.length,
      total_count: teamUsers?.length ?? 0,
    };
  });

  // expenses 조합
  const enrichedExpenses = (expenses ?? []).map((e) => ({
    ...e,
    created_by_name: e.created_by ? (userMap[e.created_by] ?? null) : null,
  }));

  // 요약
  const totalCollected = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);

  return NextResponse.json({
    dues: result,
    expenses: enrichedExpenses,
    summary: {
      total_collected: totalCollected,
      total_expenses: totalExpenses,
      balance: totalCollected - totalExpenses,
    },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageDues(role)) return NextResponse.json({ error: "관리자 또는 총무만 생성할 수 있습니다" }, { status: 403 });

  const { title, amount, due_date } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "제목은 필수입니다" }, { status: 400 });
  if (!amount || amount <= 0) return NextResponse.json({ error: "금액을 입력해주세요" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("dues")
    .insert({
      team_id: teamId,
      title: title.trim(),
      amount,
      due_date: due_date || null,
      status: "active",
      created_by: userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 푸시 알림 발송
  sendPushToTeam(teamId, {
    title: "회비 납부 요청이 왔어요 💰",
    body: `"${data.title}" ${amount.toLocaleString()}원 납부 요청`,
    url: "/dues",
  }, userId).catch(console.error);

  return NextResponse.json(data);
}
