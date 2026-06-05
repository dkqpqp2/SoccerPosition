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
    .order("session_name", { ascending: true });

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

  const { session_name, formation_name, formation_id, formation_slots, result, match_id, attending_members } = await req.json();

  // 같은 경기(또는 같은 팀)에서 중복 이름 방지
  const dupQuery = supabaseAdmin
    .from("position_assignments")
    .select("id")
    .eq("team_id", teamId)
    .eq("session_name", session_name.trim());
  if (match_id) dupQuery.eq("match_id", match_id);
  else          dupQuery.is("match_id", null);
  const { data: dup } = await dupQuery.limit(1);
  if (dup && dup.length > 0) {
    return NextResponse.json({ error: `"${session_name}" 이름이 이미 있어요. 다른 이름을 사용해주세요.` }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from("position_assignments")
    .insert({ user_id: userId, team_id: teamId, session_name: session_name.trim(), formation_name, formation_id, formation_slots, result, match_id, attending_members: attending_members ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
