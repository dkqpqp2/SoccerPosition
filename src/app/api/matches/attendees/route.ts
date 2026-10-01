import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";

/** GET /api/matches/attendees?matchId=... */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const matchId = req.nextUrl.searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("match_attendees")
    .select("member_id")
    .eq("match_id", matchId)
    .eq("team_id", teamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ member_ids: (data ?? []).map(r => r.member_id) });
}

/** POST /api/matches/attendees — member_ids 배열로 통째로 교체 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  }

  const { match_id, member_ids } = await req.json();
  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  // match_id가 실제 이 팀 소속인지 검증
  const { data: match } = await supabaseAdmin.from("matches").select("id").eq("id", match_id).eq("team_id", teamId).maybeSingle();
  if (!match) return NextResponse.json({ error: "경기를 찾을 수 없어요" }, { status: 404 });

  // 기존 삭제 후 새로 insert
  await supabaseAdmin
    .from("match_attendees")
    .delete()
    .eq("match_id", match_id)
    .eq("team_id", teamId);

  if (member_ids && member_ids.length > 0) {
    // member_id가 실제 이 팀 소속인 것만 허용
    const { data: validMembers } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .in("id", member_ids);
    const validIds = new Set((validMembers ?? []).map(m => m.id));
    const rows = member_ids
      .filter((member_id: string) => validIds.has(member_id))
      .map((member_id: string) => ({
        match_id,
        team_id: teamId,
        member_id,
      }));
    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from("match_attendees").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
