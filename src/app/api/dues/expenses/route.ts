import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageDues } from "@/lib/team";

// POST - 지출 내역 추가
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageDues(role)) return NextResponse.json({ error: "관리자 또는 총무만 추가할 수 있습니다" }, { status: 403 });

  const { title, amount, category, used_at, memo } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "제목은 필수입니다" }, { status: 400 });
  if (!amount || amount <= 0) return NextResponse.json({ error: "금액을 입력해주세요" }, { status: 400 });
  if (!used_at) return NextResponse.json({ error: "날짜를 입력해주세요" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("dues_expenses")
    .insert({
      team_id: teamId,
      title: title.trim(),
      amount,
      category: category || "기타",
      used_at,
      memo: memo?.trim() || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
