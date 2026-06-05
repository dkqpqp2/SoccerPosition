import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  const { id } = await params;

  const { data: post } = await supabaseAdmin
    .from("board_posts")
    .select("member_id")
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .limit(1)
    .single();

  const { data: tu } = await supabaseAdmin
    .from("team_users")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  const isOwner = post.member_id === member?.id;
  const isStaff = ["owner", "manager", "president"].includes(tu?.role ?? "");

  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  }

  await supabaseAdmin.from("board_posts").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
