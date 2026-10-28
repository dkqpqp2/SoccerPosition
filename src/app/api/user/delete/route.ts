import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserId } from "@/lib/team";
import { deleteAccount } from "@/lib/accountDeletion";

/** DELETE /api/user/delete — 회원 탈퇴 (개인정보 삭제 + 익명화, 자세한 설명은 lib/accountDeletion.ts) */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const result = await deleteAccount(supabaseAdmin, userId);
  if (!result.ok) {
    // DB 오류 문구는 응답에 담지 않고 서버 로그에만 남긴다. 각 단계가 반복 실행돼도 안전해서 다시 시도하면 이어서 처리된다.
    console.error("account delete failed at step:", result.step, result.message);
    return NextResponse.json({ error: "탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
