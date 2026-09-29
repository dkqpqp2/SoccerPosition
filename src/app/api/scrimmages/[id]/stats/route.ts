import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, isOwner } from "@/lib/team";

/** POST /api/scrimmages/[id]/stats
 *  body: { stats: [{ member_id, goals, assists }] }
 *  → 해당 내전의 기존 기록 삭제 후 재삽입 (0 제외)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) return NextResponse.json({ error: "관리자만 기록을 입력할 수 있어요" }, { status: 403 });

  const { data: scrimmage } = await supabaseAdmin.from("scrimmages").select("id").eq("id", id).eq("team_id", teamId).single();
  if (!scrimmage) return NextResponse.json({ error: "내전을 찾을 수 없어요" }, { status: 404 });

  const { stats } = await req.json() as { stats: { member_id: string; goals: number; assists: number }[] };
  if (!Array.isArray(stats)) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  await supabaseAdmin.from("scrimmage_stats").delete().eq("scrimmage_id", id);

  const nonZero = stats.filter(s => s.goals > 0 || s.assists > 0);
  if (nonZero.length > 0) {
    const { error } = await supabaseAdmin
      .from("scrimmage_stats")
      .insert(nonZero.map(s => ({ scrimmage_id: id, member_id: s.member_id, goals: s.goals, assists: s.assists })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
