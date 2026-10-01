import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserId } from "@/lib/team";

/** DELETE /api/user/delete — 회원 탈퇴 (계정 및 관련 데이터 삭제) */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // 내가 owner인 팀은 소유권 포기 — 다른 팀원이 있으면 가장 먼저 들어온 팀원에게 owner 승계, 없으면 팀 자체 삭제
  const { data: ownedTeams } = await supabaseAdmin.from("teams").select("id").eq("owner_id", userId);
  for (const team of ownedTeams ?? []) {
    const { data: nextOwner } = await supabaseAdmin
      .from("team_users")
      .select("user_id")
      .eq("team_id", team.id)
      .neq("user_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextOwner) {
      await supabaseAdmin.from("teams").update({ owner_id: nextOwner.user_id }).eq("id", team.id);
      await supabaseAdmin.from("team_users").update({ role: "owner" }).eq("team_id", team.id).eq("user_id", nextOwner.user_id);
    } else {
      await supabaseAdmin.from("teams").delete().eq("id", team.id);
    }
  }

  // 팀 멤버십 삭제
  await supabaseAdmin.from("team_users").delete().eq("user_id", userId);

  // 팀원 정보 삭제
  const { error: memberError } = await supabaseAdmin.from("team_members").delete().eq("user_id", userId);
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  // 매칭 프로필 삭제
  const { error: matchingError } = await supabaseAdmin.from("matching_profiles").delete().eq("user_id", userId);
  if (matchingError) return NextResponse.json({ error: matchingError.message }, { status: 500 });

  // 알림 삭제
  const { error: notifError } = await supabaseAdmin.from("notifications").delete().eq("user_id", userId);
  if (notifError) return NextResponse.json({ error: notifError.message }, { status: 500 });

  // 유저 계정 삭제 (NextAuth accounts & sessions) — accounts/sessions는 카카오 로그인 식별자(kakao_id) 기준
  const { error: accountsError } = await supabaseAdmin.from("accounts").delete().eq("userId", session.user.id);
  if (accountsError) return NextResponse.json({ error: accountsError.message }, { status: 500 });

  const { error: sessionsError } = await supabaseAdmin.from("sessions").delete().eq("userId", session.user.id);
  if (sessionsError) return NextResponse.json({ error: sessionsError.message }, { status: 500 });

  const { error: userError } = await supabaseAdmin.from("users").delete().eq("id", userId);
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
