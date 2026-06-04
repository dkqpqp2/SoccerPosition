import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, isOwner } from "@/lib/team";

/** 역할 변경 */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) {
    return NextResponse.json({ error: "역할 변경은 팀장만 가능해요." }, { status: 403 });
  }

  const { target_user_id, new_role } = await req.json() as { target_user_id: string; new_role: string };
  if (!["manager", "coach", "member"].includes(new_role)) {
    return NextResponse.json({ error: "유효하지 않은 역할이에요." }, { status: 400 });
  }
  if (target_user_id === userId) {
    return NextResponse.json({ error: "자기 자신의 역할은 변경할 수 없어요." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("team_users")
    .update({ role: new_role })
    .eq("team_id", teamId)
    .eq("user_id", target_user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** 팀원 강퇴 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) {
    return NextResponse.json({ error: "강퇴는 팀장만 가능해요." }, { status: 403 });
  }

  const { target_user_id } = await req.json();
  if (target_user_id === userId) {
    return NextResponse.json({ error: "자기 자신은 강퇴할 수 없어요." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("team_users")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", target_user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
