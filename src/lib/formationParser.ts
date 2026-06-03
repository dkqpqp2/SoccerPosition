import { PositionSlot } from "./formations";

// 레이어별 포지션 자동 배정
function getPositionsForLayer(count: number, layerIndex: number, totalLayers: number): string[] {
  const isDefense = layerIndex === 0;
  const isAttack = layerIndex === totalLayers - 1;

  if (count === 1) {
    if (isAttack) return ["ST"];
    if (isDefense) return ["SW"];
    return ["CAM"];
  }
  if (count === 2) {
    if (isAttack) return ["ST", "ST"];
    if (isDefense) return ["CB", "CB"];
    return ["CDM", "CDM"];
  }
  if (count === 3) {
    if (isAttack) return ["LW", "ST", "RW"];
    if (isDefense) return ["CB", "CB", "CB"];
    return ["LM", "CM", "RM"];
  }
  if (count === 4) {
    if (isAttack) return ["LW", "SS", "SS", "RW"];
    if (isDefense) return ["LB", "CB", "CB", "RB"];
    return ["LM", "CM", "CM", "RM"];
  }
  if (count === 5) {
    if (isDefense) return ["LWB", "LB", "CB", "RB", "RWB"];
    return ["LM", "CM", "CAM", "CM", "RM"];
  }
  // 그 외
  return Array(count).fill("CM");
}

export function parseFormation(input: string): PositionSlot[] | null {
  // "4-2-3-1" 형태 파싱
  const parts = input.trim().split("-").map(Number);
  if (parts.some(isNaN) || parts.length < 2) return null;

  const slots: PositionSlot[] = [];

  // GK 고정
  slots.push({ id: "GK", label: "GK", x: 50, y: 90 });

  const totalLayers = parts.length;
  // y 위치: 수비(아래)~공격(위)
  // 레이어 0 = 수비 (y 높음), 마지막 = 공격 (y 낮음)
  const yPositions = parts.map((_, i) => {
    const range = 65; // 15% ~ 80%
    return Math.round(80 - (i / (totalLayers - 1)) * range);
  });

  parts.forEach((count, layerIndex) => {
    const y = yPositions[layerIndex];
    const positions = getPositionsForLayer(count, layerIndex, totalLayers);

    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 50 : Math.round(10 + (i / (count - 1)) * 80);
      slots.push({
        id: `${layerIndex}-${i}`,
        label: positions[i] || "CM",
        x,
        y,
      });
    }
  });

  return slots;
}
