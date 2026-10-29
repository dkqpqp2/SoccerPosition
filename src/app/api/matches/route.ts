import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json([], { status: 200 });

  const { data: matchesRaw, error } = await supabaseAdmin
    .from("matches")
    .select("*, position_assignments(*)")
    .eq("team_id", teamId)
    .order("match_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!matchesRaw?.length) return NextResponse.json([]);

  // RSVP 데이터 일괄 조회
  const matchIds = matchesRaw.map(m => m.id);
  const { data: rsvps } = await supabaseAdmin
    .from("match_rsvp")
    .select("match_id, user_id, status")
    .in("match_id", matchIds);

  // RSVP 응답자 이름 조회
  const rsvpUserIds = [...new Set((rsvps ?? []).map(r => r.user_id))];
  const { data: rsvpUsers } = rsvpUserIds.length > 0
    ? await supabaseAdmin.from("users").select("id, name").in("id", rsvpUserIds)
    : { data: [] };

  const userNameMap: Record<string, string> = {};
  (rsvpUsers ?? []).forEach(u => { userNameMap[u.id] = u.name; });

  // 포지션 배정 화면에서 감독이 "참가 인원"에 직접 넣은 사람(match_attendees)도 참석으로 센다.
  // team_members는 이 팀의 현재 팀원만 조회 (다른 팀 id가 섞여 들어와도, 나간 팀원도 걸러짐).
  const [{ data: attendeeRows }, { data: teamMembers }] = await Promise.all([
    supabaseAdmin.from("match_attendees").select("match_id, member_id").eq("team_id", teamId).in("match_id", matchIds),
    supabaseAdmin.from("team_members").select("id, name, user_id, is_mercenary").eq("team_id", teamId).is("left_at", null),
  ]);
  const memberMap = new Map((teamMembers ?? []).map(m => [m.id, m]));
  // 아직 응답하지 않은 사람도 "미정"으로 보여주기 위한 기준 인원 (현재 정규 팀원, 용병 제외)
  const regularMemberCount = (teamMembers ?? []).filter(m => !m.is_mercenary).length;

  const matches = matchesRaw.map(match => {
    const matchRsvps = (rsvps ?? []).filter(r => r.match_id === match.id);

    // 사람 한 명당 한 번만 센다. 키는 user_id (계정이 없는 팀원은 팀원 id).
    const people = new Map<string, { name: string; status: string }>();
    matchRsvps.forEach(r => {
      people.set(r.user_id, { name: userNameMap[r.user_id] ?? "알 수 없음", status: r.status });
    });
    // 참석 응답과 참가 인원은 저장할 때 서로 맞춰 주지만(rsvp / attendees 라우트), 동기화 도입 전에 쌓인 기록은 어긋나 있을 수 있어
    // 참가 인원에 들어 있는 사람은 참석으로 본다. 용병은 따로 센다.
    const mercenaryIds = new Set<string>();
    (attendeeRows ?? []).filter(a => a.match_id === match.id).forEach(a => {
      const m = memberMap.get(a.member_id);
      if (!m) return;
      if (m.is_mercenary) {
        mercenaryIds.add(m.id);
        if (m.user_id) people.delete(m.user_id);
        return;
      }
      people.set(m.user_id ?? `m:${m.id}`, { name: m.name, status: "attending" });
    });

    const counts = { attending: 0, absent: 0, maybe: 0 };
    people.forEach(p => {
      if (p.status === "attending") counts.attending++;
      else if (p.status === "absent") counts.absent++;
      else if (p.status === "maybe") counts.maybe++;
    });
    // 내 상태: 참가 인원에 들어가 있으면 참석, 아니면 내가 누른 값 (둘은 저장할 때 서로 맞춰진다)
    const myStatus = userId ? people.get(userId)?.status ?? null : null;
    const rsvpList = [...people.entries()].map(([key, p]) => ({ user_id: key, name: p.name, status: p.status }));
    return { ...match, rsvp_counts: counts, regular_member_count: regularMemberCount, mercenary_count: mercenaryIds.size, my_rsvp: myStatus, rsvp_list: rsvpList };
  });

  return NextResponse.json(matches);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) {
    return NextResponse.json({ error: "경기 추가 권한이 없어요. 팀장 또는 부팀장만 가능해요." }, { status: 403 });
  }

  const { match_date, match_time, match_end_time, location, title, uniform_info, place_lat, place_lng } = await req.json();

  const { data, error } = await supabaseAdmin
    .from("matches")
    .insert({ user_id: userId, team_id: teamId, match_date, match_time: match_time || null, match_end_time: match_end_time || null, location: location || null, title, uniform_info: uniform_info || null, place_lat: place_lat ?? null, place_lng: place_lng ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 팀원 전체에게 경기 알림 전송
  try {
    const { data: members } = await supabaseAdmin
      .from("team_users")
      .select("user_id")
      .eq("team_id", teamId);

    if (members && members.length > 0) {
      const [year, mon, day] = (data.match_date as string).split("-").map(Number);
      const dateLabel = `${mon}월 ${day}일`;
      const notifications = members.map(m => ({
        user_id: m.user_id,
        team_id: teamId,
        type: "match_created",
        title: "새 경기가 등록됐어요 ⚽",
        body: `${dateLabel} 경기가 추가됐어요. 출석 여부를 알려주세요!`,
        link: "/matches",
        is_read: false,
      }));
      await supabaseAdmin.from("notifications").insert(notifications);
    }
  } catch (e) {
    console.error("match notification error:", e);
  }

  return NextResponse.json(data);
}
