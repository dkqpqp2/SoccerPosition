import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const [{ data: team }, { data: members }, myRole] = await Promise.all([
    supabaseAdmin.from("teams").select("id, name, color, invite_code, owner_id, created_at").eq("id", teamId).single(),
    supabaseAdmin.from("team_users").select("role, joined_at, user_id, users(id, name, email, image)").eq("team_id", teamId).order("joined_at", { ascending: true }),
    getUserRole(userId, teamId),
  ]);

  return NextResponse.json({
    ...team,
    my_role: myRole,
    is_owner: myRole === "owner",
    can_manage: myRole === "owner" || myRole === "manager" || myRole === "coach" || myRole === "president",
    members: members ?? [],
  });
}
