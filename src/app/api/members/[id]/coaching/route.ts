import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";
import { buildCoachingPrompt, coachingBasisHash, parseCoachingContent } from "@/lib/coaching";
import { AI_DAILY_LIMIT, releaseAiUsage, reserveAiUsage } from "@/lib/aiQuota";

type Params = { params: Promise<{ id: string }> };

// AI 응답을 기다리는 시간(선수 한 명당 10~20초)이 기본 제한에 걸리지 않게 넉넉히 둔다
export const maxDuration = 60;

/** 요청한 사람이 관리자급인지, 대상이 이 팀의 정규 활동 팀원인지 확인한다 */
async function authorize(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return { error: NextResponse.json({ error: "Team not found" }, { status: 404 }) } as const;

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) return { error: NextResponse.json({ error: "권한이 없어요" }, { status: 403 }) } as const;

  const { data } = await supabaseAdmin
    .from("team_members")
    .select("id, position_1st, position_2nd")
    .eq("id", id)
    .eq("team_id", teamId)
    .eq("is_mercenary", false)
    .is("left_at", null)
    .limit(1);
  const member = data?.[0];
  if (!member) return { error: NextResponse.json({ error: "팀원을 찾을 수 없어요" }, { status: 404 }) } as const;

  return { userId, teamId, member } as const;
}

/** POST /api/members/[id]/coaching — 이 선수의 코칭 가이드를 AI로 만들어 저장 (다시 만들면 덮어씀, 전달 완료 표시는 해제) */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;
  const { userId, teamId, member } = auth;

  const { data: evalRows } = await supabaseAdmin
    .from("member_evaluations")
    .select("strengths, weaknesses")
    .eq("team_id", teamId)
    .eq("member_id", id)
    .limit(1);
  const strengths = evalRows?.[0]?.strengths ?? "";
  const weaknesses = evalRows?.[0]?.weaknesses ?? "";
  if (!strengths.trim() && !weaknesses.trim()) {
    return NextResponse.json({ error: "장점이나 단점을 먼저 적어 주세요." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI 기능이 설정되지 않았어요." }, { status: 500 });

  const reserved = await reserveAiUsage(teamId);
  if (reserved === "error") return NextResponse.json({ error: "요청을 처리하지 못했어요." }, { status: 500 });
  if (reserved === "limit") {
    return NextResponse.json({ error: `오늘 AI 사용 횟수를 다 썼어요 (하루 ${AI_DAILY_LIMIT}회). 내일 다시 시도해주세요.` }, { status: 429 });
  }

  const input = { position1st: member.position_1st, position2nd: member.position_2nd, strengths, weaknesses };
  try {
    const anthropic = new Anthropic({ apiKey });
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 900,
      messages: [{ role: "user", content: buildCoachingPrompt(input) }],
    });
    const textBlock = completion.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const raw = (textBlock?.text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const content = parseCoachingContent(JSON.parse(raw));
    if (!content) {
      await releaseAiUsage(teamId);
      return NextResponse.json({ error: "AI 결과를 읽지 못했어요. 다시 시도해주세요." }, { status: 502 });
    }

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("member_coaching_guides").upsert(
      { team_id: teamId, member_id: id, content, basis_hash: coachingBasisHash(input), delivered_at: null, created_by: userId, updated_at: now },
      { onConflict: "team_id,member_id" }
    );
    if (error) {
      await releaseAiUsage(teamId);
      console.error("coaching guide save error:", error.message);
      return NextResponse.json({ error: "가이드를 저장하지 못했어요. 다시 시도해주세요." }, { status: 500 });
    }
    return NextResponse.json({ guide: { content, delivered_at: null, updated_at: now }, stale: false });
  } catch (e) {
    await releaseAiUsage(teamId);
    console.error("Claude coaching guide error:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "AI 가이드를 만들지 못했어요. 다시 시도해주세요." }, { status: 500 });
  }
}

/** PUT /api/members/[id]/coaching { delivered: boolean } — 선수에게 피드백을 전달했다고 표시하거나 해제 */
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(id);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.delivered !== "boolean") {
    return NextResponse.json({ error: "delivered 값이 필요해요" }, { status: 400 });
  }

  const deliveredAt = body.delivered ? new Date().toISOString() : null;
  const { data, error } = await supabaseAdmin
    .from("member_coaching_guides")
    .update({ delivered_at: deliveredAt })
    .eq("team_id", auth.teamId)
    .eq("member_id", id)
    .select("member_id");
  if (error) return NextResponse.json({ error: "저장하지 못했어요" }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "가이드가 아직 없어요" }, { status: 404 });
  return NextResponse.json({ delivered_at: deliveredAt });
}
