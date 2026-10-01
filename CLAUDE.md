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

## API 작성/수정 시 체크리스트 (실제 발견된 버그 기반)

2026-10월에 "내전" 기능과 전체 API 보안 점검에서 발견한 버그 패턴들. 새 API를 만들거나 기존 API를 고칠 때마다 아래 항목을 확인할 것.

1. **부모만 검증하고 자식 id는 안 믿었는지 확인**
   `scrimmage_id`/`match_id`/`dues_id` 같은 부모 리소스가 `teamId` 소속인지 확인했다고 해서 끝난 게 아님 — 요청 바디에 같이 들어오는 `member_id`/`user_id`/`squad_id`/`option_id` 같은 자식 id도 반드시 그 팀(또는 그 부모 리소스) 소속인지 **따로** 검증해야 함. 둘 다 안 하면 다른 팀 id를 섞어 넣어 데이터를 오염시키거나(쓰기), 다른 팀 멤버 이름이 노출되는(읽기) 사고가 남.

2. **`team_members`/`users`를 `.in("id", [...])`로 조회할 때 `.eq("team_id", teamId)`를 빼먹지 않았는지 확인**
   리더보드·알림·피드백처럼 id 목록으로 이름을 역조회하는 코드에서 team_id 필터를 빼먹으면, 1번 문제로 섞여 들어간 다른 팀 id의 실명이 그대로 조회돼서 노출됨.

3. **`session.user.id`를 내부 DB id로 바로 쓰지 말 것**
   `session.user.id`는 카카오 로그인 식별자(`token.sub`)이지 `users.id`가 아님. 반드시 `getUserId()`/`getUserAndTeam()`으로 변환한 내부 id를 써야 함 (`/api/user/delete`가 이걸 안 지켜서 탈퇴 버튼이 아무것도 안 지우는 버그가 있었음).

4. **status 같은 enum 값에 따라 분기하는 권한 체크는 "인식 못 하는 값"을 먼저 막을 것**
   `if (status === "A") {...} if (status === "B") {...}` 식으로 특정 값에만 권한 체크를 걸면, 그 외의 임의 문자열은 모든 체크를 통과해서 바로 실행돼버림. 먼저 허용된 값 목록(allow-list)인지 확인하고, 아니면 즉시 400으로 막은 뒤 분기할 것.

5. **`team_members` 조회 시 나간 팀원(`left_at`) 필터를 빼먹지 않았는지 확인**
   `/api/members`에는 `.is("left_at", null)`이 있는데 새로 만든 집계용 API(`player-stats` 등)에 이걸 빼먹어서, 나간 팀원이 계속 노출된 적 있음. 팀원 목록을 다루는 쿼리를 새로 짤 때마다 기존 `/api/members`와 필터가 일치하는지 비교할 것.

6. **공개(비로그인) `/api/share/*` 류 라우트는 `select("*")` 금지**
   공유 링크는 세션 체크가 없는 게 의도된 설계지만, 그렇다고 테이블 전체 컬럼을 다 내려주면 안 됨 — 그 페이지가 실제로 쓰는 컬럼만 명시적으로 select할 것.

> 전체 API 보안 리뷰는 `/code-review` 스킬로 `src/app/api/**`를 대상으로 돌리면 재사용 가능.

---

## 배포 워크플로우

- `main`에 바로 커밋하지 말 것. 기능/수정마다 브랜치를 새로 만들고, 로컬에서 `npx tsc --noEmit` + `npm run build` 통과 확인 후, **사용자가 명시적으로 "배포해줘"라고 할 때만** `main`에 merge하고 push할 것.
- Android 네이티브 변경(아이콘, 앱 이름 등)은 웹 배포와 별개로 `android/app/build.gradle`의 `versionCode`/`versionName`을 올리고 `npx cap sync android` → `cd android && ./gradlew bundleRelease`로 새 `.aab`를 만들어 Play Console에 직접 업로드해야 함 — git push만으로는 반영되지 않음.

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
