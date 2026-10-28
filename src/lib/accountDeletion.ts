import type { SupabaseClient } from "@supabase/supabase-js";

export const DELETED_NAME = "탈퇴한 회원";

export type DeleteAccountResult = { ok: true } | { ok: false; step: string; message: string };

/**
 * 회원 탈퇴 = 개인정보 삭제 + 익명화.
 *
 * 계정 행(users)이나 팀원 행(team_members)을 통째로 지우지 않는다. 이 둘을 가리키는 기록(경기·통계·회비·배정 등 30곳 이상)이
 * 있어서, 지우면 연결된 기록이 함께 지워지거나(팀원 행은 실제 DB에서 막히지 않고 지워지는 걸 시험으로 확인) 삭제가 막혀
 * 팀 기록이 깨진다. 대신 이름·이메일·사진 등 개인정보를 지우고 팀 기록에는 "탈퇴한 회원"으로 남긴다.
 *
 * 순서가 중요하다: 중간에 실패해도 다시 시도할 수 있도록(users를 kakao_id로 찾기 때문에) 계정 정보 지우기는 맨 마지막에 한다.
 * 각 단계는 여러 번 실행해도 결과가 같다(멱등). supabase-js에는 트랜잭션이 없어서 이렇게 설계했다.
 */
export async function deleteAccount(db: SupabaseClient, userId: string): Promise<DeleteAccountResult> {
  const fail = (step: string, message: string): DeleteAccountResult => ({ ok: false, step, message });

  // 1) 내가 owner인 팀: 다른 팀원이 있으면 가장 먼저 들어온 팀원에게 owner 승계.
  //    혼자 남은 팀은 지우지 않는다(팀 기록이 연결돼 있어 삭제가 막힘). 접근할 사람이 없는 기록으로 남는다.
  const owned = await db.from("teams").select("id").eq("owner_id", userId);
  if (owned.error) return fail("owned_teams", owned.error.message);

  for (const team of owned.data ?? []) {
    const next = await db
      .from("team_users")
      .select("user_id")
      .eq("team_id", team.id)
      .neq("user_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1);
    if (next.error) return fail("next_owner", next.error.message);

    const nextOwner = next.data?.[0];
    if (!nextOwner) continue;

    const t = await db.from("teams").update({ owner_id: nextOwner.user_id }).eq("id", team.id);
    if (t.error) return fail("transfer_team", t.error.message);
    const r = await db.from("team_users").update({ role: "owner" }).eq("team_id", team.id).eq("user_id", nextOwner.user_id);
    if (r.error) return fail("transfer_role", r.error.message);
  }

  // 2) 개인에게만 속한 기록 삭제 (다른 기록이 가리키지 않는 말단 데이터)
  for (const table of ["notifications", "push_subscriptions", "vote_comments", "vote_responses", "match_rsvp"]) {
    const d = await db.from(table).delete().eq("user_id", userId);
    if (d.error) return fail(`delete_${table}`, d.error.message);
  }

  // 3) 팀 소속 해제
  const tu = await db.from("team_users").delete().eq("user_id", userId);
  if (tu.error) return fail("team_users", tu.error.message);

  // 4) 팀원 행 익명화 — 행은 남겨서 통계·회비 등 팀 기록이 깨지지 않게 하고, 이름 등은 지운다. 현재 팀원 목록에서는 빠지도록 left_at 기록.
  const scrub = {
    name: DELETED_NAME,
    user_id: null,
    position_1st: null,
    position_2nd: null,
    status_note: null,
    referrer: null,
    jersey_number: null,
  };
  const m1 = await db.from("team_members").update({ ...scrub, left_at: new Date().toISOString() }).eq("user_id", userId).is("left_at", null);
  if (m1.error) return fail("team_members_active", m1.error.message);
  const m2 = await db.from("team_members").update(scrub).eq("user_id", userId);
  if (m2.error) return fail("team_members_left", m2.error.message);

  // 5) 계정 정보 지우기 (맨 마지막). kakao_id를 바꿔서 같은 카카오 계정으로 다시 가입하면 새 계정이 만들어지게 한다.
  const u = await db
    .from("users")
    .update({
      name: DELETED_NAME,
      email: null,
      image: null,
      display_name: null,
      kakao_name: null,
      birth_year: null,
      position_1st: null,
      position_2nd: null,
      jersey_number: null,
      team_name: null,
      active_team_id: null,
      kakao_id: `deleted:${userId}`,
    })
    .eq("id", userId);
  if (u.error) return fail("users", u.error.message);

  return { ok: true };
}
