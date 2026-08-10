import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserAndTeam, getUserRole, canFeedback } from "@/lib/team";
import { POSITIONS } from "@/lib/positions";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canFeedback(role)) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  }

  const { playerName, position1st, position2nd, strengths, weaknesses } = await req.json();

  if (!playerName || !strengths?.trim() || !weaknesses?.trim()) {
    return NextResponse.json({ error: "선수 이름과 장점, 단점을 모두 입력해주세요." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI 기능이 설정되지 않았어요." }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });

  const positionList = POSITIONS.map(p => `${p.value}(${p.description})`).join(", ");

  const prompt = `당신은 축구 코치의 선수 평가 작성을 돕는 어시스턴트입니다. 아래 선수 정보와 코치가 대충 적은 메모를 바탕으로, 더 구체적이고 읽기 좋은 장단점 평가와 추천 포지션을 작성해주세요.

선수 정보:
- 이름: ${playerName}
- 현재 선호 포지션: ${[position1st, position2nd].filter(Boolean).join(", ") || "미지정"}

코치가 적은 메모:
- 장점: ${strengths}
- 단점: ${weaknesses}

사용 가능한 포지션 코드 (이 중에서만 추천): ${positionList}

다음 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
{
  "strengths": "장점을 2~3문장의 자연스러운 한국어로 다듬은 내용",
  "weaknesses": "단점/개선점을 2~3문장의 자연스러운 한국어로 다듬은 내용 (건설적인 톤)",
  "recommended_positions": ["포지션코드1", "포지션코드2"],
  "reason": "왜 이 포지션을 추천하는지 1~2문장"
}

recommended_positions는 최대 2개, 위에 제시된 코드만 사용하세요. JSON 외의 다른 텍스트나 마크다운 코드블록(\`\`\`)은 절대 포함하지 마세요.`;

  try {
    const completion = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = completion.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const raw = (textBlock?.text ?? "{}").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(raw);

    const validCodes = new Set(POSITIONS.map(p => p.value));
    const recommended = Array.isArray(parsed.recommended_positions)
      ? parsed.recommended_positions.filter((p: unknown): p is string => typeof p === "string" && validCodes.has(p)).slice(0, 2)
      : [];

    return NextResponse.json({
      strengths: typeof parsed.strengths === "string" ? parsed.strengths.trim() : "",
      weaknesses: typeof parsed.weaknesses === "string" ? parsed.weaknesses.trim() : "",
      recommended_positions: recommended,
      reason: typeof parsed.reason === "string" ? parsed.reason.trim() : "",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Claude evaluation error:", msg);
    return NextResponse.json({ error: "AI 응답을 처리하지 못했어요. 다시 시도해주세요." }, { status: 500 });
  }
}
