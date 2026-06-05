import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";
import { extractYouTubeId } from "@/lib/youtube";

/** 영상 목록 조회 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json([], { status: 200 });

  const category = req.nextUrl.searchParams.get("category");

  let query = supabaseAdmin
    .from("team_videos")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** 영상 추가 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { youtube_url, title, description, category } = await req.json();
  if (!youtube_url || !title) return NextResponse.json({ error: "URL과 제목은 필수예요" }, { status: 400 });

  const youtube_id = extractYouTubeId(youtube_url);
  if (!youtube_id) return NextResponse.json({ error: "올바른 YouTube URL을 입력해주세요" }, { status: 400 });

  // 작성자 이름 조회
  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("name")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .single();

  const author_name = member?.name ?? session.user?.name ?? "팀원";

  const { data, error } = await supabaseAdmin
    .from("team_videos")
    .insert({
      team_id: teamId,
      member_id: userId,
      author_name,
      youtube_id,
      youtube_url,
      title: title.trim(),
      description: description?.trim() ?? null,
      category: category ?? "etc",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
