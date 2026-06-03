export interface Position {
  value: string;
  label: string; // 표시용 (GK)
  description: string; // 한글 설명 (골키퍼)
}

export const POSITIONS: Position[] = [
  // 골키퍼
  { value: "GK", label: "GK", description: "골키퍼" },

  // 수비
  { value: "CB", label: "CB", description: "센터백" },
  { value: "LB", label: "LB", description: "레프트백" },
  { value: "RB", label: "RB", description: "라이트백" },
  { value: "LWB", label: "LWB", description: "레프트 윙백" },
  { value: "RWB", label: "RWB", description: "라이트 윙백" },

  // 미드필더
  { value: "CDM", label: "CDM", description: "수비형 미드필더 (센터)" },
  { value: "DM", label: "DM", description: "수비형 미드필더" },
  { value: "CM", label: "CM", description: "센터 미드필더" },
  { value: "LM", label: "LM", description: "레프트 미드필더" },
  { value: "RM", label: "RM", description: "라이트 미드필더" },
  { value: "CAM", label: "CAM", description: "공격형 미드필더 (센터)" },
  { value: "AM", label: "AM", description: "공격형 미드필더" },

  // 공격
  { value: "LW", label: "LW", description: "레프트 윙어" },
  { value: "RW", label: "RW", description: "라이트 윙어" },
  { value: "LF", label: "LF", description: "레프트 포워드" },
  { value: "RF", label: "RF", description: "라이트 포워드" },
  { value: "SS", label: "SS", description: "세컨드 스트라이커" },
  { value: "CF", label: "CF", description: "센터 포워드" },
  { value: "ST", label: "ST", description: "스트라이커" },
];

export const POSITION_GROUPS = [
  { label: "골키퍼", values: ["GK"] },
  { label: "수비", values: ["CB", "LB", "RB", "LWB", "RWB"] },
  { label: "미드필더", values: ["CDM", "DM", "CM", "LM", "RM", "CAM", "AM"] },
  { label: "공격", values: ["LW", "RW", "LF", "RF", "SS", "CF", "ST"] },
];

export const POSITION_MAP = Object.fromEntries(POSITIONS.map(p => [p.value, p]));
