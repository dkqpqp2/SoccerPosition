// 공유 링크(/share/**)의 카카오톡·SNS 미리보기용 데이터와 메타데이터를 만든다.
// 서버에서만 사용. 팀원 이름·피드백 내용 같은 개인 정보는 미리보기에 넣지 않고,
// 공유 페이지에 이미 보이는 팀 이름·경기명·날짜·인원수 정도만 쓴다.
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export const SITE_URL = "https://www.soccerpositionmanagement.com";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-11-01" → "11월 1일 (일)" — new Date("YYYY-MM-DD")는 UTC로 읽혀 하루 밀리므로 직접 파싱 */
export function formatKoDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}

/** 카드에 한 줄로 보이는 설명 만들기 (빈 값 제외, 길면 자르기) */
export function joinDescription(parts: Array<string | null | undefined>, fallback: string): string {
  const text = parts.filter((p): p is string => !!p && p.trim().length > 0).join(" · ");
  if (!text) return fallback;
  return text.length > 90 ? `${text.slice(0, 89)}…` : text;
}

/** 폴더에 자체 opengraph-image 파일이 없는 공유 페이지가 쓰는 기본 이미지 (src/app/opengraph-image.png) */
const DEFAULT_OG_IMAGE = { url: "/opengraph-image.png", width: 1200, height: 630, alt: "SPM - 축구·풋살 팀 관리" };

/**
 * 공유 페이지용 메타데이터. 하위 경로에서 openGraph/twitter를 지정하면 루트 값이 통째로 교체되므로
 * siteName·locale 등 필요한 값을 모두 다시 넣는다. 루트의 이미지도 같이 사라지기 때문에,
 * 자체 opengraph-image 파일이 없는 페이지는 ownImage=false(기본값)로 기본 이미지를 직접 지정한다.
 */
export function buildShareMetadata(title: string, description: string, path: string, ownImage = false): Metadata {
  const full = `${title} | SPM`;
  return {
    title,
    description,
    openGraph: {
      title: full, description, url: `${SITE_URL}${path}`, siteName: "SPM", locale: "ko_KR", type: "website",
      ...(ownImage ? {} : { images: [DEFAULT_OG_IMAGE] }),
    },
    twitter: {
      card: "summary_large_image", title: full, description,
      ...(ownImage ? {} : { images: [DEFAULT_OG_IMAGE.url] }),
    },
  };
}

// 이하 조회 함수: 필요한 컬럼만 select (공개 라우트라 select("*") 금지), 못 찾으면 null

type MatchRef = { match_date: string | null; title: string | null } | null;
const firstOrSelf = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export async function getAssignmentPreview(id: string) {
  const { data } = await supabaseAdmin
    .from("position_assignments")
    .select("session_name, formation_name, formation_slots, matches(match_date, title)")
    .eq("id", id)
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  return {
    sessionName: row.session_name as string,
    formationName: row.formation_name as string,
    formationSlots: row.formation_slots as Array<{ id: string; label: string; x: number; y: number }> | null,
    match: firstOrSelf<MatchRef>(row.matches as MatchRef | MatchRef[]),
  };
}

export async function getScrimmagePreview(id: string) {
  const { data } = await supabaseAdmin
    .from("scrimmages")
    .select("title, sport, match_date")
    .eq("id", id)
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  return { title: row.title as string | null, sport: row.sport as string, matchDate: row.match_date as string | null };
}

interface SharedListMatchInfo { match_date?: string | null; title?: string | null; location?: string | null }

export async function getSharedListPreview(id: string) {
  const { data } = await supabaseAdmin
    .from("shared_lists")
    .select("team_name, data")
    .eq("id", id)
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  const d = (row.data ?? {}) as { members?: unknown[]; match_info?: SharedListMatchInfo | null };
  return {
    teamName: row.team_name as string,
    memberCount: Array.isArray(d.members) ? d.members.length : null,
    matchInfo: d.match_info ?? null,
  };
}
