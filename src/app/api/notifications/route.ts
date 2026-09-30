import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

// GET - 내 알림 목록 (현재 활성 팀 소속 알림만 — 팀 무관 레거시 알림도 함께 노출)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId) return NextResponse.json([]);

  let query = supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", userId);

  // team_id가 없는 옛 알림(마이그레이션 이전)은 계속 보이게, 그 외엔 현재 활성 팀 것만
  query = teamId ? query.or(`team_id.eq.${teamId},team_id.is.null`) : query.is("team_id", null);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// PATCH - 전체 읽음 처리 (현재 활성 팀 기준)
export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId) return NextResponse.json({ ok: true });

  let query = supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  query = teamId ? query.or(`team_id.eq.${teamId},team_id.is.null`) : query.is("team_id", null);

  await query;

  return NextResponse.json({ ok: true });
}
