import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";
import { areEvaluationsPublic, isLoungeEnabled } from "@/lib/lounge";

export const dynamic = "force-dynamic";

type LockerMember = {
  id: string;
  name: string;
  jersey_number: number | null;
  position_1st: string | null;
  position_2nd: string | null;
  is_me: boolean;
  strengths: string;
  weaknesses: string;
};

// 로컬 개발에서 로그인 없이 화면을 볼 때만 쓰는 예시 데이터
function demoMembers(): LockerMember[] {
  const base: Omit<LockerMember, "id" | "is_me">[] = [
    { name: "김민수", jersey_number: 9, position_1st: "ST", position_2nd: "LW", strengths: "골 결정력이 좋고 침투 타이밍이 빨라요.", weaknesses: "수비 가담이 늦을 때가 있어요." },
    { name: "이준호", jersey_number: 10, position_1st: "CM", position_2nd: null, strengths: "패스가 정확하고 시야가 넓어요.", weaknesses: "체력이 후반에 떨어져요." },
    { name: "박지성", jersey_number: 7, position_1st: "RW", position_2nd: "CM", strengths: "활동량이 많고 돌파가 좋아요.", weaknesses: "" },
    { name: "최영훈", jersey_number: 4, position_1st: "CB", position_2nd: null, strengths: "", weaknesses: "" },
    { name: "정우성", jersey_number: null, position_1st: null, position_2nd: null, strengths: "", weaknesses: "" },
  ];
  return base.map((m, i) => ({ ...m, id: `demo-${i}`, is_me: i === 1 }));
}

/** GET /api/lounge/lockers — 라운지 락커 한 칸 = 팀원 한 명. 이름·등번호·포지션과 (공개 팀이면) 장단점 */
export async function GET() {
  const isDev = process.env.NODE_ENV === "development";

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    if (isDev) return NextResponse.json({ members: demoMembers(), demo: true });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId || !isLoungeEnabled(teamId)) {
    if (isDev) return NextResponse.json({ members: demoMembers(), demo: true });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const role = await getUserRole(userId, teamId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 현재 정규 팀원만 (나간 팀원·용병 제외). 모든 조회에 team_id 조건.
  const { data: rows, error } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id, name, jersey_number, position_1st, position_2nd")
    .eq("team_id", teamId)
    .eq("is_mercenary", false)
    .is("left_at", null);
  if (error) return NextResponse.json({ error: "팀원을 불러오지 못했어요" }, { status: 500 });

  // 장단점은 공개 팀에만 내려보낸다. 메모는 여기서 읽지도 않는다.
  const evalMap: Record<string, { strengths: string; weaknesses: string }> = {};
  if (areEvaluationsPublic(teamId) && rows?.length) {
    const { data: evals } = await supabaseAdmin
      .from("member_evaluations")
      .select("member_id, strengths, weaknesses")
      .eq("team_id", teamId);
    (evals ?? []).forEach(e => {
      evalMap[e.member_id as string] = { strengths: (e.strengths as string) ?? "", weaknesses: (e.weaknesses as string) ?? "" };
    });
  }

  // 등번호 순(없으면 맨 뒤), 같으면 이름 순 — 락커 자리가 팀원이 바뀌지 않는 한 그대로 유지된다
  const members: LockerMember[] = (rows ?? [])
    .map(m => ({
      id: m.id as string,
      name: m.name as string,
      jersey_number: (m.jersey_number as number | null) ?? null,
      position_1st: (m.position_1st as string | null) ?? null,
      position_2nd: (m.position_2nd as string | null) ?? null,
      is_me: m.user_id === userId,
      strengths: evalMap[m.id as string]?.strengths ?? "",
      weaknesses: evalMap[m.id as string]?.weaknesses ?? "",
    }))
    .sort((a, b) => (a.jersey_number ?? 9999) - (b.jersey_number ?? 9999) || a.name.localeCompare(b.name, "ko"));

  return NextResponse.json({ members });
}
