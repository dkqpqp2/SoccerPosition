import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

/** GET /api/matches/attendees?matchId=... */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const matchId = req.nextUrl.searchParams.get("matchId");
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("match_attendees")
    .select("member_id")
    .eq("match_id", matchId)
    .eq("team_id", teamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ member_ids: (data ?? []).map(r => r.member_id) });
}

/** POST /api/matches/attendees — member_ids 배열로 통째로 교체 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { match_id, member_ids } = await req.json();
  if (!match_id) return NextResponse.json({ error: "match_id required" }, { status: 400 });

  // 기존 삭제 후 새로 insert
  await supabaseAdmin
    .from("match_attendees")
    .delete()
    .eq("match_id", match_id)
    .eq("team_id", teamId);

  if (member_ids && member_ids.length > 0) {
    const rows = member_ids.map((member_id: string) => ({
      match_id,
      team_id: teamId,
      member_id,
    }));
    const { error } = await supabaseAdmin.from("match_attendees").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
