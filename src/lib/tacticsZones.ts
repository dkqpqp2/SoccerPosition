// 전술판 자유 배치용 구역 계산 — 우리 골대는 아래(y 큼), 공격 방향은 위(y 작음)
// 세로(y)로 5개 라인, 가로(x)로 좌/중/우로 나눠서 토큰이 놓인 자리로 포지션 이름과 포메이션 이름을 정한다.

interface ZoneToken {
  team: string;
  x: number;
  y: number;
  pos?: string;
}

const LINE_COUNT = 5;

function lineOf(y: number): number {
  if (y >= 66) return 0; // 수비
  if (y >= 56) return 1; // 수비형 미드 / 윙백
  if (y >= 36) return 2; // 중앙 미드
  if (y >= 28) return 3; // 공격형 미드
  return 4; // 공격
}

function sideOf(x: number): "L" | "C" | "R" {
  if (x < 25) return "L";
  if (x > 75) return "R";
  return "C";
}

const ZONE_POSITIONS: Record<"L" | "C" | "R", string>[] = [
  { L: "LB", C: "CB", R: "RB" },
  { L: "LWB", C: "CDM", R: "RWB" },
  { L: "LM", C: "CM", R: "RM" },
  { L: "LW", C: "CAM", R: "RW" },
  { L: "LW", C: "ST", R: "RW" },
];

export function zonePosition(x: number, y: number): string {
  return ZONE_POSITIONS[lineOf(y)][sideOf(x)];
}

// 우리팀 11명(GK 1 + 필드 10)일 때만 "4-3-3" 같은 이름을 만들고, 아니면 null
export function detectFormationName(tokens: ZoneToken[]): string | null {
  const us = tokens.filter(t => t.team === "us");
  const keepers = us.filter(t => t.pos === "GK");
  if (us.length !== 11 || keepers.length !== 1) return null;
  const counts = new Array(LINE_COUNT).fill(0);
  us.filter(t => t.pos !== "GK").forEach(t => { counts[lineOf(t.y)] += 1; });
  return counts.filter(c => c > 0).join("-");
}
