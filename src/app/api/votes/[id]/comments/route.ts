import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

// POST - 댓글 작성
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await getUserAndTeam(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id: voteId } = await params;
  const { content } = await req.json();

  if (!content?.trim()) return NextResponse.json({ error: "댓글 내용을 입력해주세요" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("vote_comments")
    .insert({ vote_id: voteId, user_id: userId, content: content.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
