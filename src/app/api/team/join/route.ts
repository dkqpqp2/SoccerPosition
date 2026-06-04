import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserId } from "@/lib/team";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { invite_code } = await req.json();
  if (!invite_code) return NextResponse.json({ error: "초대 코드를 입력해주세요" }, { status: 400 });

  // 초대 코드로 팀 찾기
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("id, name, owner_id")
    .eq("invite_code", invite_code.trim().toLowerCase())
    .single();

  if (!team) return NextResponse.json({ error: "유효하지 않은 초대 코드예요" }, { status: 404 });

  // 내가 만든 팀에 초대 코드로 들어오려는 경우
  if (team.owner_id === userId) {
    return NextResponse.json({ error: "내가 만든 팀이에요" }, { status: 400 });
  }

  // 이미 이 팀에 속해있는지 확인
  const { data: existing } = await supabaseAdmin
    .from("team_users")
    .select("id")
    .eq("team_id", team.id)
    .eq("user_id", userId)
    .single();

  if (existing) {
    // 이미 가입된 팀이면 active만 전환
    await supabaseAdmin
      .from("users")
      .update({ active_team_id: team.id })
      .eq("id", userId);
    return NextResponse.json({ success: true, team_name: team.name });
  }

  // 이미 외부 팀에 가입돼있는지 확인 (내 팀 제외)
  const { data: myTeam } = await supabaseAdmin
    .from("teams")
    .select("id")
    .eq("owner_id", userId)
    .single();

  const { data: joinedTeams } = await supabaseAdmin
    .from("team_users")
    .select("team_id")
    .eq("user_id", userId)
    .neq("team_id", myTeam?.id ?? "");

  if (joinedTeams && joinedTeams.length >= 1) {
    return NextResponse.json(
      { error: "이미 다른 팀에 가입돼있어요. 먼저 그 팀을 나가야 해요." },
      { status: 400 }
    );
  }

  // 새 팀에 합류
  const { error } = await supabaseAdmin.from("team_users").insert({
    team_id: team.id,
    user_id: userId,
    role: "member",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // active_team_id를 새 팀으로 전환
  await supabaseAdmin
    .from("users")
    .update({ active_team_id: team.id })
    .eq("id", userId);

  // 유저 정보 + 선호 포지션 가져와서 team_members에 자동 추가
  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("name, display_name, position_1st, position_2nd")
    .eq("id", userId)
    .single();

  if (userData?.name) {
    // display_name 우선, 없으면 카카오 닉네임
    const displayName = userData.display_name || userData.name;

    // user_id로 중복 체크 (name이 같아도 별개의 사람일 수 있음)
    const { data: existingMember } = await supabaseAdmin
      .from("team_members")
      .select("id, user_id")
      .eq("team_id", team.id)
      .eq("user_id", userId)
      .single();

    if (!existingMember) {
      await supabaseAdmin.from("team_members").insert({
        user_id: userId,
        team_id: team.id,
        name: displayName,
        position_1st: userData.position_1st ?? null,
        position_2nd: userData.position_2nd ?? null,
        is_mercenary: false,
        is_cafe_mercenary: false,
      });
    }
  }

  return NextResponse.json({ success: true, team_name: team.name });
}
