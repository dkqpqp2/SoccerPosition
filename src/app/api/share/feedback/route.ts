import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canFeedback } from "@/lib/team";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canFeedback(role)) {
    return NextResponse.json({ error: "공유 권한이 없어요." }, { status: 403 });
  }

  const { match_id } = await req.json();
  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  // 경기 정보
  const { data: match } = await supabaseAdmin
    .from("matches")
    .select("match_date, match_time, match_end_time, title, location")
    .eq("id", match_id)
    .single();

  // 피드백 데이터
  const { data: feedback } = await supabaseAdmin
    .from("match_feedbacks")
    .select("team_feedback, player_feedbacks")
    .eq("match_id", match_id)
    .eq("team_id", teamId)
    .single();

  // 팀 이름
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("name")
    .eq("id", teamId)
    .single();

  const { data, error } = await supabaseAdmin
    .from("shared_lists")
    .insert({
      team_name: team?.name ?? "우리팀",
      data: {
        type: "feedback",
        match_info: match,
        team_feedback: feedback?.team_feedback ?? null,
        quarter_feedbacks: feedback?.player_feedbacks ?? [],
      },
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
