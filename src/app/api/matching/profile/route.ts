import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, isOwner } from "@/lib/team";

// GET - 내 팀 프로필 조회
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await getUserAndTeam(session.user.id);
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

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) return NextResponse.json({ error: "팀장만 이용할 수 있어요" }, { status: 403 });

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
