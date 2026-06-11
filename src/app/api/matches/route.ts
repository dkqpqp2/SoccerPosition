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

  const matches = matchesRaw.map(match => {
    const matchRsvps = (rsvps ?? []).filter(r => r.match_id === match.id);
    const counts = { attending: 0, absent: 0, maybe: 0 };
    matchRsvps.forEach(r => {
      if (r.status === "attending") counts.attending++;
      else if (r.status === "absent") counts.absent++;
      else if (r.status === "maybe") counts.maybe++;
    });
    const myRsvp = matchRsvps.find(r => r.user_id === userId);
    const rsvpList = matchRsvps.map(r => ({
      user_id: r.user_id,
      name: userNameMap[r.user_id] ?? "알 수 없음",
      status: r.status,
    }));
    return { ...match, rsvp_counts: counts, my_rsvp: myRsvp?.status ?? null, rsvp_list: rsvpList };
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
