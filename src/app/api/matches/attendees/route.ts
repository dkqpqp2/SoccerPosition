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

  // 바뀐 사람만 참석 응답에 반영하기 위해, 교체 전 참가 인원을 기억해 둔다
  const { data: beforeRows } = await supabaseAdmin
    .from("match_attendees")
    .select("member_id")
    .eq("match_id", match_id)
    .eq("team_id", teamId);
  const beforeIds = new Set((beforeRows ?? []).map(r => r.member_id as string));

  // 기존 삭제 후 새로 insert
  await supabaseAdmin
    .from("match_attendees")
    .delete()
    .eq("match_id", match_id)
    .eq("team_id", teamId);

  let afterIds = new Set<string>();
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
      afterIds = new Set(rows.map((r: { member_id: string }) => r.member_id));
    }
  }

  // 참석 응답 맞추기: 새로 넣은 사람은 "참석", 뺀 사람은 (참석이었다면) "미정"으로.
  // 계정이 없는 팀원(용병 등)은 응답 자체가 없으니 건너뛴다. 응답 맞추기에 실패해도 참가 인원 저장은 이미 끝났다.
  const added = [...afterIds].filter(id => !beforeIds.has(id));
  const removed = [...beforeIds].filter(id => !afterIds.has(id));
  if (added.length > 0 || removed.length > 0) {
    const { data: changedMembers } = await supabaseAdmin
      .from("team_members")
      .select("id, user_id")
      .eq("team_id", teamId)
      .in("id", [...added, ...removed]);
    const userOf = new Map((changedMembers ?? []).map(m => [m.id as string, m.user_id as string | null]));
    const now = new Date().toISOString();

    const addedUsers = [...new Set(added.map(id => userOf.get(id)).filter((u): u is string => !!u))];
    if (addedUsers.length > 0) {
      const { error } = await supabaseAdmin
        .from("match_rsvp")
        .upsert(addedUsers.map(user_id => ({ match_id, user_id, status: "attending", updated_at: now })), { onConflict: "match_id,user_id" });
      if (error) console.error("attendees → rsvp(attending) sync failed:", error.message);
    }

    const removedUsers = [...new Set(removed.map(id => userOf.get(id)).filter((u): u is string => !!u))];
    if (removedUsers.length > 0) {
      const { error } = await supabaseAdmin
        .from("match_rsvp")
        .update({ status: "maybe", updated_at: now })
        .eq("match_id", match_id)
        .eq("status", "attending")
        .in("user_id", removedUsers);
      if (error) console.error("attendees → rsvp(maybe) sync failed:", error.message);
    }
  }

  return NextResponse.json({ success: true });
}
