import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [{ data: userData }, { data: teamData }] = await Promise.all([
    supabaseAdmin.from("users").select("name, email, image").eq("id", userId).single(),
    teamId
      ? supabaseAdmin.from("teams").select("name, color, invite_code, owner_id, uniform_info").eq("id", teamId).single()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    ...userData,
    team_name: teamData?.name ?? "우리팀",
    team_color: teamData?.color ?? "#16a34a",
    invite_code: teamData?.invite_code ?? null,
    is_owner: teamData?.owner_id === userId,
    uniform_info: teamData?.uniform_info ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { team_name, uniform_info } = await req.json();

  await supabaseAdmin.from("teams").update({
    name: team_name,
    ...(uniform_info !== undefined && { uniform_info }),
  }).eq("id", teamId);

  return NextResponse.json({ success: true });
}
