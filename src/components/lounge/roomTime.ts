/** 남은 시간을 사람이 읽는 말로: "23시간 41분", "5시간", "9분", "곧 종료" */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "곧 종료";
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `${totalMin}분`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/**
 * 서버 시각과 내 시계의 차이(ms). 서버가 알려 준 "지금"을 받은 순간에 계산해 두면,
 * 내 시계가 틀려도 남은 시간을 정확히 계산할 수 있다: 서버기준 지금 = Date.now() + offset
 */
export function clockOffset(serverNowIso: string, localNowMs = Date.now()): number {
  const server = Date.parse(serverNowIso);
  return Number.isFinite(server) ? server - localNowMs : 0;
}

/** 만료까지 남은 ms (서버 시각 기준) */
export function msUntilExpiry(expiresAtIso: string, offsetMs: number, localNowMs = Date.now()): number {
  return Date.parse(expiresAtIso) - (localNowMs + offsetMs);
}
