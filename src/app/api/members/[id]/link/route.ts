import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";

// PATCH /api/members/[id]/link
// 임의 추가 팀원을 기존 계정과 연결
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (role !== "owner" && role !== "manager") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { id: manualMemberId } = await params; // 임의 추가 팀원의 team_members.id
  const { target_member_id } = await req.json(); // 연결할 계정의 team_members.id
  if (!target_member_id) return NextResponse.json({ error: "target_member_id 필요" }, { status: 400 });

  // 임의 추가 팀원 확인
  const { data: manualMember } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id, name, team_id, position_1st, position_2nd, birth_year, referrer")
    .eq("id", manualMemberId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (!manualMember) return NextResponse.json({ error: "팀원을 찾을 수 없어요" }, { status: 404 });
  if (manualMember.user_id) return NextResponse.json({ error: "이미 계정이 연결된 팀원이에요" }, { status: 400 });

  // 연결할 계정 팀원 확인
  const { data: targetMember } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id, name, team_id, position_1st, position_2nd, birth_year")
    .eq("id", target_member_id)
    .eq("team_id", teamId)
    .maybeSingle();

  if (!targetMember) return NextResponse.json({ error: "연결할 팀원을 찾을 수 없어요" }, { status: 404 });
  if (!targetMember.user_id) return NextResponse.json({ error: "계정이 없는 팀원이에요" }, { status: 400 });

  const targetUserId = targetMember.user_id;

  // 병합 데이터: 임의 멤버 우선, 없으면 계정 멤버 데이터 사용
  const mergedData = {
    user_id: targetUserId,
    position_1st: manualMember.position_1st ?? targetMember.position_1st ?? null,
    position_2nd: manualMember.position_2nd ?? targetMember.position_2nd ?? null,
    birth_year:   manualMember.birth_year   ?? targetMember.birth_year   ?? null,
  };

  // 1. 납부 기록 이전: member_id 기반 납부 → user_id로 업데이트
  await supabaseAdmin
    .from("dues_payments")
    .update({ user_id: targetUserId, member_id: null })
    .eq("member_id", manualMemberId);

  // 2. 임의 추가 팀원에 user_id + 병합 데이터 반영
  await supabaseAdmin
    .from("team_members")
    .update(mergedData)
    .eq("id", manualMemberId);

  // 3. 기존 계정 팀원 (중복) 삭제
  await supabaseAdmin
    .from("team_members")
    .delete()
    .eq("id", target_member_id);

  // 4. team_member_dues_settings 이전 (계정 멤버 설정 → 임의 멤버 행으로)
  const { data: targetSettings } = await supabaseAdmin
    .from("team_member_dues_settings")
    .select("*")
    .eq("team_id", teamId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetSettings) {
    // 임의 멤버 행에는 user_id가 없었으므로 기존 설정 행의 user_id가 이미 targetUserId → 그대로 유지
    // (team_members.user_id가 업데이트됐으므로 자동으로 연결됨)
  }

  return NextResponse.json({ success: true });
}
