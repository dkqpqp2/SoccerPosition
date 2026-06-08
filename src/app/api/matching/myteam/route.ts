import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("kakao_id", session.user.id).single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("id, name")
    .eq("owner_id", user.id)
    .single();

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  return NextResponse.json({ team_id: team.id, team_name: team.name });
}
