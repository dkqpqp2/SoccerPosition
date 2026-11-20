import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/version — 지금 서버에 올라가 있는 배포의 식별자(커밋 해시).
 * 앱이 켜 둔 화면의 식별자와 비교해서 새 배포가 있는지 알아내는 데만 쓴다(AppUpdateWatcher).
 * 로그인 없이 부르는 공개 주소이고, 커밋 해시 외에는 아무것도 주지 않는다. 식별자를 못 구하면 빈 문자열 → 감지 기능이 꺼진다.
 */
export async function GET() {
  return NextResponse.json(
    { id: process.env.NEXT_PUBLIC_BUILD_ID ?? "" },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
