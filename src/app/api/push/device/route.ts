import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserId } from "@/lib/team";

// POST /api/push/device — 앱(안드로이드·iOS)의 푸시 토큰 등록. 같은 토큰이 다른 사용자로 로그인하면 그 사용자로 옮겨진다.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { token, platform } = await req.json();
  if (typeof token !== "string" || token.length < 20 || token.length > 4096) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  if (platform !== "android" && platform !== "ios") {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("device_tokens")
    .upsert({ token, user_id: userId, platform, updated_at: new Date().toISOString() }, { onConflict: "token" });
  if (error) return NextResponse.json({ error: "등록하지 못했어요" }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE /api/push/device — 로그아웃할 때 이 기기의 토큰 해제 (본인 토큰만)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { token } = await req.json();
  if (typeof token !== "string") return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  await supabaseAdmin.from("device_tokens").delete().eq("token", token).eq("user_id", userId);
  return NextResponse.json({ success: true });
}
