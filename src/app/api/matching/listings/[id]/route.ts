import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, isOwner } from "@/lib/team";

// PATCH - 상태 변경 (open → closed)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) return NextResponse.json({ error: "팀장만 이용할 수 있어요" }, { status: 403 });

  const { data: listing } = await supabaseAdmin
    .from("match_listings").select("team_id").eq("id", id).single();
  if (!listing || listing.team_id !== teamId)
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("match_listings")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE - 매칭 등록 삭제
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) return NextResponse.json({ error: "팀장만 이용할 수 있어요" }, { status: 403 });

  const { data: listing } = await supabaseAdmin
    .from("match_listings").select("team_id").eq("id", id).single();
  if (!listing || listing.team_id !== teamId)
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { error } = await supabaseAdmin.from("match_listings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
