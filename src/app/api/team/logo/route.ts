import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (role !== "owner") {
    return NextResponse.json({ error: "팀 로고는 팀장만 변경할 수 있어요." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없어요." }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "이미지 파일만 업로드할 수 있어요." }, { status: 400 });
  }
  if (file.size > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "이미지 크기는 3MB 이하여야 해요." }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "png";
  const path = `logos/${teamId}-${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { data: upload, error: upErr } = await supabaseAdmin.storage
    .from("gallery")
    .upload(path, buf, { contentType: file.type, upsert: false });

  if (upErr) {
    console.error("[team logo upload] storage error:", upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage.from("gallery").getPublicUrl(upload.path);

  const { error } = await supabaseAdmin.from("teams").update({ logo_url: urlData.publicUrl }).eq("id", teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logo_url: urlData.publicUrl });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (role !== "owner") {
    return NextResponse.json({ error: "팀 로고는 팀장만 변경할 수 있어요." }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("teams").update({ logo_url: null }).eq("id", teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
