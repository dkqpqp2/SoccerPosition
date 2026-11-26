import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";
import { coachingBasisHash, parseCoachingContent } from "@/lib/coaching";

/** GET /api/members/coaching — 코칭 탭 목록 (관리자급 전용).
 *  정규 팀원마다 장단점이 있는지, 저장된 가이드가 있는지, 입력이 바뀌어서 다시 만들어야 하는지를 내려준다. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json([]);

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  // 정규 팀원 목록 (나간 팀원·용병 제외 — /api/members와 같은 조건)
  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, name, position_1st, position_2nd")
    .eq("team_id", teamId)
    .eq("is_mercenary", false)
    .is("left_at", null)
    .order("name");
  if (!members || members.length === 0) return NextResponse.json([]);

  const [{ data: evals }, { data: guides }] = await Promise.all([
    supabaseAdmin.from("member_evaluations").select("member_id, strengths, weaknesses").eq("team_id", teamId),
    supabaseAdmin.from("member_coaching_guides").select("member_id, content, basis_hash, delivered_at, updated_at").eq("team_id", teamId),
  ]);
  const evalMap = new Map((evals ?? []).map(e => [e.member_id as string, e]));
  const guideMap = new Map((guides ?? []).map(g => [g.member_id as string, g]));

  return NextResponse.json(
    members.map(m => {
      const ev = evalMap.get(m.id);
      const strengths = ev?.strengths ?? "";
      const weaknesses = ev?.weaknesses ?? "";
      const saved = guideMap.get(m.id);
      const content = saved ? parseCoachingContent(saved.content) : null;
      const currentHash = coachingBasisHash({ position1st: m.position_1st, position2nd: m.position_2nd, strengths, weaknesses });
      return {
        id: m.id,
        name: m.name,
        position_1st: m.position_1st,
        position_2nd: m.position_2nd,
        has_input: Boolean(strengths.trim() || weaknesses.trim()),
        guide: saved && content ? { content, delivered_at: saved.delivered_at, updated_at: saved.updated_at } : null,
        stale: Boolean(saved && content && saved.basis_hash !== currentHash),
      };
    })
  );
}
