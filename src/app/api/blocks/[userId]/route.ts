import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserId } from "@/lib/team";

// DELETE - 차단 해제 (내가 한 차단만)
export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await getUserId(session.user.id);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { userId: blockedId } = await params;
  const { error } = await supabaseAdmin.from("user_blocks").delete().eq("blocker_id", me).eq("blocked_id", blockedId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
