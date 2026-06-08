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
  return { startDate, endDate };
}

// POST - 기본 회비 초기화 + 해당 월 납부 기록 전체 삭제
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageDues(role)) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { month } = await req.json();
  if (!month) return NextResponse.json({ error: "month 필요" }, { status: 400 });

  const { startDate, endDate } = getMonthRange(month);

  // 1. 기본 회비 0으로 초기화
  await supabaseAdmin
    .from("dues_settings")
    .upsert({ team_id: teamId, default_amount: 0 }, { onConflict: "team_id" });

  // 1-1. 팀원 개인 custom_amount 설정도 초기화
  await supabaseAdmin
    .from("team_member_dues_settings")
    .update({ custom_amount: null })
    .eq("team_id", teamId);

  // 2. 해당 월 dues 기록 조회
  const { data: due } = await supabaseAdmin
    .from("dues")
    .select("id")
    .eq("team_id", teamId)
    .gte("due_date", startDate)
    .lt("due_date", endDate)
    .maybeSingle();

  // 3. 해당 월 납부 기록 전체 삭제
  if (due) {
    await supabaseAdmin
      .from("dues_payments")
      .delete()
      .eq("dues_id", due.id);

    // 4. dues 금액도 0으로 초기화
    await supabaseAdmin
      .from("dues")
      .update({ amount: 0 })
      .eq("id", due.id);
  }

  return NextResponse.json({ success: true });
}
