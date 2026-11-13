import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserId } from "@/lib/team";
import { deleteAccount } from "@/lib/accountDeletion";
import { revokeAppleToken } from "@/lib/apple";

/** DELETE /api/user/delete — 회원 탈퇴 (개인정보 삭제 + 익명화, 자세한 설명은 lib/accountDeletion.ts) */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Apple로 가입한 계정이면 Apple 쪽 로그인 연결도 끊는다 (App Store 규정). 실패해도 탈퇴 자체는 막지 않는다.
  try {
    const { data: cred } = await supabaseAdmin.from("apple_credentials").select("refresh_token").eq("user_id", userId).limit(1);
    if (cred?.[0]) {
      const revoked = await revokeAppleToken(cred[0].refresh_token);
      if (!revoked) console.error("apple token revoke failed for user", userId);
    }
  } catch (e) {
    console.error("apple token revoke error:", e);
  }

  const result = await deleteAccount(supabaseAdmin, userId);
  if (!result.ok) {
    // DB 오류 문구는 응답에 담지 않고 서버 로그에만 남긴다. 각 단계가 반복 실행돼도 안전해서 다시 시도하면 이어서 처리된다.
    console.error("account delete failed at step:", result.step, result.message);
    return NextResponse.json({ error: "탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
