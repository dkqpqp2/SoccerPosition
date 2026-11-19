import { NextRequest, NextResponse } from "next/server";
import { ROOM_TTL_MS, resolveLoungeContext, sessionResponse } from "@/lib/loungeRoom";

export const dynamic = "force-dynamic";

/**
 * POST /api/lounge/room — 라운지 방 열기 (관리자급만). 24시간 동안 열려 있고, 이미 열린 방이 있으면 그 방을 돌려준다.
 * 로컬 개발 손님 모드에서만 ?ttlSec=20 처럼 짧은 만료 시간을 시험용으로 줄 수 있다.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const resolved = await resolveLoungeContext();
  if ("error" in resolved) return resolved.error;
  const { ctx } = resolved;
  if (!ctx.manager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let ttlMs = ROOM_TTL_MS;
  if (ctx.kind === "dev") {
    const ttlSec = Number(req.nextUrl.searchParams.get("ttlSec"));
    if (Number.isFinite(ttlSec) && ttlSec >= 5 && ttlSec <= ROOM_TTL_MS / 1000) ttlMs = ttlSec * 1000;
  }

  try {
    const room = await ctx.store.create(ctx.userId, ttlMs);
    return sessionResponse(ctx, room, secret);
  } catch (error) {
    console.error("lounge room create error:", error);
    return NextResponse.json({ error: "Room storage unavailable" }, { status: 500 });
  }
}

/** DELETE /api/lounge/room — 지금 열린 방을 강제로 닫기 (관리자급만). 이미 닫혀 있어도 오류 없이 성공으로 본다. */
export async function DELETE() {
  const resolved = await resolveLoungeContext();
  if ("error" in resolved) return resolved.error;
  const { ctx } = resolved;
  if (!ctx.manager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const closed = await ctx.store.close(ctx.userId);
    return NextResponse.json({ ok: true, closed });
  } catch (error) {
    console.error("lounge room close error:", error);
    return NextResponse.json({ error: "Room storage unavailable" }, { status: 500 });
  }
}
