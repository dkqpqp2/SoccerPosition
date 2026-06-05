import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  const { id } = await params;

  // 본인 또는 스태프만 삭제 가능
  const { data: photo } = await supabaseAdmin
    .from("gallery_photos")
    .select("member_id, image_url")
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .limit(1)
    .single();

  const { data: tu } = await supabaseAdmin
    .from("team_users")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  const isOwner  = photo.member_id === member?.id;
  const isStaff  = ["owner", "manager", "president"].includes(tu?.role ?? "");

  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  }

  // Storage에서도 삭제 시도
  try {
    const url     = new URL(photo.image_url);
    const stoPath = url.pathname.split("/object/public/gallery/")[1];
    if (stoPath) await supabaseAdmin.storage.from("gallery").remove([stoPath]);
  } catch {}

  await supabaseAdmin.from("gallery_photos").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
