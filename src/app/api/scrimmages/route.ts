import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, isOwner } from "@/lib/team";

const SQUAD_NAMES = ["A팀", "B팀", "C팀", "D팀"];

// TODO: 내전 기능 테스트 중 — 지금은 owner에게만 공개. 정식 오픈 시 이 체크 제거
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json([]);

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) return NextResponse.json([]);

  const { data: scrimmages, error } = await supabaseAdmin
    .from("scrimmages")
    .select("*, scrimmage_squads(id)")
    .eq("team_id", teamId)
    .order("match_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    (scrimmages ?? []).map(s => ({ ...s, squad_count_actual: s.scrimmage_squads?.length ?? 0, scrimmage_squads: undefined }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) return NextResponse.json({ error: "관리자만 내전을 만들 수 있어요" }, { status: 403 });

  const { title, sport, match_date, squad_count } = await req.json();
  const squadCount = Math.min(4, Math.max(2, Number(squad_count) || 2));
  if (sport !== "soccer" && sport !== "futsal") return NextResponse.json({ error: "종목을 선택해주세요" }, { status: 400 });

  const { data: scrimmage, error } = await supabaseAdmin
    .from("scrimmages")
    .insert({
      team_id: teamId,
      title: title?.trim() || null,
      sport,
      match_date: match_date || null,
      squad_count: squadCount,
      created_by: userId,
    })
    .select()
    .single();

  if (error || !scrimmage) return NextResponse.json({ error: error?.message ?? "생성 실패" }, { status: 500 });

  const { data: squads, error: squadError } = await supabaseAdmin
    .from("scrimmage_squads")
    .insert(
      Array.from({ length: squadCount }, (_, i) => ({
        scrimmage_id: scrimmage.id,
        name: SQUAD_NAMES[i],
        sort_order: i,
      }))
    )
    .select();

  if (squadError || !squads) {
    await supabaseAdmin.from("scrimmages").delete().eq("id", scrimmage.id);
    return NextResponse.json({ error: squadError?.message ?? "생성 실패" }, { status: 500 });
  }

  // 스쿼드 간 맞대결 전체 조합(라운드로빈) 자동 생성
  const sortedSquads = [...squads].sort((a, b) => a.sort_order - b.sort_order);
  const fixtures: { scrimmage_id: string; squad_a_id: string; squad_b_id: string; sort_order: number }[] = [];
  for (let i = 0; i < sortedSquads.length; i++) {
    for (let j = i + 1; j < sortedSquads.length; j++) {
      fixtures.push({
        scrimmage_id: scrimmage.id,
        squad_a_id: sortedSquads[i].id,
        squad_b_id: sortedSquads[j].id,
        sort_order: fixtures.length,
      });
    }
  }
  const { error: fixtureError } = await supabaseAdmin.from("scrimmage_fixtures").insert(fixtures);
  if (fixtureError) {
    await supabaseAdmin.from("scrimmages").delete().eq("id", scrimmage.id);
    return NextResponse.json({ error: fixtureError.message }, { status: 500 });
  }

  return NextResponse.json(scrimmage);
}
