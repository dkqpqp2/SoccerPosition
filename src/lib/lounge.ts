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

/**
 * 팀원 장단점(평가)을 팀원 모두에게 공개하는 팀.
 * 장단점은 원래 관리자급만 보던 내용이라, 다른 팀의 기존 비공개 평가가 갑자기 노출되지 않도록 지금은 라운지 사용 팀에만 연다.
 * 나중에 팀별 설정으로 바꿀 때는 이 함수 한 곳만 고치면 된다. (메모는 공개 대상이 아니다 — 관리자급만 본다)
 */
export function areEvaluationsPublic(teamId: string | null | undefined): boolean {
  return isLoungeEnabled(teamId);
}
