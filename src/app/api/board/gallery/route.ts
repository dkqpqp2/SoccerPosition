import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";
import { loadHidden } from "@/lib/moderation";
import { isBoardTeam, GALLERY_MAX_BYTES, GALLERY_IMAGE_TYPES, GALLERY_MAX_PHOTOS_PER_TEAM, GALLERY_CACHE_SECONDS } from "@/lib/board";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId || !isBoardTeam(teamId)) return NextResponse.json([]);

  const year = req.nextUrl.searchParams.get("year");

  let query = supabaseAdmin
    .from("gallery_photos")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (year) query = query.eq("year", parseInt(year));

  const { data } = await query;
  const photos = data ?? [];

  // 내가 차단한 사람이 올린 사진, 내가 신고한 사진은 보이지 않게 한다
  const hidden = await loadHidden(userId);
  const authorOf = new Map<string, string | null>();
  const memberIds = [...new Set(photos.map(p => p.member_id).filter(Boolean))] as string[];
  if (hidden.blocked.size > 0 && memberIds.length > 0) {
    const { data: members } = await supabaseAdmin.from("team_members").select("id, user_id").eq("team_id", teamId).in("id", memberIds);
    (members ?? []).forEach(m => authorOf.set(m.id as string, (m.user_id as string) ?? null));
  }
  return NextResponse.json(
    photos.filter(p => {
      if (hidden.reported.gallery_photo.has(p.id)) return false;
      const author = p.member_id ? authorOf.get(p.member_id) : null;
      return !(author && hidden.blocked.has(author));
    })
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });
  if (!isBoardTeam(teamId)) return NextResponse.json({ error: "사진 올리기는 아직 일부 팀에서만 쓸 수 있어요" }, { status: 403 });

  const { count: photoCount } = await supabaseAdmin
    .from("gallery_photos")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);
  if ((photoCount ?? 0) >= GALLERY_MAX_PHOTOS_PER_TEAM) {
    return NextResponse.json({ error: `사진은 팀당 ${GALLERY_MAX_PHOTOS_PER_TEAM}장까지 올릴 수 있어요. 오래된 사진을 지우고 다시 올려 주세요` }, { status: 400 });
  }

  // 작성자 이름 조회
  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id, name")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .is("left_at", null)
    .limit(1)
    .maybeSingle();

  const formData = await req.formData();
  const file        = formData.get("file")        as File | null;
  const title       = formData.get("title")       as string;
  const description = formData.get("description") as string || "";
  const year        = parseInt(formData.get("year") as string) || new Date().getFullYear();
  const category    = formData.get("category")    as string || "기타";
  const group_id    = formData.get("group_id")    as string | null;

  if (!file || !title) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (title.length > 100 || description.length > 500) {
    return NextResponse.json({ error: "제목은 100자, 설명은 500자까지 쓸 수 있어요" }, { status: 400 });
  }
  const ext = GALLERY_IMAGE_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "사진(JPG, PNG, WEBP, HEIC)만 올릴 수 있어요" }, { status: 400 });
  if (file.size > GALLERY_MAX_BYTES) {
    return NextResponse.json({ error: "사진 한 장은 4MB까지 올릴 수 있어요. 크기를 줄여서 다시 올려 주세요" }, { status: 413 });
  }

  // Supabase Storage 업로드
  const path = `${teamId}/${Date.now()}.${ext}`;
  const buf  = Buffer.from(await file.arrayBuffer());

  const { data: upload, error: upErr } = await supabaseAdmin.storage
    .from("gallery")
    .upload(path, buf, { contentType: file.type, upsert: false, cacheControl: GALLERY_CACHE_SECONDS });

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
