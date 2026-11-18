// 라운지 장면과 캐릭터가 함께 쓰는 값들

export const SPEED = 3.8; // 캐릭터가 걷는 속도(초당 이동 거리)
export const SPAWN_Z = 5.5; // 처음 서는 자리(앞쪽)

/** 머리색 고르기(연한 파스텔) — 첫 번째가 기본색 */
// 라운지 조명이 밝아서 색이 연하게 씻겨 보이므로, 실제 값은 파스텔보다 조금 진하게 잡았다
export const HEAD_COLORS = ["#7fd3ff", "#ff9ebb", "#ffe066", "#9be8a0", "#c3a6ff", "#ffb77a", "#e8eef5"];

/** 각도 a를 b쪽으로 가장 짧은 방향으로 t만큼 돌린다 */
export function lerpAngle(a: number, b: number, t: number) {
  const diff = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + diff * t;
}
