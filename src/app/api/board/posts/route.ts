import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";
import { containsProfanity } from "@/lib/profanity";

/** 건의함 목록 열람은 관리자(owner)·회장(president)만 가능 — 제보자 보호 목적 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json([]);

  const role = userId ? await getUserRole(userId, teamId) : null;
  if (role !== "owner" && role !== "president") {
    return NextResponse.json({ error: "건의함은 관리자와 회장만 볼 수 있어요" }, { status: 403 });
  }

  const { data } = await supabaseAdmin
    .from("board_posts")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id, name")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .limit(1)
    .single();

  const { title, content, is_anonymous } = await req.json();
  if (!title || !content) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  if (containsProfanity(title) || containsProfanity(content)) {
    return NextResponse.json({ error: "비속어가 포함되어 있어 건의할 수 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("board_posts")
    .insert({
      team_id:      teamId,
      member_id:    member?.id   ?? null,
      author_name:  is_anonymous ? "익명" : (member?.name ?? "팀원"),
      title,
      content,
      is_anonymous: !!is_anonymous,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
