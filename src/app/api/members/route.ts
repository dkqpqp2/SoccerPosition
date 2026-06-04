import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json([], { status: 200 });

  const { data, error } = await supabaseAdmin
    .from("team_members")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { name, position_1st, position_2nd, is_mercenary, is_cafe_mercenary, referrer } = await req.json();
  if (!name) return NextResponse.json({ error: "이름을 입력해주세요" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("team_members")
    .insert({ user_id: userId, team_id: teamId, name, position_1st, position_2nd, is_mercenary: !!is_mercenary, is_cafe_mercenary: !!is_cafe_mercenary, referrer: is_mercenary && !is_cafe_mercenary ? (referrer || null) : null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
