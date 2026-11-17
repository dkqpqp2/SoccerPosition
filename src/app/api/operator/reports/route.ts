import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOperatorUserId } from "@/lib/operator";
import { isReportTarget, type ReportTarget } from "@/lib/moderation";

interface Row { id: string; team_id: string; reporter_id: string; target_type: string; target_id: string; reason: string | null; created_at: string }

export interface ReportItem {
  key: string;
  target_type: ReportTarget;
  target_ids: string[];
  team_name: string | null;
  author_name: string | null;
  image_urls: string[];
  content: string | null;
  vote_title: string | null;
  reasons: string[];
  report_count: number;
  first_reported_at: string;
}

// GET - 아직 처리하지 않은 신고 목록 (운영자 전용). 같은 게시물(사진 묶음)에 대한 신고는 하나로 묶는다.
export async function GET() {
  if (!(await getOperatorUserId())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await supabaseAdmin
    .from("content_reports")
    .select("id, team_id, reporter_id, target_type, target_id, reason, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(500);
  const rows = ((data ?? []) as Row[]).filter(r => isReportTarget(r.target_type));

  const photoIds = [...new Set(rows.filter(r => r.target_type === "gallery_photo").map(r => r.target_id))];
  const commentIds = [...new Set(rows.filter(r => r.target_type === "vote_comment").map(r => r.target_id))];
  const teamIds = [...new Set(rows.map(r => r.team_id))];

  const [photos, comments, teams] = await Promise.all([
    photoIds.length ? supabaseAdmin.from("gallery_photos").select("id, team_id, group_id, member_id, image_url").in("id", photoIds) : Promise.resolve({ data: [] }),
    commentIds.length ? supabaseAdmin.from("vote_comments").select("id, vote_id, user_id, content").in("id", commentIds) : Promise.resolve({ data: [] }),
    teamIds.length ? supabaseAdmin.from("teams").select("id, name").in("id", teamIds) : Promise.resolve({ data: [] }),
  ]);

  const photoById = new Map((photos.data ?? []).map(p => [p.id as string, p]));
  const commentById = new Map((comments.data ?? []).map(c => [c.id as string, c]));
  const teamName = new Map((teams.data ?? []).map(t => [t.id as string, t.name as string]));

  const voteIds = [...new Set((comments.data ?? []).map(c => c.vote_id as string))];
  const memberIds = [...new Set((photos.data ?? []).map(p => p.member_id as string).filter(Boolean))];
  const commenterIds = [...new Set((comments.data ?? []).map(c => c.user_id as string).filter(Boolean))];
  const groupIds = [...new Set((photos.data ?? []).map(p => p.group_id as string).filter(Boolean))];

  const [votes, members, commenters, groupPhotos] = await Promise.all([
    voteIds.length ? supabaseAdmin.from("votes").select("id, team_id, title").in("id", voteIds) : Promise.resolve({ data: [] }),
    memberIds.length ? supabaseAdmin.from("team_members").select("id, team_id, name").in("id", memberIds) : Promise.resolve({ data: [] }),
    commenterIds.length ? supabaseAdmin.from("users").select("id, name").in("id", commenterIds) : Promise.resolve({ data: [] }),
    // 같은 묶음(group_id)의 사진은 한 게시물이라 한 번에 보여준다
    groupIds.length ? supabaseAdmin.from("gallery_photos").select("id, team_id, group_id, image_url").in("group_id", groupIds) : Promise.resolve({ data: [] }),
  ]);
  const voteById = new Map((votes.data ?? []).map(v => [v.id as string, v]));
  const memberById = new Map((members.data ?? []).map(m => [m.id as string, m]));
  const commenterName = new Map((commenters.data ?? []).map(u => [u.id as string, u.name as string]));

  const items = new Map<string, ReportItem>();
  for (const r of rows) {
    let item: ReportItem | undefined;

    if (r.target_type === "gallery_photo") {
      const p = photoById.get(r.target_id);
      if (!p || p.team_id !== r.team_id) continue; // 이미 지워졌거나 신고한 팀과 다른 팀의 사진
      const key = `photo:${p.group_id ?? p.id}`;
      item = items.get(key);
      if (!item) {
        const siblings = p.group_id
          ? (groupPhotos.data ?? []).filter(g => g.group_id === p.group_id && g.team_id === r.team_id)
          : [p];
        const member = p.member_id ? memberById.get(p.member_id as string) : undefined;
        item = {
          key,
          target_type: "gallery_photo",
          target_ids: siblings.map(s => s.id as string),
          team_name: teamName.get(r.team_id) ?? null,
          author_name: member && member.team_id === r.team_id ? (member.name as string) : null,
          image_urls: siblings.map(s => s.image_url as string),
          content: null,
          vote_title: null,
          reasons: [],
          report_count: 0,
          first_reported_at: r.created_at,
        };
        items.set(key, item);
      }
    } else {
      const c = commentById.get(r.target_id);
      if (!c) continue;
      const vote = voteById.get(c.vote_id as string);
      if (!vote || vote.team_id !== r.team_id) continue;
      const key = `comment:${c.id}`;
      item = items.get(key);
      if (!item) {
        item = {
          key,
          target_type: "vote_comment",
          target_ids: [c.id as string],
          team_name: teamName.get(r.team_id) ?? null,
          author_name: commenterName.get(c.user_id as string) ?? null,
          image_urls: [],
          content: c.content as string,
          vote_title: vote.title as string,
          reasons: [],
          report_count: 0,
          first_reported_at: r.created_at,
        };
        items.set(key, item);
      }
    }
    item.report_count += 1;
    if (r.reason && !item.reasons.includes(r.reason)) item.reasons.push(r.reason);
  }

  return NextResponse.json([...items.values()]);
}
