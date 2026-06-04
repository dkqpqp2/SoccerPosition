import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "spm-admin-2024";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 전체 유저
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, name, email, image, created_at")
    .order("created_at", { ascending: false });

  // 전체 팀 수
  const { count: teamCount } = await supabaseAdmin
    .from("teams")
    .select("*", { count: "exact", head: true });

  // 전체 팀원 수
  const { count: memberCount } = await supabaseAdmin
    .from("team_members")
    .select("*", { count: "exact", head: true });

  // 전체 경기 수
  const { count: matchCount } = await supabaseAdmin
    .from("matches")
    .select("*", { count: "exact", head: true });

  // 날짜별 가입자 (최근 30일)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentUsers } = await supabaseAdmin
    .from("users")
    .select("created_at")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  // 날짜별 그룹화
  const signupByDay: Record<string, number> = {};
  recentUsers?.forEach((u) => {
    const day = u.created_at?.slice(0, 10);
    if (day) signupByDay[day] = (signupByDay[day] || 0) + 1;
  });

  return NextResponse.json({
    totalUsers: users?.length || 0,
    totalTeams: teamCount || 0,
    totalMembers: memberCount || 0,
    totalMatches: matchCount || 0,
    users: users || [],
    signupByDay,
  });
}
