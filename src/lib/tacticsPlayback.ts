import type { Arrow, Token } from "@/lib/tacticsBoard";

/**
 * 전술판 재생 계산. 전술판 페이지와 팀 라운지의 전술 설명이 똑같이 움직이도록 한 곳에서 계산한다.
 * 화살표(움직임·패스)를 단계로 묶고, 시간이 흐른 만큼 선수·공이 어디에 있는지를 돌려준다. 화면 그리기·타이머는 쓰는 쪽이 맡는다.
 */

// 단계 길이는 거리에 비례: 공은 BALL_SPEED, 선수는 PLAYER_SPEED로 가는 시간 중 더 오래 걸리는 쪽에 맞춰
// 같은 번호의 움직임·패스가 동시에 도착함 (속도 단위: 피치 가로 % / 초)
const BALL_SPEED = 45;
const PLAYER_SPEED = 25;
const MIN_STEP_MS = 800;
const MAX_STEP_MS = 3500;
const EMPTY_STEP_MS = 300;
const MOVER_MAX_DIST = 14; // 움직임 화살표 시작점에서 이 거리(피치 가로 % 기준) 안의 가장 가까운 선수가 그 화살표를 따라 움직임
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

type PlaybackArrow = Pick<Arrow, "x1" | "y1" | "x2" | "y2" | "mode">;

export type Positions = Record<string, { x: number; y: number }>;

export interface PlaybackStep {
  moves: { tokenId: string; arrow: Arrow }[];
  pass?: { arrow: Arrow };
  durationMs: number;
}

// 피치가 세로로 1.4배 길어서 세로 거리에 1.4를 곱하고, 곡선은 직선보다 조금 더 길게 침
function arrowLength(a: PlaybackArrow) {
  return Math.hypot(a.x2 - a.x1, (a.y2 - a.y1) * 1.4) * (a.mode === "curve" ? 1.1 : 1);
}

function pointOnArrow(a: PlaybackArrow, t: number) {
  if (a.mode === "straight") return { x: a.x1 + (a.x2 - a.x1) * t, y: a.y1 + (a.y2 - a.y1) * t };
  const dx = a.x2 - a.x1;
  const dy = a.y2 - a.y1;
  const len = Math.hypot(dx, dy) || 1;
  const cx = (a.x1 + a.x2) / 2 + (-dy / len) * len * 0.2;
  const cy = (a.y1 + a.y2) / 2 + (dx / len) * len * 0.2;
  const u = 1 - t;
  return { x: u * u * a.x1 + 2 * u * t * cx + t * t * a.x2, y: u * u * a.y1 + 2 * u * t * cy + t * t * a.y2 };
}

// 같은 번호의 움직임·패스를 한 단계로 묶음. 움직임은 시작점에서 가장 가까운 선수(이전 단계 이동 결과 기준)가 따라가고,
// 패스는 공 토큰이 있을 때만 재생됨
// 단계는 공이 가는 패스 순서대로 만들고, 도착 지점이 그 패스 끝점 근처인 움직임을 같은 단계에 묶어서
// 공과 선수가 같은 시간에 같은 지점으로 도착하게 함. 어떤 패스와도 안 맞는 움직임은 번호 순서대로
// 같은 번호의 단계에 붙이고(없으면 새 단계), 움직임은 시작점에서 가장 가까운 선수(이전 단계 이동 결과 기준)가 따라감
export function buildPlaybackSteps(tokens: Token[], arrows: Arrow[]): PlaybackStep[] {
  const moves = arrows.filter(a => a.type === "move");
  const ballExists = tokens.some(t => t.team === "ball");
  const passes = ballExists ? arrows.filter(a => a.type === "pass") : [];
  const cur: Positions = {};
  tokens.forEach(t => { cur[t.id] = { x: t.x, y: t.y }; });

  const steps: PlaybackStep[] = passes.map(p => ({ moves: [], pass: { arrow: p }, durationMs: EMPTY_STEP_MS }));
  const stepMoves: Arrow[][] = steps.map(() => []);
  const unpaired: Arrow[] = [];
  for (const m of moves) {
    let bestJ = -1;
    let bestD = Infinity;
    passes.forEach((p, j) => {
      const d = Math.hypot(p.x2 - m.x2, (p.y2 - m.y2) * 1.4);
      if (d <= MOVER_MAX_DIST && d < bestD) { bestD = d; bestJ = j; }
    });
    if (bestJ >= 0) stepMoves[bestJ].push(m);
    else unpaired.push(m);
  }
  unpaired.forEach((m, u) => {
    while (steps.length <= u) { steps.push({ moves: [], durationMs: EMPTY_STEP_MS }); stepMoves.push([]); }
    stepMoves[u].push(m);
  });

  steps.forEach((step, i) => {
    for (const m of stepMoves[i]) {
      let best: { id: string; d: number } | null = null;
      for (const t of tokens) {
        if (t.team === "ball") continue;
        const d = Math.hypot(cur[t.id].x - m.x1, (cur[t.id].y - m.y1) * 1.4);
        if (d <= MOVER_MAX_DIST && (!best || d < best.d)) best = { id: t.id, d };
      }
      if (best) {
        step.moves.push({ tokenId: best.id, arrow: m });
        cur[best.id] = { x: m.x2, y: m.y2 };
      }
    }
    // 공이 그 단계에서 움직이는 선수 중 가장 가까운 도착점에 정확히 도착하게 맞춤
    if (step.pass) {
      const pa = step.pass.arrow;
      let target: Arrow | null = null;
      let targetD = Infinity;
      for (const mv of step.moves) {
        const d = Math.hypot(pa.x2 - mv.arrow.x2, (pa.y2 - mv.arrow.y2) * 1.4);
        if (d <= MOVER_MAX_DIST && d < targetD) { targetD = d; target = mv.arrow; }
      }
      if (target) step.pass = { arrow: { ...pa, x2: target.x2, y2: target.y2 } };
    }
    const needMs = Math.max(
      step.pass ? (arrowLength(step.pass.arrow) / BALL_SPEED) * 1000 : 0,
      ...step.moves.map(mv => (arrowLength(mv.arrow) / PLAYER_SPEED) * 1000),
    );
    if (needMs > 0) step.durationMs = Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, needMs));
  });
  return steps;
}

export function playbackTotalMs(steps: PlaybackStep[]): number {
  return steps.reduce((sum, s) => sum + s.durationMs, 0);
}

/** 재생을 시작하고 elapsedMs가 지났을 때 모든 말(선수·상대·공)의 위치. 끝나면 모두 도착한 위치. */
export function positionsAt(steps: PlaybackStep[], tokens: Token[], elapsedMs: number): Positions {
  const ballId = tokens.find(t => t.team === "ball")?.id;
  const pos: Positions = {};
  tokens.forEach(t => { pos[t.id] = { x: t.x, y: t.y }; });
  const done = elapsedMs >= playbackTotalMs(steps);
  let stepStart = 0;
  for (const s of steps) {
    const local = elapsedMs - stepStart;
    stepStart += s.durationMs;
    const prog = done || local >= s.durationMs ? 1 : local <= 0 ? 0 : ease(local / s.durationMs);
    if (prog === 0) continue;
    s.moves.forEach(mv => { pos[mv.tokenId] = pointOnArrow(mv.arrow, prog); });
    if (s.pass && ballId) pos[ballId] = pointOnArrow(s.pass.arrow, prog);
  }
  return pos;
}
