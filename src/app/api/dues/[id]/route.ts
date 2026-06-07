import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageDues } from "@/lib/team";

// PATCH - 상태 변경 (active/closed)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageDues(role)) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const { data, error } = await supabaseAdmin
    .from("dues")
    .update(body)
    .eq("id", id)
    .eq("team_id", teamId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE - 회비 항목 삭제
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageDues(role)) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("dues")
    .delete()
    .eq("id", id)
    .eq("team_id", teamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
