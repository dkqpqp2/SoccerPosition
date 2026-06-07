import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

/** GET /api/match-results — 스코어가 있는 경기 전체 반환 (전적 계산용) */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json([]);

  const { data, error } = await supabaseAdmin
    .from("matches")
    .select("id, match_date, title, score_us, score_them")
    .eq("team_id", teamId)
    .not("score_us", "is", null)
    .not("score_them", "is", null)
    .order("match_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
