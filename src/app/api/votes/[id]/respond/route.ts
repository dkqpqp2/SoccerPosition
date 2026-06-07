import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await getUserAndTeam(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id: voteId } = await params;
  const { option_ids } = await req.json();

  const { data: vote } = await supabaseAdmin
    .from("votes")
    .select("status, is_multiple, end_at")
    .eq("id", voteId)
    .single();

  if (!vote) return NextResponse.json({ error: "투표를 찾을 수 없습니다" }, { status: 404 });

  const isExpired = vote.end_at && new Date(vote.end_at) < new Date();
  if (vote.status !== "open" || isExpired) {
    return NextResponse.json({ error: "마감된 투표입니다" }, { status: 400 });
  }

  if (!vote.is_multiple && option_ids.length > 1) {
    return NextResponse.json({ error: "단일 선택만 가능합니다" }, { status: 400 });
  }

  // 기존 응답 삭제 후 새로 삽입
  await supabaseAdmin
    .from("vote_responses")
    .delete()
    .eq("vote_id", voteId)
    .eq("user_id", userId);

  if (option_ids.length > 0) {
    const { error } = await supabaseAdmin.from("vote_responses").insert(
      option_ids.map((optionId: string) => ({
        vote_id: voteId,
        option_id: optionId,
        user_id: userId,
      }))
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await getUserAndTeam(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id: voteId } = await params;

  await supabaseAdmin
    .from("vote_responses")
    .delete()
    .eq("vote_id", voteId)
    .eq("user_id", userId);

  return NextResponse.json({ success: true });
}
