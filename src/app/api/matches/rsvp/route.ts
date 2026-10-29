import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

// POST /api/matches/rsvp  — 본인 출석 여부 등록/수정
// 참석이면 포지션 배정의 "참가 인원"(match_attendees)에 자동으로 넣고, 불참·미정이면 뺀다.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { match_id, status } = await req.json();
  if (!match_id || !["attending", "absent", "maybe"].includes(status)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { data: match } = await supabaseAdmin
    .from("matches")
    .select("id, match_date, match_end_time")
    .eq("id", match_id)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!match) return NextResponse.json({ error: "경기를 찾을 수 없어요" }, { status: 404 });

  // 끝난 경기는 바꿀 수 없다 — 참가 인원은 출전 기록(통계)에 쓰이기 때문. 서버 시간대와 상관없이 한국 시간(UTC+9) 기준.
  const [y, mo, d] = String(match.match_date).split("-").map(Number);
  const [h, min] = match.match_end_time ? String(match.match_end_time).split(":").map(Number) : [23, 59];
  if (Date.now() >= Date.UTC(y, mo - 1, d, h - 9, min)) {
    return NextResponse.json({ error: "이미 끝난 경기예요" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("match_rsvp")
    .upsert(
      { match_id, user_id: userId, status, updated_at: new Date().toISOString() },
      { onConflict: "match_id,user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 내 팀원 행 (과거 중복 행이 있을 수 있어 목록으로 조회). 용병·나간 팀원은 제외.
  const { data: myMembers, error: memberError } = await supabaseAdmin
    .from("team_members")
    .select("id, is_mercenary")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .is("left_at", null);
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  const memberIds = (myMembers ?? []).filter(m => !m.is_mercenary).map(m => m.id);
  if (memberIds.length > 0) {
    if (status === "attending") {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("match_attendees")
        .select("member_id")
        .eq("match_id", match_id)
        .eq("team_id", teamId)
        .in("member_id", memberIds);
      if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
      if (!existing?.length) {
        const { error: insertError } = await supabaseAdmin
          .from("match_attendees")
          .insert({ match_id, team_id: teamId, member_id: memberIds[0] });
        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    } else {
      const { error: deleteError } = await supabaseAdmin
        .from("match_attendees")
        .delete()
        .eq("match_id", match_id)
        .eq("team_id", teamId)
        .in("member_id", memberIds);
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
