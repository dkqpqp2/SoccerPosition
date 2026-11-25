// 홈 "시작하기" 체크리스트: 새 팀장이 팀원 초대 → 첫 경기 → 포지션 배정까지 가도록 이끄는 단계 판정.
// 화면(OnboardingChecklist)과 분리해 두어서 단계 규칙을 따로 검증할 수 있다.

export const DEFAULT_TEAM_NAME = "우리팀"; // 팀 생성 시 기본 이름 (이 이름 그대로면 아직 안 정한 것)

export type OnboardingInput = {
  teamName: string;
  memberCount: number; // 계정이 연결된 팀원 수 (팀장 본인 포함)
  matchCount: number; // 등록된 경기 수
  assignmentCount: number; // 모든 경기의 포지션 배정 수 합계
};

export type OnboardingStep = {
  key: "name" | "invite" | "match" | "assign";
  label: string;
  done: boolean;
};

export function getOnboardingSteps(input: OnboardingInput): { steps: OnboardingStep[]; doneCount: number; allDone: boolean } {
  const steps: OnboardingStep[] = [
    { key: "name", label: "팀 이름 정하기", done: input.teamName !== DEFAULT_TEAM_NAME },
    { key: "invite", label: "팀원 초대하기", done: input.memberCount >= 2 },
    { key: "match", label: "첫 경기 등록하기", done: input.matchCount >= 1 },
    { key: "assign", label: "포지션 배정해보기", done: input.assignmentCount >= 1 },
  ];
  const doneCount = steps.filter(s => s.done).length;
  return { steps, doneCount, allDone: doneCount === steps.length };
}

/** 카톡 등으로 보낼 초대 공유 내용 */
export function buildInviteShare(teamName: string, link: string): { title: string; text: string; url: string } {
  return {
    title: `${teamName} 팀 초대`,
    text: `${teamName} 팀에 같이해요! 링크로 들어와서 카카오 로그인하면 바로 합류돼요.`,
    url: link,
  };
}
