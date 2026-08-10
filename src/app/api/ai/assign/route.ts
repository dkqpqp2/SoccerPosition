import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";
import Anthropic from "@anthropic-ai/sdk";

interface SlotInput {
  id: string;
  label: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  }

  const { slots, memberIds } = (await req.json()) as { slots: SlotInput[]; memberIds: string[] };

  if (!Array.isArray(slots) || slots.length === 0 || !Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({ error: "포메이션과 참가 인원을 먼저 설정해주세요." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI 기능이 설정되지 않았어요." }, { status: 500 });
  }

  const { data: teamMembers } = await supabaseAdmin
    .from("team_members")
    .select("id, name, position_1st, position_2nd, is_mercenary")
    .eq("team_id", teamId)
    .in("id", memberIds);

  const members = teamMembers ?? [];
  if (members.length === 0) {
    return NextResponse.json({ error: "참가 인원 정보를 찾을 수 없어요." }, { status: 400 });
  }

  const regularIds = members.filter(m => !m.is_mercenary).map(m => m.id);
  const { data: evalRows } = regularIds.length > 0
    ? await supabaseAdmin
        .from("member_evaluations")
        .select("member_id, strengths, weaknesses")
        .eq("team_id", teamId)
        .in("member_id", regularIds)
    : { data: [] as { member_id: string; strengths: string; weaknesses: string }[] };

  const evalMap = new Map((evalRows ?? []).map(e => [e.member_id, e]));

  const memberLines = members.map(m => {
    const positions = [m.position_1st, m.position_2nd].filter(Boolean).join("/") || "미지정";
    if (m.is_mercenary) {
      return `- ID:${m.id} | ${m.name} [용병] | 선호 포지션: ${positions}`;
    }
    const ev = evalMap.get(m.id);
    const parts = [`ID:${m.id}`, m.name, `선호 포지션: ${positions}`];
    if (ev?.strengths) parts.push(`장점: ${ev.strengths}`);
    if (ev?.weaknesses) parts.push(`단점: ${ev.weaknesses}`);
    return `- ${parts.join(" | ")}`;
  }).join("\n");

  const slotLines = slots.map(s => `- ID:${s.id} | 포지션: ${s.label}`).join("\n");

  const prompt = `당신은 풋살/축구 팀의 포지션 배정을 돕는 어시스턴트입니다. 아래 오늘 경기에 참가하는 선수 목록과 포메이션 슬롯 목록을 보고, 각 슬롯에 가장 적합한 선수를 한 명씩 배정해주세요.

선수 목록 (장단점이 있으면 참고해서 배정, 없으면 선호 포지션만 참고):
${memberLines}

포메이션 슬롯 목록:
${slotLines}

규칙:
- 각 선수는 최대 한 슬롯에만 배정. 슬롯 수보다 선수가 적으면 일부 슬롯은 비워두세요(null).
- 반드시 위에 제시된 ID만 사용하세요. 새로운 ID를 만들지 마세요.
- 선호 포지션이 슬롯과 정확히 일치하는 선수를 우선하고, 장단점(장점이 그 포지션에 어울리는지, 단점이 그 포지션에 치명적이지 않은지)을 참고해 조정하세요.

다음 JSON 형식으로만 응답하세요. 다른 텍스트나 마크다운 코드블록은 포함하지 마세요.
{
  "assignments": { "슬롯ID": "선수ID 또는 null", ... },
  "summary": "전체 배정 근거를 1~2문장으로 요약"
}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const completion = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = completion.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const raw = (textBlock?.text ?? "{}").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(raw);

    const validSlotIds = new Set(slots.map(s => s.id));
    const validMemberIds = new Set(members.map(m => m.id));

    const assignments: Record<string, string | null> = {};
    const usedMemberIds = new Set<string>();

    if (parsed.assignments && typeof parsed.assignments === "object") {
      for (const [slotId, memberId] of Object.entries(parsed.assignments)) {
        if (!validSlotIds.has(slotId)) continue;
        if (typeof memberId !== "string" || !validMemberIds.has(memberId) || usedMemberIds.has(memberId)) {
          assignments[slotId] = null;
          continue;
        }
        assignments[slotId] = memberId;
        usedMemberIds.add(memberId);
      }
    }
    for (const slot of slots) {
      if (!(slot.id in assignments)) assignments[slot.id] = null;
    }

    return NextResponse.json({
      assignments,
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Claude assign error:", msg);
    return NextResponse.json({ error: "AI 배정에 실패했어요. 다시 시도해주세요." }, { status: 500 });
  }
}
