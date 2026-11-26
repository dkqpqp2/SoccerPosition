# 선수별 AI 코칭 가이드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자급이 선수별 AI 코칭 가이드를 만들고, 전용 탭에 저장해 두고 다시 보며, 전달 여부를 표시한다.

**Architecture:** 순수 로직(`src/lib/coaching.ts`: 입력 지문·프롬프트·결과 검증)과 호출 제한(`src/lib/aiQuota.ts`)을 분리하고, API 두 개(목록 GET, 선수별 POST/PUT)와 탭 컴포넌트(`CoachingTab`)를 팀원 관리 페이지에 연결한다. 저장은 새 테이블(SQL은 사용자가 실행).

**Tech Stack:** Next.js route handlers, Supabase(`supabaseAdmin`), `@anthropic-ai/sdk`, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-26-coaching-guides-design.md`

## Global Constraints

- 모든 쿼리에 `.eq("team_id", teamId)`, 팀원 조회는 `.eq("is_mercenary", false).is("left_at", null)`.
- 권한 `canManage`만. 요청의 member id는 같은 팀 소속인지 따로 검증.
- AI에는 희망 포지션·장점·단점만(이름·메모 금지). 새 테이블은 RLS 켜고 정책 없음.
- `session.user.id`를 내부 id로 쓰지 말고 `getUserAndTeam`으로 변환.

## Review Focus

- 다른 팀 member id로 생성/전달 표시 요청 → 404.
- 일반 팀원이 목록·생성 호출 → 403.
- AI가 형식에 맞지 않는 JSON을 주면 저장하지 않고 호출 제한 복구, 500 대신 안내 에러.
- 장점·단점이 모두 비어 있으면 AI를 부르지 않는다(400, 호출 제한 차감 없음).
- 같은 입력이면 지문이 같고, 포지션·장점·단점 중 하나만 바뀌어도 달라진다.

---

### Task 1: 순수 로직

**Files:** Create `src/lib/coaching.ts`

**Interfaces — Produces:**
- `type CoachingInput = { position1st: string | null; position2nd: string | null; strengths: string; weaknesses: string }`
- `type CoachingContent = { play: string; avoid: string; drills: string[]; talk: string }`
- `coachingBasisHash(input: CoachingInput): string` (sha1 hex, 공백 정리)
- `buildCoachingPrompt(input: CoachingInput): string`
- `parseCoachingContent(raw: unknown): CoachingContent | null` (play·avoid·talk 문자열 필수, drills 1~4개 문자열, 길이 제한)

- [ ] 구현 후 시나리오 스크립트로 검증(지문 동일/변경, 파서 정상/비정상).

### Task 2: 호출 제한 모듈

**Files:** Create `src/lib/aiQuota.ts`

**Produces:** `reserveAiUsage(teamId: string): Promise<"ok" | "limit" | "error">`, `releaseAiUsage(teamId: string): Promise<void>` — `increment_ai_usage`/`decrement_ai_usage` RPC, KST 날짜, 우리 팀 무제한.

### Task 3: DB SQL

**Files:** Create `docs/db/member_coaching_guides.sql` (사용자가 Supabase에서 실행).

### Task 4: API

**Files:** Create `src/app/api/members/coaching/route.ts` (GET), `src/app/api/members/[id]/coaching/route.ts` (POST 생성, PUT 전달 표시)

- [ ] GET: 정규 활동 팀원 + 평가 + 저장된 가이드 → `{id,name,position_1st,position_2nd,has_input,guide:{content,delivered_at,updated_at}|null,stale}[]`
- [ ] POST: 검증 → 입력 없음 400 → 호출 제한 → Anthropic → 파싱 실패 시 복구·502 → upsert(delivered_at null) → 가이드 반환
- [ ] PUT `{delivered:boolean}`: 가이드 있을 때만 `delivered_at` 갱신

### Task 5: 화면

**Files:** Create `src/components/members/CoachingTab.tsx`; Modify `src/app/members/page.tsx`(탭 추가·관리자급만)

- [ ] 목록(상태 배지), 상세 펼침(가이드 4칸, 다시 만들기, 복사, 전달 완료 토글), `useAiConsent`, 로딩·오류 표시.
- [ ] 검증: `tsc`, 가짜 응답으로 화면(없음/있음/전달 완료/바뀜/입력 없음), 비관리자에게 탭 없음, `npm run build`.
