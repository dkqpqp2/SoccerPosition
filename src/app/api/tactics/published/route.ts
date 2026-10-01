import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

// GET - 게시판 "팀전술" 탭용 — 팀원 전체 공개, 게시된 전술판만
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json([]);

  const { data, error } = await supabaseAdmin
    .from("tactics_boards")
    .select("id, title, formation_name, updated_at")
    .eq("team_id", teamId)
    .eq("published", true)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
