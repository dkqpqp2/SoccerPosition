import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageDues } from "@/lib/team";

// GET - 기본 회비 + 초기 잔액 조회
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("dues_settings")
    .select("initial_balance, default_amount")
    .eq("team_id", teamId)
    .maybeSingle();

  return NextResponse.json({
    initial_balance: data?.initial_balance ?? 0,
    default_amount: data?.default_amount ?? 0,
  });
}

// PATCH - 기본 회비 또는 초기 잔액 설정 (관리자 or 총무)
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageDues(role)) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, number> = {};

  if (body.initial_balance !== undefined) updates.initial_balance = body.initial_balance;
  if (body.default_amount !== undefined) updates.default_amount = body.default_amount;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "변경할 값이 없습니다" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString() as unknown as number;

  const { data, error } = await supabaseAdmin
    .from("dues_settings")
    .upsert({ team_id: teamId, ...updates }, { onConflict: "team_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
