import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// 외부 모니터링(UptimeRobot 등)이 주기적으로 호출하는 상태 확인 주소.
// 사이트와 DB가 살아 있으면 200, DB에 닿지 않으면 503. 오류 내용·설정값은 응답에 담지 않는다.
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const { error } = await supabaseAdmin.from("teams").select("id").limit(1);
  const ms = Date.now() - started;

  if (error) {
    console.error("health check: DB 연결 실패", error.code ?? "unknown");
    return NextResponse.json({ status: "error", db: "down", ms }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ status: "ok", db: "up", ms }, { headers: { "Cache-Control": "no-store" } });
}
