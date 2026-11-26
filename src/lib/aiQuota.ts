import { supabaseAdmin } from "./supabase";

// AI 기능의 팀당 하루 호출 제한 (전술판 AI와 같은 카운터 `increment_ai_usage`를 쓴다)
// 운영팀 본인(우리 팀)은 비용 폭주 방지 제한에서 제외한다.
const UNLIMITED_TEAM_ID = "0216d6ae-fcd1-4c2a-b439-4e2aad003e47";
export const AI_DAILY_LIMIT = 10;
const UNLIMITED = 999999999; // Postgres integer 범위 안의 충분히 큰 값 (Number.MAX_SAFE_INTEGER는 범위를 넘어 오류)

function kstDateString(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

/** 호출 한 번을 미리 차감한다. 한도를 넘으면 "limit", DB 오류면 "error" */
export async function reserveAiUsage(teamId: string): Promise<"ok" | "limit" | "error"> {
  const { data, error } = await supabaseAdmin.rpc("increment_ai_usage", {
    p_team_id: teamId,
    p_date: kstDateString(),
    p_limit: teamId === UNLIMITED_TEAM_ID ? UNLIMITED : AI_DAILY_LIMIT,
  });
  if (error) return "error";
  return data === null ? "limit" : "ok";
}

/** AI 호출이 실패했을 때 차감을 되돌린다(최선 노력) */
export async function releaseAiUsage(teamId: string): Promise<void> {
  await supabaseAdmin.rpc("decrement_ai_usage", { p_team_id: teamId, p_date: kstDateString() }).then(() => {}, () => {});
}
