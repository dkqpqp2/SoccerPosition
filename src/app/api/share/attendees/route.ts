import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { members, match_info } = await req.json();

  // 팀 정보 (이름 + 유니폼)
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("name, uniform_info")
    .eq("id", teamId)
    .single();

  const { data, error } = await supabaseAdmin
    .from("shared_lists")
    .insert({
      team_name: team?.name ?? "우리팀",
      data: { members, match_info, uniform_info: team?.uniform_info ?? null },
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id });
}
