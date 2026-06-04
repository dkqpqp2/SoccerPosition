import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserId } from "@/lib/team";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.id);
  if (!userId) return NextResponse.json([], { status: 200 });

  // 내가 속한 모든 팀 + 역할 + active 여부
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("active_team_id")
    .eq("id", userId)
    .single();

  const { data: teamUsers } = await supabaseAdmin
    .from("team_users")
    .select("role, team_id, teams(id, name, color, owner_id)")
    .eq("user_id", userId);

  const teams = (teamUsers ?? []).map((tu) => {
    const t = (Array.isArray(tu.teams) ? tu.teams[0] : tu.teams) as { id: string; name: string; color: string; owner_id: string } | null;
    return {
      id: t?.id,
      name: t?.name,
      color: t?.color,
      role: tu.role,
      is_mine: t?.owner_id === userId,
      is_active: t?.id === user?.active_team_id,
    };
  });

  return NextResponse.json(teams);
}
