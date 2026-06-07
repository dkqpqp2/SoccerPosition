import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function getTeamId(userId: string) {
  const { data } = await supabaseAdmin
    .from("teams")
    .select("id")
    .eq("owner_id", userId)
    .single();
  return data?.id ?? null;
}

// GET - 내 팀 프로필 조회
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("kakao_id", session.user.id).single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const teamId = await getTeamId(user.id);
  if (!teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("team_profiles")
    .select("*")
    .eq("team_id", teamId)
    .single();

  return NextResponse.json(data ?? null);
}

// POST - 팀 프로필 생성/수정 (upsert)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("kakao_id", session.user.id).single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const teamId = await getTeamId(user.id);
  if (!teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const body = await req.json();
  const {
    description, region, age_group, skill_level, player_background,
    game_type, preferred_days, preferred_time, activity_frequency, kakao_open_chat, is_public,
  } = body;

  const { data, error } = await supabaseAdmin
    .from("team_profiles")
    .upsert({
      team_id: teamId,
      is_public: is_public ?? false,
      description,
      region,
      age_group,
      skill_level,
      player_background,
      game_type: game_type ?? [],
      preferred_days: preferred_days ?? [],
      preferred_time,
      activity_frequency,
      kakao_open_chat,
      updated_at: new Date().toISOString(),
    }, { onConflict: "team_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
