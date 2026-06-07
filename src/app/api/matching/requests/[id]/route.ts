import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function getMyTeamId(kakaoId: string) {
  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("kakao_id", kakaoId).single();
  if (!user) return null;
  const { data: team } = await supabaseAdmin
    .from("teams").select("id").eq("owner_id", user.id).single();
  return team?.id ?? null;
}

async function incrementFutsalCount(teamId: string) {
  const { data: p } = await supabaseAdmin
    .from("team_profiles").select("futsal_match_count").eq("team_id", teamId).single();
  if (p) {
    await supabaseAdmin.from("team_profiles")
      .update({ futsal_match_count: (p.futsal_match_count ?? 0) + 1 })
      .eq("team_id", teamId);
  }
}

// PATCH - 수락 / 거절 / 취소
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const teamId = await getMyTeamId(session.user.id);
  if (!teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { status, cancel_reason } = await req.json();

  const { data: request } = await supabaseAdmin
    .from("match_requests").select("*").eq("id", id).single();
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  // 권한 체크
  const isMyRequest = request.from_team_id === teamId || request.to_team_id === teamId;
  if (status === "cancelled" && !isMyRequest)
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  if ((status === "accepted" || status === "rejected") && request.to_team_id !== teamId)
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("match_requests")
    .update({
      status,
      cancel_reason: cancel_reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 수락 시 → 연결된 매칭 등록 자동 마감
  if (status === "accepted" && request.listing_id) {
    await supabaseAdmin
      .from("match_listings")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", request.listing_id);
  }

  // 취소 시 → 경기관리에서 자동 생성된 경기 삭제
  if (status === "cancelled") {
    const matchIdsToDelete = [request.from_match_id, request.to_match_id].filter(Boolean);
    if (matchIdsToDelete.length > 0) {
      await supabaseAdmin.from("matches").delete().in("id", matchIdsToDelete);
    }
  }

  // 취소 시 → 연결된 매칭 등록 자동 재오픈
  if (status === "cancelled" && request.listing_id) {
    // 해당 listing에 아직 accepted 상태인 다른 신청이 없을 때만 재오픈
    const { data: otherAccepted } = await supabaseAdmin
      .from("match_requests")
      .select("id")
      .eq("listing_id", request.listing_id)
      .eq("status", "accepted")
      .neq("id", id)
      .limit(1);

    if (!otherAccepted || otherAccepted.length === 0) {
      await supabaseAdmin
        .from("match_listings")
        .update({ status: "open", updated_at: new Date().toISOString() })
        .eq("id", request.listing_id);
    }
  }

  // 수락 시 → 양쪽 팀 경기 자동 생성
  if (status === "accepted") {
    const [{ data: fromTeam }, { data: toTeam }] = await Promise.all([
      supabaseAdmin.from("teams").select("id, name, owner_id").eq("id", request.from_team_id).single(),
      supabaseAdmin.from("teams").select("id, name, owner_id").eq("id", request.to_team_id).single(),
    ]);

    if (fromTeam && toTeam) {
      const matchDate    = request.proposed_date ?? new Date().toISOString().slice(0, 10);
      const matchTime    = request.proposed_time ?? null;
      const matchEndTime = request.proposed_end_time ?? null;
      const location     = request.proposed_location ?? null;
      const placeLat     = request.place_lat ?? null;
      const placeLng     = request.place_lng ?? null;

      // 신청팀 경기
      const { data: fromMatch } = await supabaseAdmin.from("matches").insert({
        user_id: fromTeam.owner_id,
        team_id: fromTeam.id,
        title: `${fromTeam.name} vs ${toTeam.name}`,
        match_date: matchDate,
        match_time: matchTime,
        match_end_time: matchEndTime,
        location,
        place_lat: placeLat,
        place_lng: placeLng,
      }).select("id").single();

      // 수락팀 경기
      const { data: toMatch } = await supabaseAdmin.from("matches").insert({
        user_id: toTeam.owner_id,
        team_id: toTeam.id,
        title: `${toTeam.name} vs ${fromTeam.name}`,
        match_date: matchDate,
        match_time: matchTime,
        match_end_time: matchEndTime,
        location,
        place_lat: placeLat,
        place_lng: placeLng,
      }).select("id").single();

      // 생성된 경기 ID를 match_request에 저장
      if (fromMatch?.id || toMatch?.id) {
        await supabaseAdmin.from("match_requests").update({
          from_match_id: fromMatch?.id ?? null,
          to_match_id: toMatch?.id ?? null,
        }).eq("id", id);
      }

      // 풋살이면 매칭 횟수 +1
      if (request.game_type === "풋살") {
        await Promise.all([
          incrementFutsalCount(fromTeam.id),
          incrementFutsalCount(toTeam.id),
        ]);
      }
    }
  }

  return NextResponse.json(data);
}
