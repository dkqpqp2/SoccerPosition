import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 관리자 화면과 관리자 API는 운영에서 쓰지 않으므로 운영 환경에서는 통째로 404로 막음
// (로컬 개발에서만 사용). Next.js 16부터 middleware.ts가 proxy.ts로 바뀜.
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
