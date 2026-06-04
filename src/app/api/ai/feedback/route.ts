import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserAndTeam, getUserRole, canFeedback } from "@/lib/team";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canFeedback(role)) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  }

  const { playerName, positions, characteristics, performance } = await req.json();

  if (!playerName || !performance) {
    return NextResponse.json({ error: "선수 이름과 경기력 설명이 필요해요." }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI 기능이 설정되지 않았어요." }, { status: 500 });
  }

  const groq = new Groq({ apiKey });

  const prompt = `당신은 축구 코치입니다. 선수에게 건설적이고 구체적인 피드백을 한국어로 작성해주세요.

선수 정보:
- 이름: ${playerName}
- 포지션: ${positions?.join(", ") || "미지정"}
${characteristics ? `- 선수 특징: ${characteristics}` : ""}

오늘 경기 내용:
${performance}

위 내용을 바탕으로 3~5문장의 개인 피드백을 작성해주세요.
- 잘한 점과 개선할 점을 균형 있게 포함
- 구체적이고 실용적인 조언 포함
- 선수를 격려하는 톤으로 작성
- 피드백 텍스트만 출력 (제목, 번호 없이)`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ feedback: text.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Groq error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
