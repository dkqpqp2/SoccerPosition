import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// PATCH - 단일 알림 읽음 처리
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}

// DELETE - 알림 삭제
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await supabaseAdmin.from("notifications").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
