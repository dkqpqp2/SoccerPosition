import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json([], { status: 200 });

  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");

  let query = supabaseAdmin
    .from("position_assignments")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  if (matchId) {
    query = query.eq("match_id", matchId);
  } else {
    query = query.is("match_id", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) {
    return NextResponse.json({ error: "포지션 배정 권한이 없어요. 팀장 또는 부팀장만 가능해요." }, { status: 403 });
  }

  const { session_name, formation_name, formation_id, formation_slots, result, match_id } = await req.json();

  const { data, error } = await supabaseAdmin
    .from("position_assignments")
    .insert({ user_id: userId, team_id: teamId, session_name, formation_name, formation_id, formation_slots, result, match_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
