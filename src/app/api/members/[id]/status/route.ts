import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";

const VALID_STATUSES = ["active", "injured", "personal"];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id } = await params;
  const { status, status_note, status_until } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "유효하지 않은 상태예요." }, { status: 400 });
  }

  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id, team_id")
    .eq("id", id)
    .maybeSingle();

  if (!member || member.team_id !== teamId) {
    return NextResponse.json({ error: "팀원을 찾을 수 없어요." }, { status: 404 });
  }

  const role = await getUserRole(userId, teamId);
  const isSelf = member.user_id === userId;
  if (!isSelf && !canManage(role)) {
    return NextResponse.json({ error: "상태 변경 권한이 없어요." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("team_members")
    .update({
      status,
      status_note: status === "active" ? null : (status_note || null),
      status_until: status === "active" ? null : (status_until || null),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
