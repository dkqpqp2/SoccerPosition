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

// ── 방 한가운데 전술판과 그 앞 의자 (의자는 분위기용이라 한 의자에 여러 명이 앉아도 된다) ──
export const BOARD_CENTER = { x: 0, z: -1.3 }; // 세워 둔 전술판이 서 있는 자리 (판은 앞(+z, 카메라 쪽)을 본다)
export const BOARD_W = 2.4; // 판 가로 (전술판 그림의 5:7 비율을 그대로 쓴다)
export const BOARD_H = 3.36;
export const BOARD_BOTTOM = 0.5; // 판 아래 끝의 바닥에서의 높이
// 설명하는 사람이 서는 자리: 판 오른쪽 옆 (판을 가리지 않으면서 같이 보이는 곳)
export const PRESENTER_SPOT = { x: BOARD_CENTER.x + BOARD_W / 2 + 1.1, z: BOARD_CENTER.z + 0.8 };
export const CHAIR_COUNT = 9;
const CHAIR_RADIUS = 3.6;
const CHAIR_STEP_DEG = 15;

/** i번째 의자: 판 앞쪽에 반원으로 놓이고(바닥 위치 x,z), rotY는 의자가 판 가운데를 바라보게 하는 회전 */
export function chairSlot(i: number): { x: number; z: number; rotY: number } {
  const theta = ((i - (CHAIR_COUNT - 1) / 2) * CHAIR_STEP_DEG * Math.PI) / 180;
  return {
    x: BOARD_CENTER.x + CHAIR_RADIUS * Math.sin(theta),
    z: BOARD_CENTER.z + CHAIR_RADIUS * Math.cos(theta),
    rotY: theta,
  };
}

/** 각도 a를 b쪽으로 가장 짧은 방향으로 t만큼 돌린다 */
export function lerpAngle(a: number, b: number, t: number) {
  const diff = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + diff * t;
}
