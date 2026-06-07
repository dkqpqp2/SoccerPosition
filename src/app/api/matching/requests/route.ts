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

// GET - 내 팀의 매칭 신청 목록 (보낸 것 + 받은 것)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teamId = await getMyTeamId(session.user.id);
  if (!teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("match_requests")
    .select(`
      *,
      from_team:teams!match_requests_from_team_id_fkey(id, name, color),
      to_team:teams!match_requests_to_team_id_fkey(id, name, color)
    `)
    .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST - 매칭 신청
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teamId = await getMyTeamId(session.user.id);
  if (!teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { to_team_id, game_type, proposed_date, proposed_time, proposed_end_time, proposed_location, place_lat, place_lng, message, listing_id } = await req.json();

  // 중복 신청 방지
  const { data: existing } = await supabaseAdmin
    .from("match_requests")
    .select("id")
    .eq("from_team_id", teamId)
    .eq("to_team_id", to_team_id)
    .eq("status", "pending")
    .single();

  if (existing) return NextResponse.json({ error: "이미 신청 중인 팀입니다" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("match_requests")
    .insert({
      from_team_id: teamId,
      to_team_id,
      game_type,
      proposed_date: proposed_date || null,
      proposed_time: proposed_time || null,
      proposed_end_time: proposed_end_time || null,
      proposed_location: proposed_location || null,
      place_lat: place_lat ?? null,
      place_lng: place_lng ?? null,
      message,
      status: "pending",
      listing_id: listing_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
