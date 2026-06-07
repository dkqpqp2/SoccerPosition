import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // 프로덕션 환경에서 /admin 접근 차단
  if (
    process.env.NODE_ENV === "production" &&
    request.nextUrl.pathname.startsWith("/admin")
  ) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
