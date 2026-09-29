import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageScrimmage } from "@/lib/team";

const SQUAD_NAMES = ["A팀", "B팀", "C팀", "D팀"];

// 목록은 팀원 전체 공개
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json([]);

  const { data: leagues, error } = await supabaseAdmin
    .from("scrimmage_leagues")
    .select("*, scrimmages(id)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    (leagues ?? []).map(l => ({ ...l, round_count: l.scrimmages?.length ?? 0, scrimmages: undefined }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageScrimmage(role)) return NextResponse.json({ error: "관리자·매니저·회장만 리그를 만들 수 있어요" }, { status: 403 });

  const { title, sport, squad_count } = await req.json();
  const squadCount = Math.min(4, Math.max(2, Number(squad_count) || 2));
  if (sport !== "soccer" && sport !== "futsal") return NextResponse.json({ error: "종목을 선택해주세요" }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: "리그 이름을 입력해주세요" }, { status: 400 });

  const { data: league, error } = await supabaseAdmin
    .from("scrimmage_leagues")
    .insert({ team_id: teamId, title: title.trim(), sport, squad_count: squadCount, created_by: userId })
    .select()
    .single();

  if (error || !league) return NextResponse.json({ error: error?.message ?? "생성 실패" }, { status: 500 });

  const { error: squadError } = await supabaseAdmin
    .from("scrimmage_league_squads")
    .insert(
      Array.from({ length: squadCount }, (_, i) => ({
        league_id: league.id,
        name: SQUAD_NAMES[i],
        sort_order: i,
      }))
    );

  if (squadError) {
    await supabaseAdmin.from("scrimmage_leagues").delete().eq("id", league.id);
    return NextResponse.json({ error: squadError.message }, { status: 500 });
  }

  return NextResponse.json(league);
}
