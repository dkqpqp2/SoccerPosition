import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 본인 영상 또는 관리자만 삭제 가능
  const { data: video } = await supabaseAdmin
    .from("team_videos")
    .select("member_id")
    .eq("id", id)
    .single();

  const role = await getUserRole(userId, teamId);
  const isOwn = video?.member_id === userId;
  const isAdmin = canManage(role);

  if (!isOwn && !isAdmin) {
    return NextResponse.json({ error: "삭제 권한이 없어요" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("team_videos")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
