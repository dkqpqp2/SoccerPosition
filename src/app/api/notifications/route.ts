import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function getMyUserId(kakaoId: string) {
  const { data } = await supabaseAdmin
    .from("users").select("id").eq("kakao_id", kakaoId).single();
  return data?.id ?? null;
}

// GET - 내 알림 목록
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getMyUserId(session.user.id);
  if (!userId) return NextResponse.json([]);

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// PATCH - 전체 읽음 처리
export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getMyUserId(session.user.id);
  if (!userId) return NextResponse.json({ ok: true });

  await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  return NextResponse.json({ ok: true });
}
