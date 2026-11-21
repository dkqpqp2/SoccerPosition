import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";

/** PUT /api/members/[id]/stats-exclusion  body: { excluded: boolean }
 *  부상 등으로 쉬는 정규 팀원을 통계(순위·통계 관리·라운지 명예의 전당)에서 잠시 뺀다. 기록은 지우지 않는다. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.excluded !== "boolean") {
    return NextResponse.json({ error: "excluded 값이 필요해요" }, { status: 400 });
  }

  // 이 팀의 현재 정규 팀원만 (용병·나간 팀원 제외). id는 PK라 중복 걱정 없음.
  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id, is_mercenary, left_at")
    .eq("id", id)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!member || member.left_at) return NextResponse.json({ error: "팀원을 찾을 수 없어요" }, { status: 404 });
  if (member.is_mercenary) return NextResponse.json({ error: "용병은 통계에 포함되지 않아요" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("team_members")
    .update({ stats_excluded: body.excluded })
    .eq("id", id)
    .eq("team_id", teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id, stats_excluded: body.excluded });
}
