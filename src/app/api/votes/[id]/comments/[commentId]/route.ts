import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";

// DELETE - 댓글 삭제 (본인 or 관리자)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { commentId } = await params;

  // 댓글 조회
  const { data: comment } = await supabaseAdmin
    .from("vote_comments")
    .select("user_id")
    .eq("id", commentId)
    .single();

  if (!comment) return NextResponse.json({ error: "댓글을 찾을 수 없습니다" }, { status: 404 });

  // 본인 또는 관리자만 삭제 가능
  const role = await getUserRole(userId, teamId);
  const isOwner = role === "owner";

  if (comment.user_id !== userId && !isOwner) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("vote_comments").delete().eq("id", commentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
