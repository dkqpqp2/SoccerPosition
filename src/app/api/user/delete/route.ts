import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/** DELETE /api/user/delete — 회원 탈퇴 (계정 및 관련 데이터 삭제) */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  // 팀원 정보 삭제
  await supabaseAdmin.from("team_members").delete().eq("user_id", userId);

  // 매칭 프로필 삭제
  await supabaseAdmin.from("matching_profiles").delete().eq("user_id", userId);

  // 알림 삭제
  await supabaseAdmin.from("notifications").delete().eq("user_id", userId);

  // 유저 계정 삭제 (NextAuth accounts & sessions)
  await supabaseAdmin.from("accounts").delete().eq("userId", userId);
  await supabaseAdmin.from("sessions").delete().eq("userId", userId);
  await supabaseAdmin.from("users").delete().eq("id", userId);

  return NextResponse.json({ success: true });
}
