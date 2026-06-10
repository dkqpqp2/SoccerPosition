import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (role !== "owner" && role !== "treasurer") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const { month } = await req.json();
  if (!month) return NextResponse.json({ error: "month is required" }, { status: 400 });

  const [year, mon] = month.split("-").map(Number);
  const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
  const next = new Date(year, mon, 1);
  const endDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;

  // 이달 dues 레코드 조회
  const { data: due } = await supabaseAdmin
    .from("dues")
    .select("id")
    .eq("team_id", teamId)
    .gte("due_date", startDate)
    .lt("due_date", endDate)
    .maybeSingle();

  // 활성 정규 팀원 (user_id 있는 사람만)
  const { data: teamMembers } = await supabaseAdmin
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("is_mercenary", false)
    .is("left_at", null)
    .not("user_id", "is", null);

  if (!teamMembers?.length) return NextResponse.json({ sent: 0 });

  // 납부 완료한 user_id 목록
  let paidUserIds: Set<string> = new Set();
  if (due) {
    const { data: payments } = await supabaseAdmin
      .from("dues_payments")
      .select("user_id")
      .eq("dues_id", due.id)
      .not("user_id", "is", null);
    (payments ?? []).forEach(p => { if (p.user_id) paidUserIds.add(p.user_id); });
  }

  const unpaidUserIds = teamMembers
    .map(m => m.user_id as string)
    .filter(uid => !paidUserIds.has(uid));

  if (!unpaidUserIds.length) return NextResponse.json({ sent: 0 });

  // 기본 회비 금액
  const { data: settings } = await supabaseAdmin
    .from("dues_settings")
    .select("default_amount")
    .eq("team_id", teamId)
    .maybeSingle();

  const defaultAmount = settings?.default_amount ?? 0;
  const monthLabel = `${year}년 ${mon}월`;

  const notifications = unpaidUserIds.map(uid => ({
    user_id: uid,
    type: "dues_request",
    title: "💰 회비 납부 요청",
    body: `${monthLabel} 회비${defaultAmount > 0 ? `(${defaultAmount.toLocaleString("ko-KR")}원)` : ""}가 아직 납부되지 않았어요.`,
    link: "/dues",
    is_read: false,
  }));

  await supabaseAdmin.from("notifications").insert(notifications);

  return NextResponse.json({ sent: unpaidUserIds.length });
}
