import { NextResponse } from "next/server";
import { resolveLoungeContext, sessionResponse } from "@/lib/loungeRoom";

export const dynamic = "force-dynamic";

/**
 * GET /api/lounge/session — 지금 우리 팀에 열린 라운지 방이 있는지, 있다면 들어갈 채널과 만료 시각.
 * 열린 방이 없으면 room은 null이고 채널도 주지 않는다(방이 열려야만 들어갈 수 있다).
 */
export async function GET() {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const resolved = await resolveLoungeContext();
  if ("error" in resolved) return resolved.error;
  const { ctx } = resolved;

  try {
    const room = await ctx.store.getOpen();
    return sessionResponse(ctx, room, secret);
  } catch (error) {
    console.error("lounge session error:", error);
    return NextResponse.json({ error: "Room storage unavailable" }, { status: 500 });
  }
}
