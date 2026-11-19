import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserAndTeam } from "@/lib/team";
import { isLoungeEnabled } from "@/lib/lounge";
import LoungeClient from "@/components/lounge/LoungeClient";

export const dynamic = "force-dynamic";

// 이 페이지는 접근만 거른다(로그인 + 허용 팀). 방이 열려 있는지·내가 관리자인지는 입구(LoungeGate)가 /api/lounge/session으로 서버에 물어 정한다.
export default async function LoungePage() {
  const isDev = process.env.NODE_ENV === "development";
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    const { teamId } = await getUserAndTeam(session.user.id);
    // 허용 팀이 아니면 404처럼 보인다 (로컬 개발은 예외)
    if (!isLoungeEnabled(teamId) && !isDev) notFound();
  } else if (!isDev) {
    // 운영(Vercel 미리보기 포함)에서 로그인 안 했으면 첫 화면으로
    redirect("/");
  }

  return <LoungeClient />;
}
