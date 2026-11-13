import { supabaseAdmin } from "./supabase";

// 사용자가 올린 콘텐츠(사진·댓글)를 신고하고 작성자를 차단하는 기능의 공통 로직. (App Store 심사 규정: 사용자 콘텐츠가 있는 앱은 신고·차단 수단 필수)
export const REPORT_TARGETS = ["gallery_photo", "vote_comment"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export function isReportTarget(value: unknown): value is ReportTarget {
  return typeof value === "string" && (REPORT_TARGETS as readonly string[]).includes(value);
}

export interface HiddenContent {
  blocked: Set<string>;
  reported: Record<ReportTarget, Set<string>>;
}

/** 내가 차단한 사용자와 내가 신고한 콘텐츠 — 목록에서 걸러낼 때 쓴다. */
export async function loadHidden(userId: string): Promise<HiddenContent> {
  const [blocks, reports] = await Promise.all([
    supabaseAdmin.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
    supabaseAdmin.from("content_reports").select("target_type, target_id").eq("reporter_id", userId),
  ]);
  const hidden: HiddenContent = {
    blocked: new Set((blocks.data ?? []).map(b => b.blocked_id as string)),
    reported: { gallery_photo: new Set(), vote_comment: new Set() },
  };
  (reports.data ?? []).forEach(r => {
    if (isReportTarget(r.target_type)) hidden.reported[r.target_type].add(r.target_id as string);
  });
  return hidden;
}

/**
 * 신고·차단 대상이 이 팀의 것인지 확인하고, 신고 대상 id들과 작성자(user id)를 알려준다. 이 팀 것이 아니면 null.
 * - 사진: 같은 묶음(group_id)의 사진은 한 게시물이라 함께 신고한다.
 */
export async function resolveTarget(
  type: ReportTarget,
  targetId: string,
  teamId: string
): Promise<{ ids: string[]; authorUserId: string | null } | null> {
  if (type === "vote_comment") {
    const { data: comment } = await supabaseAdmin
      .from("vote_comments")
      .select("id, vote_id, user_id")
      .eq("id", targetId)
      .limit(1);
    const c = comment?.[0];
    if (!c) return null;
    const { data: vote } = await supabaseAdmin.from("votes").select("id").eq("id", c.vote_id).eq("team_id", teamId).limit(1);
    if (!vote?.length) return null;
    return { ids: [c.id as string], authorUserId: (c.user_id as string) ?? null };
  }

  const { data: photo } = await supabaseAdmin
    .from("gallery_photos")
    .select("id, group_id, member_id")
    .eq("id", targetId)
    .eq("team_id", teamId)
    .limit(1);
  const p = photo?.[0];
  if (!p) return null;

  let ids = [p.id as string];
  if (p.group_id) {
    const { data: group } = await supabaseAdmin.from("gallery_photos").select("id").eq("team_id", teamId).eq("group_id", p.group_id);
    ids = (group ?? []).map(g => g.id as string);
  }
  let authorUserId: string | null = null;
  if (p.member_id) {
    const { data: member } = await supabaseAdmin
      .from("team_members")
      .select("user_id")
      .eq("id", p.member_id)
      .eq("team_id", teamId)
      .limit(1);
    authorUserId = (member?.[0]?.user_id as string) ?? null;
  }
  return { ids, authorUserId };
}
