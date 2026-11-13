import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";
import { isReportTarget, resolveTarget } from "@/lib/moderation";

const MAX_REASON_LENGTH = 200;

// POST - 사진·댓글 신고: { target_type, target_id, reason? }. 신고한 사람의 화면에서는 바로 가려진다.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!isReportTarget(body?.target_type) || typeof body?.target_id !== "string") {
    return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, MAX_REASON_LENGTH) : "";

  const target = await resolveTarget(body.target_type, body.target_id, teamId);
  if (!target) return NextResponse.json({ error: "대상을 찾을 수 없어요" }, { status: 404 });

  const { error } = await supabaseAdmin.from("content_reports").upsert(
    target.ids.map(id => ({
      team_id: teamId,
      reporter_id: userId,
      target_type: body.target_type,
      target_id: id,
      reason: reason || null,
    })),
    { onConflict: "reporter_id,target_type,target_id", ignoreDuplicates: true }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
