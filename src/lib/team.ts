import { supabaseAdmin } from "./supabase";

export type TeamRole = "owner" | "manager" | "coach" | "president" | "member" | "treasurer";

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

/** 포지션 배정 / 경기 생성·삭제 가능 여부 (관리자, 감독, 코치, 회장) */
export function canManage(role: TeamRole | null): boolean {
  return role === "owner" || role === "manager" || role === "coach" || role === "president";
}

/** 피드백 작성 가능 여부 (관리자, 감독, 코치, 회장) */
export function canFeedback(role: TeamRole | null): boolean {
  return role === "owner" || role === "manager" || role === "coach" || role === "president";
}

/** 역할 임명 / 강퇴 가능 여부 (관리자 전용) */
export function isOwner(role: TeamRole | null): boolean {
  return role === "owner";
}

/** 회비 관리 가능 여부 (관리자 or 총무) */
export function canManageDues(role: TeamRole | null): boolean {
  return role === "owner" || role === "treasurer";
}

/** 내전 생성·관리 가능 여부 (관리자, 매니저, 회장 — 코치 제외) */
export function canManageScrimmage(role: TeamRole | null): boolean {
  return role === "owner" || role === "manager" || role === "president";
}

/**
 * 포지션 배정 result(슬롯id -> {id: member_id, ...} | null)에 담긴 member_id가
 * 실제 이 팀 소속인지 검증 — 아니면 미배정(null)으로 치환해서 다른 팀 id가 섞여 들어가는 것 방지
 */
export async function sanitizeResult(
  result: Record<string, { id: string; [key: string]: unknown } | null> | null | undefined,
  teamId: string
): Promise<Record<string, { id: string; [key: string]: unknown } | null>> {
  if (!result || typeof result !== "object") return {};

  const candidateIds = Object.values(result)
    .filter((m): m is { id: string } => !!m && typeof m.id === "string")
    .map(m => m.id);

  if (candidateIds.length === 0) return result as Record<string, { id: string; [key: string]: unknown } | null>;

  const { data: validMembers } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .in("id", candidateIds);
  const validIds = new Set((validMembers ?? []).map(m => m.id));

  const sanitized: Record<string, { id: string; [key: string]: unknown } | null> = {};
  for (const [slotId, member] of Object.entries(result)) {
    sanitized[slotId] = member && validIds.has(member.id) ? member : null;
  }
  return sanitized;
}
