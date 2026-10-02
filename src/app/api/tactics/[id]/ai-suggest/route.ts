import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";
import Anthropic from "@anthropic-ai/sdk";

// 하루 호출 제한 없이 쓸 수 있는 팀 (운영팀 본인 — 비용 폭주 방지 제한에서 제외)
const UNLIMITED_TEAM_ID = "0216d6ae-fcd1-4c2a-b439-4e2aad003e47";
const DAILY_LIMIT = 10;

interface TokenInput {
  team: "us" | "opp" | "ball";
  label?: string;
  pos?: string;
  x: number;
  y: number;
}

interface ArrowInput {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: "move" | "pass";
}

function kstDateString(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

function clamp01to100(n: unknown): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, v));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const { data: board } = await supabaseAdmin.from("tactics_boards").select("id").eq("id", id).eq("team_id", teamId).single();
  if (!board) return NextResponse.json({ error: "전술판을 찾을 수 없어요" }, { status: 404 });

  const body = await req.json();
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  const tokens: TokenInput[] = Array.isArray(body.tokens) ? body.tokens.slice(0, 30) : [];
  const existingArrows: ArrowInput[] = Array.isArray(body.arrows) ? body.arrows.slice(0, 30) : [];

  if (!question) return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI 기능이 설정되지 않았어요." }, { status: 500 });

  // 비용 폭주 방지: 팀당 하루 호출 횟수를 DB에서 원자적으로 증가시켜서
  // 동시 요청이 와도 제한을 넘기지 않도록 함 (읽고-나서-쓰기 방식은 경쟁 상태에 취약)
  const today = kstDateString();
  // DB 함수의 p_limit은 Postgres integer(최대 약 21억) 타입이라 Number.MAX_SAFE_INTEGER를
  // 넘기면 "integer out of range" 에러가 남 — int 범위 안의 충분히 큰 값을 사용
  const limit = teamId === UNLIMITED_TEAM_ID ? 999999999 : DAILY_LIMIT;

  const { data: newCount, error: usageError } = await supabaseAdmin.rpc("increment_ai_usage", {
    p_team_id: teamId,
    p_date: today,
    p_limit: limit,
  });
  if (usageError) return NextResponse.json({ error: "요청을 처리하지 못했어요." }, { status: 500 });
  if (newCount === null) {
    return NextResponse.json({ error: `오늘 AI 추천 횟수를 다 사용했어요 (하루 ${DAILY_LIMIT}회). 내일 다시 시도해주세요.` }, { status: 429 });
  }

  const tokenLines = tokens.map(t => {
    if (t.team === "ball") return `- 공 | x:${Math.round(t.x)} y:${Math.round(t.y)}`;
    const side = t.team === "us" ? "우리팀" : "상대팀";
    const label = t.label || t.pos || "(이름 없음)";
    return `- ${side} | ${label} | x:${Math.round(t.x)} y:${Math.round(t.y)}`;
  }).join("\n") || "(아직 아무도 배치되지 않음)";

  const arrowLines = existingArrows.map((a, i) => {
    const kind = a.type === "pass" ? "패스" : "움직임";
    return `- ${kind} ${i + 1}: (${Math.round(a.x1)}, ${Math.round(a.y1)}) → (${Math.round(a.x2)}, ${Math.round(a.y2)})`;
  }).join("\n") || "(아직 그려진 화살표 없음)";

  const prompt = `당신은 축구/풋살 팀의 전술 코치를 돕는 어시스턴트입니다. 전술판은 가로 0~100, 세로 0~100 좌표의 피치입니다.
- 우리팀은 아래쪽(세로좌표가 클수록 우리 골대, 작을수록 상대 골대)에 있고, 세로좌표가 작아지는 방향(위쪽)으로 공격합니다.
- 상대팀은 그 반대로, 위쪽이 상대 골대이고 아래쪽(세로좌표가 커지는 방향)으로 공격합니다.

현재 피치 배치:
${tokenLines}

코치가 이미 그려둔 화살표:
${arrowLines}

코치의 질문: ${question}

이미 그려둔 화살표가 있다면 그것과 자연스럽게 이어지거나 보완하는 제안을 해주세요 (이미 있는 동선을 그대로 중복해서 다시 그릴 필요는 없습니다). 이 상황에 대한 전술 제안을 화살표로 그려주세요. 화살표는 두 종류입니다:
- move(움직임, 빨간색): 선수가 공 없이 이동하는 동선
- pass(패스, 파란색): 공이 이동하는 경로

다음 JSON 형식으로만 응답하세요. 다른 텍스트나 마크다운 코드블록은 포함하지 마세요.
{
  "arrows": [
    { "x1": 0~100 숫자, "y1": 0~100 숫자, "x2": 0~100 숫자, "y2": 0~100 숫자, "mode": "curve 또는 straight", "type": "move 또는 pass" }
  ],
  "explanation": "이미 그려둔 화살표가 있다면 그것까지 고려해서, 왜 이런 제안을 하는지 2~4문장의 한국어로 자세히 설명"
}

화살표는 최대 6개까지만, 꼭 필요한 것만 그려주세요.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = completion.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const raw = (textBlock?.text ?? "{}").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(raw);

    const validModes = new Set(["curve", "straight"]);
    const validTypes = new Set(["move", "pass"]);

    const arrows = (Array.isArray(parsed.arrows) ? parsed.arrows : [])
      .slice(0, 6)
      .map((a: Record<string, unknown>) => {
        const x1 = clamp01to100(a.x1), y1 = clamp01to100(a.y1), x2 = clamp01to100(a.x2), y2 = clamp01to100(a.y2);
        if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
        return {
          x1, y1, x2, y2,
          mode: validModes.has(a.mode as string) ? a.mode : "curve",
          type: validTypes.has(a.type as string) ? a.type : "move",
        };
      })
      .filter((a: unknown): a is NonNullable<typeof a> => a !== null);

    return NextResponse.json({
      arrows,
      explanation: typeof parsed.explanation === "string" ? parsed.explanation.trim().slice(0, 1000) : "",
    });
  } catch (e) {
    // 실패한 호출은 할당량에서 제외 (최선 노력 — 실패해도 요청 자체는 이미 에러로 응답함)
    await supabaseAdmin.rpc("decrement_ai_usage", { p_team_id: teamId, p_date: today }).then(() => {}, () => {});
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Claude tactics ai-suggest error:", msg);
    return NextResponse.json({ error: "AI 추천에 실패했어요. 다시 시도해주세요." }, { status: 500 });
  }
}
