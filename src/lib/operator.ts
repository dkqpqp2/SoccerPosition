import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserId } from "@/lib/team";

/** 서비스 운영자(내 계정) 목록. 환경변수 OPERATOR_USER_IDS에 내부 users.id를 쉼표로 적는다. 비어 있으면 아무도 운영자가 아니다. */
export function operatorIds(): string[] {
  return (process.env.OPERATOR_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
}

/** 로그인한 사람이 운영자면 그의 users.id를, 아니면 null을 돌려준다. */
export async function getOperatorUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const userId = await getUserId(session.user.id);
  return userId && operatorIds().includes(userId) ? userId : null;
}
