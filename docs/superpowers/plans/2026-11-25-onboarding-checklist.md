# 홈 "시작하기" 체크리스트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새 팀장이 홈에서 팀원 초대 → 첫 경기 등록 → 포지션 배정까지 가도록 이끄는 체크리스트 카드를 만든다.

**Architecture:** 단계 판정과 공유 문구는 순수 함수(`src/lib/onboarding.ts`)로 분리해 시나리오로 검증하고, 카드 컴포넌트(`src/components/OnboardingChecklist.tsx`)가 대시보드가 이미 가진 데이터(팀원 목록, `/api/matches` 응답의 경기·배정)로 렌더한다. DB·API 변경 없음.

**Tech Stack:** Next.js App Router(client component), Tailwind, lucide-react, `navigator.share`.

**Spec:** `docs/superpowers/specs/2026-11-25-onboarding-checklist-design.md`

## Global Constraints

- 팀장(`team.is_owner`)에게만 보인다.
- 4단계: 팀 이름 정하기(이름 ≠ "우리팀") / 팀원 초대(팀원 ≥ 2명) / 경기 등록(경기 ≥ 1건) / 포지션 배정(배정 ≥ 1건).
- 4단계 모두 완료하거나 "닫기"를 누르면 사라진다. 닫은 기록은 팀별로 localStorage에만 저장(`spm_onboarding_dismissed_<teamId>`).
- 공유는 `navigator.share`, 안 되면 링크 복사. 초대 링크 형식: `${origin}/join?code=${invite_code}`.
- 기존 "우리팀" 배너는 제거(1단계로 흡수). DB 변경·알림·샘플 데이터 없음.
- 한국어 문구, 기존 홈 카드 스타일(`bg-gray-900 rounded-lg border border-white/5`) 유지.

## Review Focus

- 경기·배정 데이터가 아직 로드되지 않은 순간에 카드가 "미완료"로 깜빡이면 안 됨 → 로드 전에는 카드를 숨긴다.
- 팀 전환 직후 이전 팀의 개수가 남아 있으면 안 됨 → `switchTeam`에서 개수를 초기화한다.
- localStorage 접근 실패(사생활 보호 모드)에도 카드는 정상 표시 → try/catch.
- 공유 창을 사용자가 취소(`AbortError`)해도 에러·복사 대체가 뜨면 안 됨.
- 이미 4단계를 다 마친 기존 팀에게 카드가 보이면 안 됨.

---

### Task 1: 단계 판정·공유 문구 (순수 함수)

**Files:**
- Create: `src/lib/onboarding.ts`

**Interfaces:**
- Produces:
  - `type OnboardingInput = { teamName: string; memberCount: number; matchCount: number; assignmentCount: number }`
  - `type OnboardingStep = { key: "name" | "invite" | "match" | "assign"; label: string; done: boolean }`
  - `getOnboardingSteps(input: OnboardingInput): { steps: OnboardingStep[]; doneCount: number; allDone: boolean }`
  - `buildInviteShare(teamName: string, link: string): { title: string; text: string; url: string }`

- [ ] **Step 1:** 위 시그니처대로 구현한다. 라벨은 "팀 이름 정하기", "팀원 초대하기", "첫 경기 등록하기", "포지션 배정해보기". 공유 `text`는 `${teamName} 팀에 같이해요! 링크로 들어와서 카카오 로그인하면 바로 합류돼요.`
- [ ] **Step 2: 시나리오 검증** — 임시 스크립트로 다음을 확인: ("우리팀",1,0,0)→doneCount 0; ("FC",1,0,0)→name만 done; ("FC",2,1,1)→allDone true; 팀원 1명일 때 invite 미완료; 이름 앞뒤 공백("우리팀 ")도 기본 이름으로 취급하지 않으므로 완료(정확히 "우리팀"만 미완료).
  Run: `npx tsx <임시스크립트>` Expected: 모든 assert 통과.
- [ ] **Step 3: Commit**

### Task 2: 체크리스트 카드 컴포넌트

**Files:**
- Create: `src/components/OnboardingChecklist.tsx`

**Interfaces:**
- Consumes: Task 1의 `getOnboardingSteps`, `buildInviteShare`.
- Produces: `default function OnboardingChecklist(props: { teamId: string; teamName: string; inviteCode: string; memberCount: number; matchCount: number; assignmentCount: number; onGoMatches: () => void; onGoAssign: () => void; onGoMyPage: () => void }): JSX.Element | null`

- [ ] **Step 1:** 카드 구현. 완료 개수 표시("(2/4)"), 단계별 ✅/⬜, 미완료 단계 옆 버튼(이름→`onGoMyPage` "설정하기", 초대→"카톡으로 보내기", 경기→`onGoMatches` "등록하러 가기", 배정→`onGoAssign` "배정하러 가기"). `allDone`이거나 닫힘이면 `null`.
- [ ] **Step 2:** 공유 버튼: `navigator.share`가 있으면 호출하고 `AbortError`는 무시, 그 외 실패나 미지원이면 `navigator.clipboard.writeText(url)` 후 "링크를 복사했어요" 표시(2초).
- [ ] **Step 3:** 닫기: `localStorage` 읽기/쓰기는 try/catch. 읽기 실패 시 닫히지 않은 것으로 간주.
- [ ] **Step 4: Commit**

### Task 3: 홈에 연결

**Files:**
- Modify: `src/app/dashboard/page.tsx` — "우리팀" 배너 블록(약 499–517행) 교체, `fetchMatchData`·`switchTeam`·상태 추가.

**Interfaces:**
- Consumes: Task 2의 `OnboardingChecklist`.

- [ ] **Step 1:** 상태 `matchStats: { matchCount: number; assignmentCount: number } | null` 추가. `fetchMatchData`에서 `/api/matches` 응답으로 `matchCount = matches.length`, `assignmentCount = 모든 경기의 position_assignments 길이 합`을 계산해 저장(경기 0건이면 0,0 — 기존 early return 앞에서 저장). `switchTeam`에서 `null`로 초기화.
- [ ] **Step 2:** 배너를 `team?.is_owner && matchStats && <OnboardingChecklist …/>`로 교체(로드 전엔 숨김). `onGoMatches`→`/matches`, `onGoAssign`→`/assign`, `onGoMyPage`→`/mypage`.
- [ ] **Step 3: 검증** — `npx tsc --noEmit` 통과. 개발 서버에서 모킹한 응답으로 확인: (a) 새 팀(이름 "우리팀", 팀원 1, 경기 0) 카드 표시·0/4, (b) 모두 완료 팀 카드 없음, (c) 비팀장 카드 없음, (d) 닫기 후 새로고침해도 숨김, (e) 공유 버튼 동작(미지원 환경은 복사 대체).
- [ ] **Step 4: Commit** (사용자가 "커밋해줘"라고 할 때)
