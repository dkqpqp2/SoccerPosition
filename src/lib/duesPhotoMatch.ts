// 입금 내역 사진에서 읽어 낸 입금 기록을 팀원·설정 금액과 맞춰 보는 순수 함수.
// 서버(AI)는 사진에서 글자만 뽑고, 누가 냈는지 판단은 전부 여기서 코드로 한다
// (팀원 이름을 AI로 보내지 않고, 사진 속 글자가 판단을 바꾸지 못하게 하기 위해).

export interface Deposit {
  name: string;
  amount: number;
  kind: "in" | "out" | "unknown";
  month: number | null; // 1~12, 사진에서 못 읽으면 null
  day: number | null;
  image: number; // 몇 번째 사진인지 (1부터)
}

export interface MatchMember {
  member_id: string;
  name: string;
  effective_amount: number;
  paid: boolean;
}

export type NameMatch = "exact" | "similar";
export type AmountResult = "ok" | "over" | "short" | "no_expected";

export interface MemberMatch {
  member_id: string;
  name: string;
  nameMatch: NameMatch;
  deposits: Deposit[];
  total: number;
  expected: number;
  amountResult: AmountResult;
  alreadyPaid: boolean;
  /** 화면에서 처음부터 체크해 둘지 — 이름이 정확히 같고 금액이 설정 금액 이상일 때만 */
  suggestChecked: boolean;
}

export interface MatchResult {
  matches: MemberMatch[];
  /** 어느 팀원인지 못 정한 입금 (이름이 안 맞거나, 같은 이름이 여러 명) */
  unmatched: Deposit[];
  /** 선택한 달이 아닌 달의 입금 */
  otherMonth: Deposit[];
  /** 입금이 아니라서(출금·불확실) 건너뛴 줄 수 */
  skipped: number;
  /** 활성 팀원 중 이번 달 입금이 안 보이고 아직 납부 처리도 안 된 사람 */
  noDeposit: MatchMember[];
}

/** 비교용 이름: 공백·괄호 속 글자·"님" 제거 */
export function normalizeName(raw: string): string {
  return raw
    .replace(/\([^)]*\)|\[[^\]]*\]|（[^）]*）/g, "")
    .replace(/\s+/g, "")
    .replace(/님$/, "")
    .toLowerCase();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 같은 거래가 겹치는 사진에 두 번 찍혔을 수 있어서, 같은 줄은 사진 한 장 안에서 센 개수의 최대값만 인정한다 */
export function dedupeAcrossImages(deposits: Deposit[]): Deposit[] {
  const key = (d: Deposit) => `${normalizeName(d.name)}|${d.amount}|${d.month ?? ""}|${d.day ?? ""}`;
  const perImage = new Map<string, Map<number, Deposit[]>>();
  for (const d of deposits) {
    const k = key(d);
    const byImg = perImage.get(k) ?? new Map<number, Deposit[]>();
    const list = byImg.get(d.image) ?? [];
    list.push(d);
    byImg.set(d.image, list);
    perImage.set(k, byImg);
  }
  const out: Deposit[] = [];
  for (const byImg of perImage.values()) {
    let best: Deposit[] = [];
    for (const list of byImg.values()) if (list.length > best.length) best = list;
    out.push(...best);
  }
  return out;
}

export function matchDeposits(rawDeposits: Deposit[], members: MatchMember[], month: number): MatchResult {
  const deposits = dedupeAcrossImages(rawDeposits);
  const incoming = deposits.filter(d => d.kind === "in" && d.amount > 0);
  const skipped = deposits.length - incoming.length;

  const otherMonth = incoming.filter(d => d.month !== null && d.month !== month);
  const thisMonth = incoming.filter(d => d.month === null || d.month === month);

  const normMembers = members.map(m => ({ m, norm: normalizeName(m.name) })).filter(x => x.norm.length > 0);

  const byMember = new Map<string, { nameMatch: NameMatch; deposits: Deposit[] }>();
  const unmatched: Deposit[] = [];

  for (const d of thisMonth) {
    const dn = normalizeName(d.name);
    let target: { m: MatchMember; norm: string } | null = null;
    let nameMatch: NameMatch = "exact";

    if (dn) {
      const exact = normMembers.filter(x => x.norm === dn);
      if (exact.length === 1) {
        target = exact[0];
      } else if (exact.length === 0) {
        // 가려진 이름(김*호)이거나 이름 뒤에 글자가 붙은 경우(김정호11월) — "비슷함"으로만 처리해 사람이 확인하게 한다
        let similar: { m: MatchMember; norm: string }[] = [];
        if (dn.includes("*")) {
          const re = new RegExp(`^${dn.split("*").map(escapeRe).join(".")}$`);
          similar = normMembers.filter(x => re.test(x.norm));
        } else {
          similar = normMembers.filter(x => x.norm.length >= 2 && dn.includes(x.norm));
        }
        if (similar.length === 1) {
          target = similar[0];
          nameMatch = "similar";
        }
      }
    }

    if (!target) {
      unmatched.push(d);
      continue;
    }
    const cur = byMember.get(target.m.member_id) ?? { nameMatch, deposits: [] };
    // 한 사람에게 정확한 이름과 비슷한 이름이 섞이면 더 약한 쪽으로 본다
    if (nameMatch === "similar") cur.nameMatch = "similar";
    cur.deposits.push(d);
    byMember.set(target.m.member_id, cur);
  }

  const matches: MemberMatch[] = [];
  for (const m of members) {
    const hit = byMember.get(m.member_id);
    if (!hit) continue;
    const total = hit.deposits.reduce((s, d) => s + d.amount, 0);
    const expected = m.effective_amount;
    const amountResult: AmountResult = expected <= 0 ? "no_expected" : total === expected ? "ok" : total > expected ? "over" : "short";
    matches.push({
      member_id: m.member_id,
      name: m.name,
      nameMatch: hit.nameMatch,
      deposits: hit.deposits,
      total,
      expected,
      amountResult,
      alreadyPaid: m.paid,
      suggestChecked: !m.paid && hit.nameMatch === "exact" && (amountResult === "ok" || amountResult === "over"),
    });
  }

  const depositedIds = new Set(matches.map(x => x.member_id));
  const noDeposit = members.filter(m => !m.paid && !depositedIds.has(m.member_id));

  return { matches, unmatched, otherMonth, skipped, noDeposit };
}
