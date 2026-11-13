import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";
import { isReportTarget, resolveTarget } from "@/lib/moderation";

// GET - 내가 차단한 사용자 목록. 이름은 지금 팀 소속인 사람만 보여주고, 그 외는 이름 없이 돌려준다.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId) return NextResponse.json([]);

  const { data: blocks, error } = await supabaseAdmin
    .from("user_blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!blocks?.length) return NextResponse.json([]);

  const names = new Map<string, string>();
  if (teamId) {
    const { data: members } = await supabaseAdmin
      .from("team_members")
      .select("user_id, name")
      .eq("team_id", teamId)
      .is("left_at", null)
      .in("user_id", blocks.map(b => b.blocked_id));
    (members ?? []).forEach(m => { if (m.user_id) names.set(m.user_id as string, m.name as string); });
  }

  return NextResponse.json(
    blocks.map(b => ({ user_id: b.blocked_id, name: names.get(b.blocked_id as string) ?? null, created_at: b.created_at }))
  );
}

// POST - 사진·댓글 작성자 차단: { target_type, target_id }. 차단하면 그 사람의 사진·댓글이 내 화면에서 사라진다.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!isReportTarget(body?.target_type) || typeof body?.target_id !== "string") {
    return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }

  const target = await resolveTarget(body.target_type, body.target_id, teamId);
  if (!target) return NextResponse.json({ error: "대상을 찾을 수 없어요" }, { status: 404 });
  if (!target.authorUserId) return NextResponse.json({ error: "차단할 수 없는 사용자예요" }, { status: 400 });
  if (target.authorUserId === userId) return NextResponse.json({ error: "나 자신은 차단할 수 없어요" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("user_blocks")
    .upsert({ blocker_id: userId, blocked_id: target.authorUserId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
