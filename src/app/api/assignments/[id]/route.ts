import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";

const PERMISSION_ERROR = "포지션 배정 권한이 없어요. 팀장 또는 부팀장만 가능해요.";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) {
    return NextResponse.json({ error: PERMISSION_ERROR }, { status: 403 });
  }

  const { id } = await params;
  const { result, formation_name, formation_id, formation_slots, attending_members } = await req.json();

  const updatePayload: Record<string, unknown> = { result, formation_name, formation_id, formation_slots };
  if (attending_members !== undefined) updatePayload.attending_members = attending_members;

  const { data, error } = await supabaseAdmin
    .from("position_assignments")
    .update(updatePayload)
    .eq("id", id)
    .eq("team_id", teamId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** PATCH — sort_order만 업데이트 (쿼터 순서 변경) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) {
    return NextResponse.json({ error: PERMISSION_ERROR }, { status: 403 });
  }

  const { id } = await params;
  const { sort_order } = await req.json();

  const { error } = await supabaseAdmin
    .from("position_assignments")
    .update({ sort_order })
    .eq("id", id)
    .eq("team_id", teamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) {
    return NextResponse.json({ error: PERMISSION_ERROR }, { status: 403 });
  }

  const { id } = await params;
  const { error } = await supabaseAdmin
    .from("position_assignments")
    .delete()
    .eq("id", id)
    .eq("team_id", teamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
