import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";
import { sendPushToUsers } from "@/lib/push";

const PERMISSION_ERROR = "포지션 배정 권한이 없어요. 팀장 또는 부팀장만 가능해요.";

// POST - 이 쿼터에 배정된 팀원들에게만 알림 발송 (관리자급이 버튼을 눌렀을 때만)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) return NextResponse.json({ error: PERMISSION_ERROR }, { status: 403 });

  const { id } = await params;
  const { data: assignment } = await supabaseAdmin
    .from("position_assignments")
    .select("id, session_name, result, match_id")
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (!assignment) return NextResponse.json({ error: "배정을 찾을 수 없어요" }, { status: 404 });

  const assignedMemberIds: string[] = Object.values(assignment.result ?? {})
    .filter(Boolean)
    .map((m: any) => m.id);

  if (assignedMemberIds.length === 0) return NextResponse.json({ notified: 0 });

  let matchLabel = assignment.session_name;
  if (assignment.match_id) {
    const { data: match } = await supabaseAdmin
      .from("matches").select("match_date").eq("id", assignment.match_id).single();
    if (match?.match_date) {
      const [, mon, day] = match.match_date.split("-").map(Number);
      matchLabel = `${mon}월 ${day}일 경기`;
    }
  }

  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id")
    .eq("team_id", teamId)
    .in("id", assignedMemberIds)
    .not("user_id", "is", null);

  const userIds = (members ?? []).map(m => m.user_id as string);
  if (userIds.length === 0) return NextResponse.json({ notified: 0 });

  const notifications = userIds.map(uid => ({
    user_id: uid,
    team_id: teamId,
    type: "position_assigned",
    title: "포지션 배정 알림 ⚽",
    body: `${matchLabel} [${assignment.session_name}]에 배정되셨습니다. 포지션을 확인해보세요!`,
    link: `/share/${assignment.id}`,
    is_read: false,
  }));
  await supabaseAdmin.from("notifications").insert(notifications);

  sendPushToUsers(userIds.filter(uid => uid !== userId), {
    title: "포지션 배정 알림 ⚽",
    body: `[${assignment.session_name}] 포지션을 확인해보세요!`,
    url: `/share/${assignment.id}`,
  }).catch(console.error);

  return NextResponse.json({ notified: userIds.length });
}
