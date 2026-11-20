import { useSyncExternalStore } from "react";
import type { BoardSnapshot } from "@/lib/tacticsBoard";
import { buildPlaybackSteps, playbackTotalMs, positionsAt, type Positions } from "@/lib/tacticsPlayback";

/**
 * 라운지 전술판 재생 상태. 화면 여러 곳(3D 판, 설명 패널, 보는 패널)이 같이 보는데, 재생 중에는 프레임마다 위치가 바뀐다.
 * 라운지 장면 전체가 매 프레임 다시 그려지지 않게, 상태를 React 밖에 두고 필요한 곳만 구독한다(useSyncExternalStore).
 * 3D 판은 프레임마다 캔버스를 다시 그리므로 갱신은 초당 30번까지만 한다.
 */

export type PlaybackSnapshot = { playing: boolean; positions: Positions | null };

export type PlaybackStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => PlaybackSnapshot;
  /** 이 판으로 처음부터 재생한다. 재생할 단계가 없으면 false */
  start: (board: BoardSnapshot) => boolean;
  /** 멈추고 판의 원래 위치로 돌아간다 */
  reset: () => void;
  dispose: () => void;
};

const FRAME_MS = 33;
const IDLE: PlaybackSnapshot = { playing: false, positions: null };

export function createPlaybackStore(): PlaybackStore {
  let snap: PlaybackSnapshot = IDLE;
  let raf: number | null = null;
  const listeners = new Set<() => void>();

  const set = (next: PlaybackSnapshot) => {
    snap = next;
    listeners.forEach(l => l());
  };
  const cancel = () => {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snap,
    start(board) {
      cancel();
      const steps = buildPlaybackSteps(board.tokens, board.arrows);
      if (steps.length === 0) {
        if (snap.playing || snap.positions) set(IDLE);
        return false;
      }
      const total = playbackTotalMs(steps);
      const t0 = performance.now();
      let last = -Infinity;
      set({ playing: true, positions: positionsAt(steps, board.tokens, 0) });
      const frame = (now: number) => {
        const elapsed = now - t0;
        const done = elapsed >= total;
        if (done || now - last >= FRAME_MS) {
          last = now;
          set({ playing: !done, positions: positionsAt(steps, board.tokens, elapsed) });
        }
        raf = done ? null : requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      return true;
    },
    reset() {
      cancel();
      if (snap.playing || snap.positions) set(IDLE);
    },
    dispose() {
      cancel();
      listeners.clear();
    },
  };
}

export function usePlayback(store: PlaybackStore): PlaybackSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => IDLE);
}

/** 재생 중인 위치를 판에 입힌다(재생 중이 아니면 판 그대로) */
export function applyPositions(board: BoardSnapshot, positions: Positions | null): BoardSnapshot {
  if (!positions) return board;
  return { ...board, tokens: board.tokens.map(t => (positions[t.id] ? { ...t, x: positions[t.id].x, y: positions[t.id].y } : t)) };
}
