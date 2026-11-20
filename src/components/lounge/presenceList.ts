/**
 * 접속자 목록에서 "화면을 다시 그려야 하는 값"만 비교하는 도우미.
 * 접속 동기화는 15초마다 오는 "살아 있어요" 신호(beat)나 채팅 번호(sayId)처럼 화면 모양을 바꾸지 않는 변화에도 새 목록을 만든다.
 * 그걸 그대로 React에 넘기면 변한 게 없는 캐릭터까지 전부 다시 계산하므로, 모양이 같으면 이전 객체를 재사용한다.
 */
export type RenderFields = {
  key: string;
  name: string;
  color: string;
  x: number;
  z: number;
  tx: number | null;
  tz: number | null;
  seq: number;
  seat: number | null; // 앉은(앉으러 가는) 벤치 자리 번호, 없으면 null
};

/** 화면에 보이는 모양(이름·색·이동·앉은 자리)이 같은지 */
export function sameRender(a: RenderFields, b: RenderFields): boolean {
  return a.name === b.name && a.color === b.color && a.x === b.x && a.z === b.z && a.tx === b.tx && a.tz === b.tz && a.seq === b.seq && a.seat === b.seat;
}

export type Say = { id: number; text: string };

/**
 * 한 사람의 접속 상태에서 "내가 아직 못 본 새 메시지"를 골라낸다.
 * 접속 상태에는 그 사람의 최근 메시지 몇 개(says)가 실려 있어서, 전송이 합쳐지거나 한두 번 놓쳐도 빠진 것을 채울 수 있다.
 * - lastSeen: 이 사람에 대해 내가 이미 본 마지막 번호(처음 보는 사람이면 undefined)
 * - baseline: 내가 막 접속해서 받은 첫 동기화인지. 그때 이미 있던 사람의 메시지는 "예전 것"이라 보여주지 않고 번호만 기억한다.
 *   그 뒤에 처음 보이는 사람은 새로 접속한 사람이라 번호가 0부터 시작하므로, 메시지가 있으면 방금 보낸 것이다.
 * 돌려주는 값: emit(보여줄 메시지, 번호순), nextSeen(이제 기억할 마지막 번호)
 */
export function collectNewSays(lastSeen: number | undefined, baseline: boolean, sayId: number, says: Say[]): { emit: Say[]; nextSeen: number } {
  if (lastSeen === undefined && baseline) return { emit: [], nextSeen: sayId };
  const from = lastSeen ?? 0;
  const emit = says.filter(s => s.id > from).sort((a, b) => a.id - b.id);
  return { emit, nextSeen: Math.max(from, sayId, ...emit.map(s => s.id)) };
}

/**
 * 같은 자리를 거의 동시에 고른 경우 누가 양보할지 정한다.
 * 내 자리(mySeat)에 이미 다른 사람이 앉으려 하고 있고 그 사람의 접속 키가 나보다 작으면, 그 사람이 자리를 갖고 나는 양보한다.
 * 두 사람이 같은 규칙으로 판단하므로 따로 메시지를 주고받지 않아도 한 명만 양보한다. 양보할 상대가 없으면 null.
 */
export function seatRival<T extends { key: string; seat: number | null }>(others: T[], mySeat: number | null, myKey: string): T | null {
  if (mySeat === null || !myKey) return null;
  return others.find(o => o.seat === mySeat && o.key < myKey) ?? null;
}

/**
 * 새 목록(next)을 이전 목록(prev)과 합친다.
 * - 모양이 같은 사람은 이전 객체를 그대로 쓴다.
 * - 아무것도 안 바뀌었으면 prev 자체를 돌려준다 → 호출한 쪽이 `===`로 확인하고 setState를 건너뛸 수 있다.
 */
export function mergeOthers<T extends RenderFields>(prev: T[], next: T[]): T[] {
  const prevByKey = new Map(prev.map(p => [p.key, p]));
  let changed = prev.length !== next.length;
  const merged = next.map((n, i) => {
    const old = prevByKey.get(n.key);
    if (old && sameRender(old, n)) {
      if (prev[i] !== old) changed = true; // 순서가 바뀐 경우
      return old;
    }
    changed = true;
    return n;
  });
  return changed ? merged : prev;
}
