import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [{ data: userData }, { data: teamData }, role] = await Promise.all([
    supabaseAdmin.from("users").select("name, email, image, position_1st, position_2nd, display_name, birth_year, kakao_name, jersey_number").eq("id", userId).single(),
    teamId
      ? supabaseAdmin.from("teams").select("name, color, logo_url, invite_code, owner_id, uniform_info").eq("id", teamId).single()
      : Promise.resolve({ data: null }),
    teamId ? getUserRole(userId, teamId) : Promise.resolve(null),
  ]);

  // 정규 팀원 평균 나이 계산
  let avg_age: number | null = null;
  if (teamId) {
    const { data: regularMembers } = await supabaseAdmin
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("is_mercenary", false)
      .not("user_id", "is", null);

    const memberUserIds = (regularMembers ?? []).map(m => m.user_id as string);
    if (memberUserIds.length > 0) {
      const { data: memberUsers } = await supabaseAdmin
        .from("users")
        .select("birth_year")
        .in("id", memberUserIds)
        .not("birth_year", "is", null);

      const birthYears = (memberUsers ?? []).map(u => u.birth_year as number);
      if (birthYears.length > 0) {
        const currentYear = new Date().getFullYear();
        const avgBirthYear = birthYears.reduce((sum, y) => sum + y, 0) / birthYears.length;
        avg_age = Math.round(currentYear - avgBirthYear);
      }
    }
  }

  // 현재 팀에서 내 team_members id 조회 (나간 표시된 중복 행 제외)
  let member_id: string | null = null;
  if (teamId && userId) {
    const { data: memberRows } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .is("left_at", null)
      .order("created_at", { ascending: true })
      .limit(1);
    member_id = memberRows?.[0]?.id ?? null;
  }

  return NextResponse.json({
    ...userData,
    member_id,
    // 표시 이름: display_name이 있으면 사용, 없으면 name(카카오)
    name: userData?.display_name || userData?.name,
    kakao_name: userData?.kakao_name || userData?.name,
    custom_name: userData?.display_name ?? null,
    position_1st: userData?.position_1st ?? null,
    position_2nd: userData?.position_2nd ?? null,
    birth_year: userData?.birth_year ?? null,
    jersey_number: userData?.jersey_number ?? null,
    team_id: teamId ?? null,
    team_name: teamData?.name ?? "우리팀",
    team_color: teamData?.color ?? "#16a34a",
    team_logo_url: teamData?.logo_url ?? null,
    invite_code: teamData?.invite_code ?? null,
    is_owner: teamData?.owner_id === userId,
    uniform_info: teamData?.uniform_info ?? null,
    role: role ?? null,
    avg_age,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { team_name, uniform_info, position_1st, position_2nd, display_name, birth_year, jersey_number } = await req.json();

  // 등번호 중복 체크 — 현재 팀의 활성 팀원 중 다른 사람이 이미 쓰고 있으면 거부 (나간 팀원은 제외)
  if (jersey_number !== undefined && jersey_number !== null && userId) {
    const { data: conflict } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("jersey_number", jersey_number)
      .neq("user_id", userId)
      .is("left_at", null)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json({ error: `이미 팀 안에 등번호 ${jersey_number}번을 쓰는 선수가 있어요.` }, { status: 409 });
    }
  }

  // 팀 정보 업데이트 — 팀을 만든 팀장(owner)만 가능
  if (team_name !== undefined || uniform_info !== undefined) {
    const role = userId ? await getUserRole(userId, teamId) : null;
    if (role !== "owner") {
      return NextResponse.json({ error: "팀 정보 수정 권한이 없어요. 팀장만 가능해요." }, { status: 403 });
    }
    await supabaseAdmin.from("teams").update({
      ...(team_name !== undefined && { name: team_name }),
      ...(uniform_info !== undefined && { uniform_info }),
    }).eq("id", teamId);
  }

  // 유저 포지션 선호도 + 이름 + 등번호 업데이트
  if (userId && (position_1st !== undefined || position_2nd !== undefined || display_name !== undefined || birth_year !== undefined || jersey_number !== undefined)) {
    await supabaseAdmin.from("users").update({
      ...(position_1st !== undefined && { position_1st: position_1st || null }),
      ...(position_2nd !== undefined && { position_2nd: position_2nd || null }),
      ...(display_name !== undefined && { display_name: display_name || null }),
      ...(birth_year !== undefined && { birth_year: birth_year || null }),
      ...(jersey_number !== undefined && { jersey_number: jersey_number ?? null }),
    }).eq("id", userId);

    // team_members에도 이름/포지션 동기화 (user_id로 연결된 모든 팀)
    if (display_name !== undefined || position_1st !== undefined || position_2nd !== undefined) {
      const syncData: Record<string, string | null> = {};

      if (display_name !== undefined) {
        // display_name이 null이면 카카오 닉네임으로 fallback
        if (display_name) {
          syncData.name = display_name;
        } else {
          const { data: currentUser } = await supabaseAdmin
            .from("users")
            .select("name")
            .eq("id", userId)
            .single();
          syncData.name = currentUser?.name ?? null;
        }
      }
      if (position_1st !== undefined) syncData.position_1st = position_1st || null;
      if (position_2nd !== undefined) syncData.position_2nd = position_2nd || null;

      await supabaseAdmin
        .from("team_members")
        .update(syncData)
        .eq("user_id", userId);
    }

    // 등번호는 별도로 동기화 — 다른 팀에서 중복 충돌이 나도 위 이름/포지션 저장에는 영향 없도록 분리
    if (jersey_number !== undefined) {
      await supabaseAdmin
        .from("team_members")
        .update({ jersey_number: jersey_number ?? null })
        .eq("user_id", userId)
        .eq("team_id", teamId);
    }
  }

  return NextResponse.json({ success: true });
}
