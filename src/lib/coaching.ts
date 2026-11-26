import { createHash } from "node:crypto";
import { POSITION_MAP } from "./positions";

// 선수별 AI 코칭 가이드: 입력 지문·프롬프트·결과 검증 (API 라우트가 쓰고, 단독으로 검증할 수 있게 분리)

export type CoachingInput = {
  position1st: string | null;
  position2nd: string | null;
  strengths: string;
  weaknesses: string;
};

export type CoachingContent = {
  play: string; // 이 자리에서 해 주면 좋은 플레이
  avoid: string; // 단점 때문에 피하면 좋은 것
  drills: string[]; // 추천 연습
  talk: string; // 감독·코치가 선수에게 건넬 대화 포인트
};

const MAX_TEXT = 700;
const MAX_DRILL = 200;
const MAX_DRILLS = 4;

const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** 가이드를 만들 때 쓴 입력의 지문. 희망 포지션·장점·단점 중 하나라도 바뀌면 달라진다 */
export function coachingBasisHash(input: CoachingInput): string {
  const key = JSON.stringify([norm(input.position1st), norm(input.position2nd), norm(input.strengths), norm(input.weaknesses)]);
  return createHash("sha1").update(key).digest("hex");
}

function positionText(code: string | null): string | null {
  const c = norm(code);
  if (!c) return null;
  const p = POSITION_MAP[c];
  return p ? `${p.label}(${p.description})` : c;
}

/** AI에 보내는 글. 이름·메모는 넣지 않는다(장점·단점·희망 포지션만) */
export function buildCoachingPrompt(input: CoachingInput): string {
  const first = positionText(input.position1st);
  const second = positionText(input.position2nd);
  const positions = [first && `1지망 ${first}`, second && `2지망 ${second}`].filter(Boolean).join(", ") || "미지정";
  return `당신은 아마추어 풋살/축구 팀의 코치를 돕는 어시스턴트입니다. 감독·코치가 선수에게 피드백을 줄 때 쓸 수 있도록, 아래 선수가 스스로 정한 희망 포지션과 그 선수의 장단점을 바탕으로 코칭 가이드를 작성해주세요.

선수 정보:
- 희망 포지션: ${positions}
- 장점: ${norm(input.strengths) || "(적혀 있지 않음)"}
- 단점/개선점: ${norm(input.weaknesses) || "(적혀 있지 않음)"}

작성 규칙:
- 선수가 원하는 포지션(1지망 우선)에서 장점을 살리는 구체적인 플레이를 제안하세요. 포지션이 미지정이면 장단점에 맞는 일반적인 방향을 제안하세요.
- 단점은 비난하지 말고 "이런 상황은 무리하지 말고 이렇게 풀기"처럼 피하면 좋은 선택으로 알려주세요.
- 추천 연습은 아마추어 팀이 연습 시간에 바로 해볼 수 있는 구체적인 훈련 3개로 쓰세요.
- 대화 포인트는 감독·코치가 선수에게 건넬 수 있는 자연스럽고 격려하는 말투의 두세 문장입니다.
- 적혀 있지 않은 내용을 지어내지 마세요. 정보가 적으면 적은 대로 일반적이고 안전한 조언만 하세요.

다음 JSON 형식으로만 응답하세요. 다른 텍스트나 마크다운 코드블록은 포함하지 마세요.
{
  "play": "이 포지션에서 해 주면 좋은 플레이 (2~3문장)",
  "avoid": "단점 때문에 피하면 좋은 것 (1~2문장)",
  "drills": ["추천 연습 1", "추천 연습 2", "추천 연습 3"],
  "talk": "감독·코치가 선수에게 건넬 대화 포인트 (2~3문장)"
}`;
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** AI가 돌려준 값을 검증해서 저장할 수 있는 모양으로 정리한다. 형식이 틀리면 null */
export function parseCoachingContent(raw: unknown): CoachingContent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const play = cleanText(o.play, MAX_TEXT);
  const avoid = cleanText(o.avoid, MAX_TEXT);
  const talk = cleanText(o.talk, MAX_TEXT);
  if (!play || !avoid || !talk) return null;
  if (!Array.isArray(o.drills)) return null;
  const drills = o.drills.map(d => cleanText(d, MAX_DRILL)).filter((d): d is string => d !== null).slice(0, MAX_DRILLS);
  if (drills.length === 0) return null;
  return { play, avoid, drills, talk };
}
