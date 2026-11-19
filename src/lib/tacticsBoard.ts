// 전술판의 데이터 모양과 그리기 도우미 — 전술판 페이지(/tactics/[id])와 팀 라운지의 전술 설명 화면이 함께 쓴다.
// 서버/브라우저 어디서든 쓸 수 있게 순수 함수만 둔다(React·DB 의존 없음).

export type LineMode = "curve" | "straight";
export type LineType = "move" | "pass";

export const LINE_COLORS: Record<LineType, string> = { move: "#f87171", pass: "#60a5fa" };
export const LINE_LABELS: Record<LineType, string> = { move: "움직임", pass: "패스" };

export interface Arrow {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  mode: LineMode;
  type: LineType;
}

export interface Token {
  id: string;
  x: number;
  y: number;
  team: "us" | "opp" | "ball";
  label?: string;
  pos?: string; // 포지션 코드(GK/CB/CM/ST 등) — label이 선수 이름으로 바뀌어도 색상 구분용으로 유지
  posManual?: boolean; // 사용자가 직접 고른 포지션이면 true — 드래그해도 구역에 따라 자동으로 안 바뀜
}

// assign 페이지와 동일한 포지션별 색상 규칙 (GK 주황 / 수비 파랑 / 공격 빨강 / 미드필드 초록)
export function positionColor(pos?: string) {
  const p = (pos ?? "").toUpperCase();
  if (p === "GK") return { bg: "#f59e0b", border: "#fbbf24", color: "#111827" };
  if (/^(CB|LB|RB|LWB|RWB|SW|DC|DL|DR|WB|FB)/.test(p)) return { bg: "#3b82f6", border: "#60a5fa", color: "#ffffff" };
  if (/^(ST|CF|SS|LW|RW|LF|RF|FW|ATT|WG|CW)/.test(p)) return { bg: "#ef4444", border: "#f87171", color: "#ffffff" };
  return { bg: "#10b981", border: "#34d399", color: "#111827" };
}

export function controlPoint(a: { x1: number; y1: number; x2: number; y2: number }) {
  const mx = (a.x1 + a.x2) / 2;
  const my = (a.y1 + a.y2) / 2;
  const dx = a.x2 - a.x1;
  const dy = a.y2 - a.y1;
  const len = Math.hypot(dx, dy) || 1;
  const offset = len * 0.2;
  return { cx: mx + (-dy / len) * offset, cy: my + (dx / len) * offset };
}

export function arrowPath(a: { x1: number; y1: number; x2: number; y2: number; mode: LineMode }) {
  if (a.mode === "straight") return `M ${a.x1} ${a.y1} L ${a.x2} ${a.y2}`;
  const { cx, cy } = controlPoint(a);
  return `M ${a.x1} ${a.y1} Q ${cx} ${cy} ${a.x2} ${a.y2}`;
}

// 화살표 번호 라벨을 놓을 위치 — 직선은 중점, 곡선은 베지어 곡선의 실제 중점(t=0.5)
export function arrowLabelPos(a: { x1: number; y1: number; x2: number; y2: number; mode: LineMode }) {
  if (a.mode === "straight") return { x: (a.x1 + a.x2) / 2, y: (a.y1 + a.y2) / 2 };
  const { cx, cy } = controlPoint(a);
  return { x: 0.25 * a.x1 + 0.5 * cx + 0.25 * a.x2, y: 0.25 * a.y1 + 0.5 * cy + 0.25 * a.y2 };
}

// ── 라운지에서 설명하는 사람이 방 전체에 보여 주는 "지금 이 전술판" ──

/** 한 판에 올릴 수 있는 최대 개수 — 접속 상태에 실어 보내는 크기를 제한하고, 받는 쪽도 이 수를 넘는 값은 버린다 */
export const MAX_TOKENS = 40;
export const MAX_ARROWS = 40;
const MAX_TITLE = 24;

/** 방 전체에 보여 주는 전술판 (선수 말·화살표). DB에 저장하지 않는다. */
export type BoardSnapshot = { title: string; tokens: Token[]; arrows: Arrow[] };

const clampNum = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null;

/**
 * 밖에서 온 값(다른 접속자가 보낸 것, 저장된 전술판)을 믿지 않고 정리한다.
 * 숫자는 0~100으로 맞추고, 정해진 값(팀·선 종류)이 아니면 그 항목을 버리고, 개수·글자 수를 제한한다.
 * 객체가 아니면 null.
 */
export function sanitizeBoard(raw: unknown): BoardSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const tokens: Token[] = [];
  const tokenIds = new Set<string>();
  if (Array.isArray(r.tokens)) {
    for (const t of r.tokens.slice(0, MAX_TOKENS)) {
      if (!t || typeof t !== "object") continue;
      const o = t as Record<string, unknown>;
      const x = clampNum(o.x, 0, 100);
      const y = clampNum(o.y, 0, 100);
      const team = o.team === "us" || o.team === "opp" || o.team === "ball" ? o.team : null;
      if (typeof o.id !== "string" || !o.id || x === null || y === null || team === null) continue;
      const id = o.id.slice(0, 24);
      if (tokenIds.has(id)) continue;
      tokenIds.add(id);
      tokens.push({
        id,
        x,
        y,
        team,
        ...(typeof o.label === "string" ? { label: o.label.slice(0, 6) } : {}),
        ...(typeof o.pos === "string" ? { pos: o.pos.slice(0, 6) } : {}),
      });
    }
  }

  const arrows: Arrow[] = [];
  const arrowIds = new Set<string>();
  if (Array.isArray(r.arrows)) {
    for (const a of r.arrows.slice(0, MAX_ARROWS)) {
      if (!a || typeof a !== "object") continue;
      const o = a as Record<string, unknown>;
      const x1 = clampNum(o.x1, 0, 100);
      const y1 = clampNum(o.y1, 0, 100);
      const x2 = clampNum(o.x2, 0, 100);
      const y2 = clampNum(o.y2, 0, 100);
      const type = o.type === "move" || o.type === "pass" ? o.type : null;
      if (typeof o.id !== "string" || !o.id || x1 === null || y1 === null || x2 === null || y2 === null || type === null) continue;
      const id = o.id.slice(0, 24);
      if (arrowIds.has(id)) continue;
      arrowIds.add(id);
      arrows.push({ id, x1, y1, x2, y2, type, mode: o.mode === "straight" ? "straight" : "curve" });
    }
  }

  return { title: typeof r.title === "string" ? r.title.slice(0, MAX_TITLE) : "", tokens, arrows };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 보내기 전에 좌표를 소수 첫째 자리로 줄이고 필요한 항목만 남긴다(접속 상태에 실리는 크기를 줄이는 용도) */
export function compactBoard(b: BoardSnapshot): BoardSnapshot {
  return {
    title: b.title,
    tokens: b.tokens.map(t => ({
      id: t.id,
      x: round1(t.x),
      y: round1(t.y),
      team: t.team,
      ...(t.label !== undefined ? { label: t.label } : {}),
      ...(t.pos !== undefined ? { pos: t.pos } : {}),
    })),
    arrows: b.arrows.map(a => ({ id: a.id, x1: round1(a.x1), y1: round1(a.y1), x2: round1(a.x2), y2: round1(a.y2), mode: a.mode, type: a.type })),
  };
}
