import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, isOwner } from "@/lib/team";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) return NextResponse.json({ error: "팀장만 이용할 수 있어요" }, { status: 403 });

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .single();

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  return NextResponse.json({ team_id: team.id, team_name: team.name });
}
