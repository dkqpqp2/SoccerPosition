import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function getMyUserId(kakaoId: string) {
  const { data } = await supabaseAdmin
    .from("users").select("id").eq("kakao_id", kakaoId).single();
  return data?.id ?? null;
}

// PATCH - 단일 알림 읽음 처리
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getMyUserId(session.user.id);
  if (!userId) return NextResponse.json({ ok: true });

  const { id } = await params;

  await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", userId);

  return NextResponse.json({ ok: true });
}

// DELETE - 알림 삭제
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getMyUserId(session.user.id);
  if (!userId) return NextResponse.json({ ok: true });

  const { id } = await params;
  await supabaseAdmin.from("notifications").delete().eq("id", id).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
