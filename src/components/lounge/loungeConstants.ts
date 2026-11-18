// 라운지 장면과 캐릭터가 함께 쓰는 값들

export const SPEED = 3.8; // 캐릭터가 걷는 속도(초당 이동 거리)
export const SPAWN_Z = 5.5; // 처음 서는 자리(앞쪽)

/** 머리색 고르기(연한 파스텔) — 첫 번째가 기본색 */
// 라운지 조명이 밝아서 색이 연하게 씻겨 보이므로, 실제 값은 파스텔보다 조금 진하게 잡았다
export const HEAD_COLORS = ["#7fd3ff", "#ff9ebb", "#ffe066", "#9be8a0", "#c3a6ff", "#ffb77a", "#e8eef5"];

// ── 벤치 자리: 벤치 2개 × 4자리 = 8자리. 자리 번호 0~7 (벤치 0: 0~3, 벤치 1: 4~7) ──
export const BENCH_LENGTH = 4.4;
export const BENCH_CENTERS: readonly (readonly [number, number])[] = [
  [-5.5, 3.4],
  [5.5, 3.4],
];
export const SEATS_PER_BENCH = 4;
export const SEAT_COUNT = BENCH_CENTERS.length * SEATS_PER_BENCH;
const SEAT_SPACING = 1.1; // 머리 지름이 약 1이라 이보다 좁으면 겹친다

/** 자리 번호 → 바닥 위치(x, z). 앉은 캐릭터는 앞(+z, 카메라 쪽)을 본다 */
export function seatPosition(seat: number): { x: number; z: number } {
  const bench = Math.floor(seat / SEATS_PER_BENCH);
  const slot = seat % SEATS_PER_BENCH;
  const [cx, cz] = BENCH_CENTERS[bench];
  return { x: cx + (slot - (SEATS_PER_BENCH - 1) / 2) * SEAT_SPACING, z: cz };
}

/** 올바른 자리 번호인지(정수, 0 이상 SEAT_COUNT 미만) */
export function isValidSeat(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < SEAT_COUNT;
}

/** 각도 a를 b쪽으로 가장 짧은 방향으로 t만큼 돌린다 */
export function lerpAngle(a: number, b: number, t: number) {
  const diff = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + diff * t;
}
