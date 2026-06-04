import { supabaseAdmin } from "./supabase";

export type TeamRole = "owner" | "manager" | "coach" | "member";

export async function getUserId(kakaoId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("kakao_id", kakaoId)
    .single();
  return data?.id ?? null;
}

/** active_team_id 기준으로 현재 팀 반환 */
export async function getTeamId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("active_team_id")
    .eq("id", userId)
    .single();
  return data?.active_team_id ?? null;
}

export async function getUserAndTeam(
  kakaoId: string
): Promise<{ userId: string | null; teamId: string | null }> {
  const userId = await getUserId(kakaoId);
  if (!userId) return { userId: null, teamId: null };
  const teamId = await getTeamId(userId);
  return { userId, teamId };
}

export async function getUserRole(
  userId: string,
  teamId: string
): Promise<TeamRole | null> {
  const { data } = await supabaseAdmin
    .from("team_users")
    .select("role")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .single();
  return (data?.role as TeamRole) ?? null;
}

/** 포지션 배정 / 경기 생성·삭제 가능 여부 (관리자, 감독, 코치) */
export function canManage(role: TeamRole | null): boolean {
  return role === "owner" || role === "manager" || role === "coach";
}

/** 역할 임명 / 강퇴 가능 여부 (관리자 전용) */
export function isOwner(role: TeamRole | null): boolean {
  return role === "owner";
}
