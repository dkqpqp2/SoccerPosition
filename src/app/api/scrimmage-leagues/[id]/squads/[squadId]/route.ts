import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageScrimmage } from "@/lib/team";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; squadId: string }> }) {
  const { id, squadId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageScrimmage(role)) return NextResponse.json({ error: "관리자·매니저·회장만 수정할 수 있어요" }, { status: 403 });

  const { data: league } = await supabaseAdmin.from("scrimmage_leagues").select("id").eq("id", id).eq("team_id", teamId).single();
  if (!league) return NextResponse.json({ error: "리그를 찾을 수 없어요" }, { status: 404 });

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.color === "string" || body.color === null) update.color = body.color;
  if (typeof body.captain_member_id === "string" || body.captain_member_id === null) update.captain_member_id = body.captain_member_id;

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "수정할 내용이 없어요" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("scrimmage_league_squads")
    .update(update)
    .eq("id", squadId)
    .eq("league_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
