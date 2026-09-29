import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageScrimmage } from "@/lib/team";

// PATCH - 맞대결 스코어 입력/수정
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; fixtureId: string }> }) {
  const { id, fixtureId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageScrimmage(role)) return NextResponse.json({ error: "관리자·매니저·회장만 결과를 입력할 수 있어요" }, { status: 403 });

  const { data: scrimmage } = await supabaseAdmin.from("scrimmages").select("id").eq("id", id).eq("team_id", teamId).single();
  if (!scrimmage) return NextResponse.json({ error: "내전을 찾을 수 없어요" }, { status: 404 });

  const { score_a, score_b } = await req.json();

  const { data, error } = await supabaseAdmin
    .from("scrimmage_fixtures")
    .update({
      score_a: score_a === null || score_a === "" ? null : Number(score_a),
      score_b: score_b === null || score_b === "" ? null : Number(score_b),
    })
    .eq("id", fixtureId)
    .eq("scrimmage_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
