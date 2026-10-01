import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";

// GET - 전술판 하나 조회 (관리자급은 전부, 일반 팀원은 공개된 것만)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  const privileged = canManage(role);

  const { data: board } = await supabaseAdmin.from("tactics_boards").select("*").eq("id", id).eq("team_id", teamId).single();
  if (!board) return NextResponse.json({ error: "전술판을 찾을 수 없어요" }, { status: 404 });
  if (!privileged && !board.published) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  return NextResponse.json({ ...board, editable: privileged });
}

// PATCH - 전술판 수정 (내용 저장 / 게시 토글 / 이름 변경)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const { data: board } = await supabaseAdmin.from("tactics_boards").select("id").eq("id", id).eq("team_id", teamId).single();
  if (!board) return NextResponse.json({ error: "전술판을 찾을 수 없어요" }, { status: 404 });

  const body = await req.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") update.title = body.title.trim();
  if (typeof body.formation_name === "string") update.formation_name = body.formation_name;
  if (Array.isArray(body.tokens)) update.tokens = body.tokens;
  if (Array.isArray(body.arrows)) update.arrows = body.arrows;
  if (typeof body.published === "boolean") update.published = body.published;

  const { data, error } = await supabaseAdmin
    .from("tactics_boards")
    .update(update)
    .eq("id", id)
    .eq("team_id", teamId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE - 전술판 삭제
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const { error } = await supabaseAdmin.from("tactics_boards").delete().eq("id", id).eq("team_id", teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
