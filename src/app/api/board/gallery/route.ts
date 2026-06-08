import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json([]);

  const year = req.nextUrl.searchParams.get("year");

  let query = supabaseAdmin
    .from("gallery_photos")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (year) query = query.eq("year", parseInt(year));

  const { data } = await query;
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  // 작성자 이름 조회
  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id, name")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .limit(1)
    .single();

  const formData = await req.formData();
  const file        = formData.get("file")        as File | null;
  const title       = formData.get("title")       as string;
  const description = formData.get("description") as string || "";
  const year        = parseInt(formData.get("year") as string) || new Date().getFullYear();
  const category    = formData.get("category")    as string || "기타";
  const group_id    = formData.get("group_id")    as string | null;

  if (!file || !title) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Supabase Storage 업로드
  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `${teamId}/${Date.now()}.${ext}`;
  const buf  = Buffer.from(await file.arrayBuffer());

  const { data: upload, error: upErr } = await supabaseAdmin.storage
    .from("gallery")
    .upload(path, buf, { contentType: file.type, upsert: false });

  if (upErr) {
    console.error("[gallery upload] storage error:", upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage.from("gallery").getPublicUrl(upload.path);

  const { data, error } = await supabaseAdmin
    .from("gallery_photos")
    .insert({
      team_id:     teamId,
      member_id:   member?.id   ?? null,
      author_name: member?.name ?? "팀원",
      title,
      description,
      image_url:   urlData.publicUrl,
      year,
      category,
      group_id:    group_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
