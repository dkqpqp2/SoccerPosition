import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManage, getUserAndTeam, getUserRole } from "@/lib/team";
import { isLoungeEnabled } from "@/lib/lounge";
import LoungeClient from "@/components/lounge/LoungeClient";

export const dynamic = "force-dynamic";

export default async function LoungePage() {
  const isDev = process.env.NODE_ENV === "development";
  const session = await getServerSession(authOptions);

  // 로컬 개발에서 로그인 없이 화면을 볼 때만 쓰는 기본값(관리자 화면). 운영에서는 항상 아래 실제 역할로 정해진다.
  let isManager = true;

  if (session?.user?.id) {
    const { userId, teamId } = await getUserAndTeam(session.user.id);
    // 허용 팀이 아니면 404처럼 보인다 (로컬 개발은 예외)
    if (!isLoungeEnabled(teamId) && !isDev) notFound();
    isManager = !!userId && !!teamId && canManage(await getUserRole(userId, teamId));
  } else if (!isDev) {
    // 운영(Vercel 미리보기 포함)에서 로그인 안 했으면 첫 화면으로
    redirect("/");
  }

  return <LoungeClient canManage={isManager} />;
}
