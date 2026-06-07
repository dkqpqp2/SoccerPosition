"use client";

import { useState, useEffect } from "react";
import SpmLogo from "@/components/SpmLogo";

const ADMIN_SECRET = "1234";

interface User {
  id: string;
  name: string;
  email: string;
  image: string;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  totalTeams: number;
  totalTeamsAll: number;
  totalMembers: number;
  totalMatches: number;
  users: User[];
  signupByDay: Record<string, number>;
}

function StatCard({
  value,
  label,
  color,
}: {
  value: number | string;
  label: string;
  color: "emerald" | "blue" | "amber" | "purple";
}) {
  const colors = {
    emerald: "text-emerald-400",
    blue:    "text-blue-400",
    amber:   "text-amber-400",
    purple:  "text-purple-400",
  };
  return (
    <div className="bg-gray-800 rounded-2xl p-5 text-center">
      <p className={`text-3xl font-black ${colors[color]}`}>{value}</p>
      <p className="text-gray-400 text-sm mt-1">{label}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Play Store 출시 로드맵
// ────────────────────────────────────────────────────────────
type StepStatus = "done" | "progress" | "wait";

interface RoadmapStep {
  icon: string;
  title: string;
  desc: string;
  status: StepStatus;
  detail?: string;
}

const ROADMAP_STEPS: RoadmapStep[] = [
  {
    icon: "🏦",
    title: "Google Play 개발자 계정 생성",
    desc: "$25 등록비 결제 완료",
    status: "done",
    detail: "개발자명: SportsPositionManagement",
  },
  {
    icon: "🪪",
    title: "Google 신원 인증 (D-ID)",
    desc: "Google이 신원 서류 검토 중 (수일 소요)",
    status: "progress",
    detail: "승인되면 이메일로 알림 옴 · 완료 후 전화번호 인증 가능",
  },
  {
    icon: "📱",
    title: "전화번호 인증",
    desc: "신원 인증 완료 후 진행",
    status: "wait",
    detail: "Play Console 계정 설정 → 연락처 인증",
  },
  {
    icon: "🤖",
    title: "Android Studio 설치",
    desc: "Android 빌드 도구 설치 완료",
    status: "done",
    detail: "버전: Android Studio Quail 1 | 2026.1.1",
  },
  {
    icon: "⚡",
    title: "Capacitor 설정",
    desc: "Next.js → Android 앱 래핑 완료",
    status: "done",
    detail: "appId: com.spm.soccerposition · 라이브 URL 연결 방식",
  },
  {
    icon: "🔨",
    title: "AAB(앱 번들) 빌드",
    desc: "Android Studio에서 Release 빌드 생성",
    status: "wait",
    detail: "Build → Generate Signed Bundle → AAB 선택 → keystore 생성",
  },
  {
    icon: "🔑",
    title: "앱 서명 키(Keystore) 생성",
    desc: "릴리즈 서명용 키 생성 및 안전한 곳에 백업",
    status: "wait",
    detail: "⚠️ keystore 분실 시 앱 업데이트 불가 — 반드시 백업!",
  },
  {
    icon: "📋",
    title: "Play Console 앱 등록",
    desc: "새 앱 만들기 → 앱 이름·카테고리·언어 설정",
    status: "wait",
    detail: "앱 이름: SPM - 팀 포지션 관리 / 카테고리: 스포츠",
  },
  {
    icon: "🖼️",
    title: "스토어 등록 정보 작성",
    desc: "설명·스크린샷·아이콘·피처드 이미지 업로드",
    status: "wait",
    detail: "스크린샷 2장 이상 필수 · 아이콘 512×512px · 피처드 1024×500px",
  },
  {
    icon: "🧪",
    title: "내부 테스트 트랙 출시",
    desc: "본인 계정으로 먼저 테스트",
    status: "wait",
    detail: "내부 테스터 추가 → 링크로 설치 → 기능 확인",
  },
  {
    icon: "📝",
    title: "개인정보처리방침 등록",
    desc: "URL 형태로 제출 필수 (없으면 출시 불가)",
    status: "wait",
    detail: "Vercel에 /privacy 페이지 만들거나 notion 페이지로 대체 가능",
  },
  {
    icon: "🚀",
    title: "프로덕션 출시 신청",
    desc: "Google 심사 → 승인 → Play Store 공개",
    status: "wait",
    detail: "심사 기간: 보통 1~3일 · 첫 출시는 최대 7일 소요",
  },
];

const statusConfig: Record<StepStatus, { badge: string; badgeClass: string; borderClass: string; iconBg: string }> = {
  done:     { badge: "완료",      badgeClass: "bg-emerald-500/20 text-emerald-400",  borderClass: "border-emerald-500/30", iconBg: "bg-emerald-500/15" },
  progress: { badge: "진행 중",   badgeClass: "bg-amber-500/20 text-amber-400",      borderClass: "border-amber-500/40",   iconBg: "bg-amber-500/15"   },
  wait:     { badge: "대기",      badgeClass: "bg-gray-700/60 text-gray-500",        borderClass: "border-white/5",        iconBg: "bg-white/5"        },
};

function PlayStoreRoadmap() {
  const [open, setOpen] = useState(true);
  const done     = ROADMAP_STEPS.filter(s => s.status === "done").length;
  const total    = ROADMAP_STEPS.length;
  const progress = Math.round((done / total) * 100);

  return (
    <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏪</span>
          <div className="text-left">
            <h3 className="font-bold text-white text-base">Google Play Store 출시 로드맵</h3>
            <p className="text-gray-500 text-xs mt-0.5">{done} / {total} 완료</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 프로그레스 바 */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-emerald-400 font-bold w-8">{progress}%</span>
          </div>
          <span className="text-gray-500 text-sm">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* 스텝 목록 */}
      {open && (
        <div className="px-6 pb-6 space-y-3">
          {/* 모바일 프로그레스 */}
          <div className="flex sm:hidden items-center gap-2 mb-4">
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-emerald-400 font-bold">{progress}%</span>
          </div>

          {ROADMAP_STEPS.map((step, i) => {
            const cfg = statusConfig[step.status];
            return (
              <div
                key={i}
                className={`flex gap-4 rounded-xl border p-4 ${cfg.borderClass} ${
                  step.status === "done" ? "opacity-70" : step.status === "progress" ? "bg-amber-500/5" : "bg-white/2"
                }`}
              >
                {/* 아이콘 + 번호 */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${cfg.iconBg}`}>
                    {step.icon}
                  </div>
                  <span className="text-[10px] text-gray-600 font-mono">{String(i + 1).padStart(2, "0")}</span>
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-bold text-sm ${step.status === "wait" ? "text-gray-400" : "text-white"}`}>
                      {step.title}
                    </p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.badgeClass}`}>
                      {cfg.badge}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{step.desc}</p>
                  {step.detail && (
                    <p className={`text-[11px] mt-1.5 leading-relaxed ${
                      step.status === "progress" ? "text-amber-400/80" :
                      step.status === "done" ? "text-emerald-400/60" : "text-gray-600"
                    }`}>
                      {step.detail}
                    </p>
                  )}
                </div>

                {/* 상태 아이콘 */}
                <div className="shrink-0 self-start mt-1">
                  {step.status === "done"     && <span className="text-emerald-400 text-lg">✓</span>}
                  {step.status === "progress" && <span className="text-amber-400 text-lg animate-pulse">●</span>}
                  {step.status === "wait"     && <span className="text-gray-700 text-lg">○</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [password, setPassword]   = useState("");
  const [authed,   setAuthed]     = useState(false);
  const [stats,    setStats]      = useState<Stats | null>(null);
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState("");

  const handleLogin = () => {
    if (password === ADMIN_SECRET) {
      setAuthed(true);
    } else {
      setError("비밀번호가 틀렸습니다");
    }
  };

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    fetch(`/api/admin/stats?secret=${ADMIN_SECRET}`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false));
  }, [authed]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-8 w-full max-w-sm">
          <div className="flex justify-center mb-6">
            <SpmLogo size="md" />
          </div>
          <h2 className="text-white text-center text-lg font-bold mb-6">관리자 페이지</h2>
          <input
            type="password"
            placeholder="비밀번호 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 mb-3 outline-none focus:ring-2 focus:ring-emerald-500 border border-white/5"
          />
          {error && <p className="text-red-400 text-sm mb-3 text-center">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl transition-colors"
          >
            입장
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  const signupDays = Object.entries(stats.signupByDay).sort(([a], [b]) => a.localeCompare(b));
  const maxSignup  = Math.max(...signupDays.map(([, v]) => v), 1);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 헤더 */}
      <header className="bg-gray-900 border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SpmLogo size="sm" />
          <span className="text-gray-500 text-sm">관리자 대시보드</span>
        </div>
        <button
          onClick={() => setAuthed(false)}
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* 핵심 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard value={stats.totalUsers}   label="👥 총 가입자"      color="emerald" />
          <StatCard value={stats.totalTeams}   label="🏆 활성 팀"        color="blue"    />
          <StatCard value={stats.totalMembers} label="⚽ 등록된 팀원"    color="amber"   />
          <StatCard value={stats.totalMatches} label="📅 총 경기 수"     color="purple"  />
        </div>
        {/* 미설정 팀 안내 */}
        {stats.totalTeamsAll > stats.totalTeams && (
          <div className="bg-gray-900 border border-white/5 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
            <span>⚠️</span>
            <span>
              팀 이름 미설정 (기본값 &quot;우리팀&quot;) :{" "}
              <span className="text-amber-400 font-bold">{stats.totalTeamsAll - stats.totalTeams}개</span>
              {" "}· 전체 가입 팀 {stats.totalTeamsAll}개
            </span>
          </div>
        )}

        {/* ── Play Store 출시 로드맵 ── */}
        <PlayStoreRoadmap />

        {/* Vercel Analytics 안내 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-white">📊 방문자 · 체류시간 분석</h3>
              <p className="text-gray-500 text-sm mt-0.5">Vercel Analytics로 자동 수집 중이에요</p>
            </div>
            <a
              href="https://vercel.com/jeongho-s-projects/soccer-position-project/analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              대시보드 열기 →
            </a>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
              <p className="text-xl">👁️</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">페이지뷰</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Vercel에서 확인</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
              <p className="text-xl">🙋</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">방문자 수</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Vercel에서 확인</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
              <p className="text-xl">⏱️</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">평균 체류시간</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Vercel에서 확인</p>
            </div>
          </div>
        </div>

        {/* 날짜별 가입자 차트 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4">📈 최근 30일 가입자</h3>
          {signupDays.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-6">최근 30일 가입자 없음</p>
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {signupDays.map(([day, count]) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[10px] text-emerald-400 font-bold">{count}</span>
                  <div
                    className="w-full bg-emerald-500 rounded-t-md transition-all"
                    style={{ height: `${(count / maxSignup) * 88}px`, minHeight: "4px" }}
                  />
                  <span className="text-[9px] text-gray-600">{day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 가입자 목록 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4">👤 가입자 목록 <span className="text-gray-500 text-sm font-normal">({stats.totalUsers}명)</span></h3>
          <div className="space-y-2">
            {stats.users.map((user, i) => (
              <div
                key={user.id}
                className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-xl px-4 py-3"
              >
                <span className="text-gray-600 text-xs w-5 shrink-0 text-right">{i + 1}</span>
                {user.image ? (
                  <img src={user.image} alt="" className="w-8 h-8 rounded-full shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm shrink-0">👤</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white">{user.name || "이름 없음"}</p>
                  <p className="text-gray-500 text-xs truncate">{user.email || "-"}</p>
                </div>
                <p className="text-gray-600 text-xs shrink-0">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString("ko-KR") : "-"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
