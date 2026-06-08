# Soccer Position Management — CLAUDE.md

## 프로젝트 개요
풋살 팀 관리 웹앱. 팀원 관리·포지션 배정·경기 관리·회비·통계·투표 기능 포함.
**운영 도메인**: https://www.soccerpositionmanagement.com

---

## 기술 스택

- **Framework**: Next.js 14 App Router (`"use client"` / `"use server"`)
- **DB**: Supabase (PostgreSQL) — `supabaseAdmin` (서비스 롤, RLS 우회), `supabaseClient` (anon)
- **Auth**: NextAuth.js + 카카오 OAuth
- **Styling**: Tailwind CSS (다크 테마, gray-950 베이스)
- **Deploy**: Vercel (GitHub main 브랜치 자동 배포)

---

## 핵심 규칙

### DB 접근
- API Route에서는 반드시 `supabaseAdmin` 사용 (RLS 우회)
- 클라이언트에서 직접 DB 접근 금지
- 모든 쿼리에 `.eq("team_id", teamId)` 필터 필수

### API 패턴 (모든 Route Handler 동일)
```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const { teamId } = await getUserAndTeam(session.user.id);
if (!teamId) return NextResponse.json([]);
```

### 권한 체계
- `owner` / `manager` / `coach` / `president` → 관리자급 (canManage)
- `member` / `treasurer` → 일반 팀원
- 포메이션·포지션 배정 메뉴는 관리자급에게만 표시 (`managerOnly: true`)
- 팀 매칭 메뉴는 owner에게만 표시 (`adminOnly: true`)

### 날짜 처리 주의
```typescript
// ❌ UTC 파싱 오류 (KST에서 D-1 버그 발생)
new Date("2026-06-07")

// ✅ 로컬 시간으로 명시적 파싱
const [y, m, d] = dateStr.split("-").map(Number);
new Date(y, m - 1, d);
```

---

## 주요 DB 테이블

| 테이블 | 용도 |
|---|---|
| `teams` | 팀 정보 |
| `team_members` | 팀원·역할(role) |
| `matches` | 경기 정보 (`score_us`, `score_them` 컬럼 있음) |
| `match_stats` | 경기별 골/어시스트 기록 (경기관리에서 입력) |
| `player_stats` | 추가 골/어시스트 (경기관리 외 수동 입력분) |
| `position_assignments` | 포지션 배정 세션 |
| `dues` | 회비 납부 현황 |
| `dues_transactions` | 수입·지출 내역 |
| `votes` / `vote_options` / `vote_responses` | 투표 |
| `feedbacks` | 경기 피드백 |

---

## 팀 통계 집계 방식
- **자동 골/어시**: `match_stats` 테이블에서 집계 (경기관리 기록 기준)
- **추가 골/어시**: `player_stats` 테이블 (등록 안 된 경기 수동 입력)
- **최종값**: `auto + extra` 합산해서 `/api/stats`에서 반환

---

## 환경변수 (Vercel에 설정됨)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXTAUTH_URL=https://www.soccerpositionmanagement.com
NEXTAUTH_SECRET
KAKAO_CLIENT_ID          # REST API 키와 동일값
KAKAO_CLIENT_SECRET
KAKAO_REST_API_KEY       # 카카오 장소검색·지도 API용
NEXT_PUBLIC_KAKAO_JS_KEY # 카카오 JS SDK용
ADMIN_SECRET
```

---

## 컴포넌트 구조

```
src/
├── app/                  # 페이지 (App Router)
│   ├── dashboard/        # 홈 대시보드
│   ├── members/          # 팀원 관리
│   ├── matches/          # 경기 관리
│   ├── assign/           # 포지션 배정
│   ├── dues/             # 회비 관리
│   ├── stats/            # 팀 통계
│   ├── votes/            # 투표
│   ├── feedback/         # 경기 피드백
│   └── api/              # API Routes
├── components/
│   ├── AppLayout.tsx     # 공통 레이아웃 (사이드바·하단탭·도움말모달)
│   ├── KakaoPlaceSearch.tsx  # 카카오 장소 검색
│   └── KakaoMapModal.tsx     # 카카오 지도 모달
└── lib/
    ├── supabase.ts       # supabaseAdmin / supabaseClient
    ├── auth.ts           # NextAuth 설정
    └── team.ts           # getUserAndTeam() 헬퍼
```

---

## AppLayout 사용법

```typescript
// helpContent: 페이지별 ? 도움말 버튼 내용
<AppLayout title="페이지 제목" helpContent={{ items: [
  { icon: "📅", title: "기능명", desc: "설명" },
]}}>
```

---

## 자주 쓰는 명령어

```bash
npx tsc --noEmit          # 타입 오류 체크
npm run dev               # 개발 서버 (localhost:3000)
git add . && git commit   # 커밋 (자동 Vercel 배포)
git push origin main      # Vercel 자동 배포 트리거
```

---

## 주의사항

- `spm-release-key.jks` — Android 서명 키, git에 올리지 말 것
- Supabase RLS는 서버(API Route)에서 항상 `supabaseAdmin`으로 우회
- 카카오 장소 검색은 반드시 서버사이드(`/api/kakao/places`)로 프록시 — 클라이언트 직접 호출 금지
- 팀 전환 시 사이드바 업데이트: `window.dispatchEvent(new Event("teamSwitch"))` 발행
