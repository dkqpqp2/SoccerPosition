import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

// POST /api/matches/rsvp  — 본인 출석 여부 등록/수정
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { match_id, status } = await req.json();
  if (!match_id || !["attending", "absent", "maybe"].includes(status)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { data: match } = await supabaseAdmin.from("matches").select("id").eq("id", match_id).eq("team_id", teamId).maybeSingle();
  if (!match) return NextResponse.json({ error: "경기를 찾을 수 없어요" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("match_rsvp")
    .upsert(
      { match_id, user_id: userId, status, updated_at: new Date().toISOString() },
      { onConflict: "match_id,user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
