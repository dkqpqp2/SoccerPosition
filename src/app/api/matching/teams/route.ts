import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 내 팀 ID 조회 (본인 팀 제외용)
  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("kakao_id", session.user.id).single();
  const { data: myTeam } = user
    ? await supabaseAdmin.from("teams").select("id").eq("owner_id", user.id).single()
    : { data: null };

  // 공개된 팀 프로필 + 팀 이름 조회
  const { data, error } = await supabaseAdmin
    .from("team_profiles")
    .select(`
      *,
      teams!inner(id, name, color)
    `)
    .eq("is_public", true)
    .neq("team_id", myTeam?.id ?? "00000000-0000-0000-0000-000000000000")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
