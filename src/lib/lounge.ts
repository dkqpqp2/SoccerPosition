/**
 * 팀 라운지(3D 락커룸) 사용 허용 팀 목록.
 * 환경변수 LOUNGE_TEAM_IDS에 teams.id를 쉼표로 적는다. 비어 있으면 어느 팀도 쓸 수 없다.
 * 나중에 구독/다른 팀 공개로 바꿀 때는 이 파일의 isLoungeEnabled 한 곳만 고치면 된다 — 라운지 API·페이지는 전부 이 함수로 판단할 것.
 */
export function loungeTeamIds(): string[] {
  return (process.env.LOUNGE_TEAM_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
}

export function isLoungeEnabled(teamId: string | null | undefined): boolean {
  return !!teamId && loungeTeamIds().includes(teamId);
}
