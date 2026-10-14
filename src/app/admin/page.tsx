"use client";

import { useState } from "react";
import {
  Users, Trophy, UserCheck, Calendar, AlertTriangle, Store, CheckCircle2,
  Circle, BarChart3, Eye, Timer, TrendingUp, User as UserIcon, Landmark, IdCard,
  Smartphone, Bot, Zap, Hammer, KeyRound, ClipboardList, Image as ImageIcon,
  FlaskConical, FileText, Rocket, Apple, Bell, ShieldCheck, Palette, Plug, Send, Settings, Camera, Lock, type LucideIcon,
} from "lucide-react";
import SpmLogo from "@/components/SpmLogo";

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
  icon: Icon,
  color,
}: {
  value: number | string;
  label: string;
  icon: LucideIcon;
  color: "emerald" | "sky";
}) {
  const colors = {
    emerald: "text-emerald-400",
    sky:     "text-sky-400",
  };
  return (
    <div className="bg-gray-800 rounded-lg p-5 text-center">
      <Icon size={18} strokeWidth={1.75} className={`mx-auto mb-2 ${colors[color]}`} />
      <p className={`text-3xl font-black ${colors[color]}`}>{value}</p>
      <p className="text-gray-400 text-sm mt-1">{label}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  앱 출시 로드맵 (Google Play · Apple App Store)
// ────────────────────────────────────────────────────────────
type StepStatus = "done" | "progress" | "wait";

interface RoadmapStep {
  icon: LucideIcon;
  title: string;
  desc: string;
  status: StepStatus;
  detail?: string;
}

const PLAY_STEPS: RoadmapStep[] = [
  {
    icon: Landmark,
    title: "Google Play 개발자 계정 생성",
    desc: "$25 등록비 결제 완료",
    status: "done",
    detail: "개발자명: SportsPositionManagement",
  },
  {
    icon: IdCard,
    title: "Google 신원 인증 (D-ID)",
    desc: "Google 신원 인증 완료",
    status: "done",
    detail: "개발자 계정 인증 통과",
  },
  {
    icon: Smartphone,
    title: "전화번호 인증",
    desc: "연락처 인증 완료",
    status: "done",
    detail: "Play Console 계정 설정 → 연락처 인증",
  },
  {
    icon: Bot,
    title: "Android Studio 설치",
    desc: "Android 빌드 도구 설치 완료",
    status: "done",
    detail: "버전: Android Studio Quail 1 | 2026.1.1",
  },
  {
    icon: Zap,
    title: "Capacitor 설정",
    desc: "Next.js → Android 앱 래핑 완료",
    status: "done",
    detail: "appId: com.spm.soccerposition · 라이브 URL 연결 방식",
  },
  {
    icon: Hammer,
    title: "AAB(앱 번들) 빌드",
    desc: "Android Studio에서 Release 빌드 생성 완료",
    status: "done",
    detail: "Build → Generate Signed Bundle → AAB 선택 → keystore 생성",
  },
  {
    icon: KeyRound,
    title: "앱 서명 키(Keystore) 생성",
    desc: "릴리즈 서명용 키 생성 · 백업 완료",
    status: "done",
    detail: "keystore(spm-release-key.jks) 분실 시 업데이트 불가 — 백업 유지, git에는 올리지 말 것",
  },
  {
    icon: ClipboardList,
    title: "Play Console 앱 등록",
    desc: "새 앱 만들기 → 앱 이름·카테고리·언어 설정",
    status: "done",
    detail: "앱 이름: SPM - 팀 포지션 관리 / 카테고리: 스포츠",
  },
  {
    icon: ImageIcon,
    title: "스토어 등록 정보 작성",
    desc: "설명·스크린샷·아이콘·피처드 이미지 업로드",
    status: "done",
    detail: "스크린샷 2장 이상 필수 · 아이콘 512×512px · 피처드 1024×500px",
  },
  {
    icon: FlaskConical,
    title: "내부 테스트 트랙 출시",
    desc: "내부 테스트 후 진행 완료",
    status: "done",
    detail: "내부 테스터 추가 → 링크로 설치 → 기능 확인",
  },
  {
    icon: FileText,
    title: "개인정보처리방침 등록",
    desc: "URL 제출 완료",
    status: "done",
    detail: "https://www.soccerpositionmanagement.com/privacy",
  },
  {
    icon: Rocket,
    title: "프로덕션 출시 신청",
    desc: "Google Play 출시 완료",
    status: "done",
    detail: "이후 앱 껍데기(아이콘·이름) 변경 시에만 새 .aab 업로드 필요 — 웹 화면 변경은 자동 반영",
  },
];

// Apple App Store 출시 로드맵 — 이 프로젝트의 실제 상태(ios/App, codemagic.yaml, Info.plist 등)를 기준으로 작성
const APPLE_STEPS: RoadmapStep[] = [
  {
    icon: Landmark,
    title: "Apple Developer Program 가입",
    desc: "연 $99 결제 · 개인 신원 확인",
    status: "wait",
    detail: "가입 후 승인까지 수일 걸릴 수 있어요 · 앱 출시와 TestFlight 모두 이 계정이 필요",
  },
  {
    icon: Zap,
    title: "Capacitor iOS 프로젝트",
    desc: "ios/App 생성 완료 (Swift Package Manager 방식)",
    status: "done",
    detail: "번들 ID: com.soccerpositionmanagement.app · 버전 1.0 (빌드 1) · Podfile 없음",
  },
  {
    icon: ShieldCheck,
    title: "Sign in with Apple 추가",
    desc: "카카오 같은 소셜 로그인만 있으면 심사에서 반려될 수 있어요 (가이드라인 4.8)",
    status: "wait",
    detail: "NextAuth에 Apple provider 추가 + Apple Developer에서 Sign in with Apple 설정 · 기존 users 연결 방식 설계 필요",
  },
  {
    icon: Lock,
    title: "앱 안에서 계정 삭제",
    desc: "마이페이지 탈퇴 기능 있음 (가이드라인 5.1.1)",
    status: "done",
    detail: "심사 노트에 '마이페이지 > 탈퇴' 위치를 적어두기",
  },
  {
    icon: FileText,
    title: "개인정보처리방침 URL",
    desc: "/privacy 페이지 있음 · 2026년 10월 3일 갱신",
    status: "done",
    detail: "App Store Connect에 이 URL을 입력",
  },
  {
    icon: Palette,
    title: "앱 아이콘 교체",
    desc: "iOS 1024×1024 아이콘이 아직 예전 로고",
    status: "wait",
    detail: "투명 배경·모서리 둥글림 없는 정사각형 PNG · ios/App/App/Assets.xcassets/AppIcon.appiconset 교체",
  },
  {
    icon: Settings,
    title: "Info.plist 점검",
    desc: "사용하는 권한만 설명 문구 추가 (현재 권한 문구 없음)",
    status: "wait",
    detail: "사진·카메라·알림 등 실제로 쓰는 기능만 · 쓰지 않는 권한 문구는 넣지 않기",
  },
  {
    icon: Bell,
    title: "푸시 알림 (APNs) — 선택",
    desc: "지금은 웹 푸시(web-push)만 있어서 iOS 앱에서는 별도 작업 필요",
    status: "wait",
    detail: "첫 출시에서는 빼고 나중에 추가해도 됨 · 넣으려면 APNs 키 + Capacitor Push Notifications 플러그인",
  },
  {
    icon: Hammer,
    title: "Codemagic 빌드 설정 수정",
    desc: "codemagic.yaml에 pod install · App.xcworkspace가 있는데 이 프로젝트에는 없음",
    status: "progress",
    detail: "pod install 단계 삭제 · XCODE_WORKSPACE 대신 ios/App/App.xcodeproj 사용 · GitHub 저장소 연결은 완료",
  },
  {
    icon: Plug,
    title: "App Store Connect API 키 연동",
    desc: "키 발급 → Codemagic 통합(Integrations)에 등록",
    status: "wait",
    detail: "사용자 및 액세스 > 통합 > API 키 · 등록 이름은 codemagic.yaml의 appstore_connect_api_key와 맞추기",
  },
  {
    icon: ClipboardList,
    title: "App Store Connect 앱 등록",
    desc: "새 앱 만들기 → 이름 · 번들 ID · SKU · 기본 언어",
    status: "wait",
    detail: "카테고리: 스포츠 · 번들 ID는 com.soccerpositionmanagement.app와 동일해야 해요",
  },
  {
    icon: FlaskConical,
    title: "TestFlight 내부 테스트",
    desc: "Codemagic으로 빌드 → TestFlight 업로드 → 내 아이폰에 설치",
    status: "wait",
    detail: "로그인(카카오·Apple) · 알림 · 화면 비율을 실제 기기에서 확인",
  },
  {
    icon: Camera,
    title: "스토어 등록 정보",
    desc: "스크린샷 · 설명 · 키워드 · 지원 URL",
    status: "wait",
    detail: "iPhone 6.9인치(1320×2868) 스크린샷 필수 · 앱 개인정보 라벨 · 연령 등급 · 수출 규정 답변",
  },
  {
    icon: KeyRound,
    title: "심사용 로그인 정보 준비",
    desc: "심사관은 카카오 계정이 없어서 로그인을 못 해요",
    status: "wait",
    detail: "리뷰 노트에 테스트용 카카오 계정(또는 데모 로그인 방법)을 적기 · 로그인 없이는 기능 확인이 안 돼 반려돼요",
  },
  {
    icon: Smartphone,
    title: "'웹사이트 포장' 반려 대비 (4.2)",
    desc: "단순 웹뷰 앱은 최소 기능 미달로 반려될 수 있어요",
    status: "wait",
    detail: "리뷰 노트에 앱다운 기능을 설명 (로그인 연동, 포지션 배정, 전술판 재생, 알림, 공유, 팀 데이터 관리)",
  },
  {
    icon: Send,
    title: "심사 제출 → 출시",
    desc: "Apple 심사 (보통 1~2일) → 승인 → App Store 공개",
    status: "wait",
    detail: "반려되면 사유를 고쳐 재제출 · 승인 후 '수동 출시'와 '자동 출시' 중 선택",
  },
];

const statusConfig: Record<StepStatus, { badge: string; badgeClass: string; borderClass: string; iconBg: string }> = {
  done:     { badge: "완료",      badgeClass: "bg-emerald-500/20 text-emerald-400",  borderClass: "border-emerald-500/30", iconBg: "bg-emerald-500/15" },
  progress: { badge: "진행 중",   badgeClass: "bg-amber-500/20 text-amber-400",      borderClass: "border-amber-500/40",   iconBg: "bg-amber-500/15"   },
  wait:     { badge: "대기",      badgeClass: "bg-gray-700/60 text-gray-500",        borderClass: "border-white/5",        iconBg: "bg-white/5"        },
};

function Roadmap({ title, steps, defaultOpen, icon: HeaderIcon }: {
  title: string; steps: RoadmapStep[]; defaultOpen: boolean; icon: LucideIcon;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const done     = steps.filter(s => s.status === "done").length;
  const total    = steps.length;
  const progress = Math.round((done / total) * 100);

  return (
    <div className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <HeaderIcon size={22} strokeWidth={1.75} className="text-emerald-400" />
          <div className="text-left">
            <h3 className="font-bold text-white text-base">{title}</h3>
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

          {steps.map((step, i) => {
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
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.iconBg} ${
                    step.status === "done" ? "text-emerald-400" : step.status === "progress" ? "text-amber-400" : "text-gray-500"
                  }`}>
                    <step.icon size={18} strokeWidth={1.75} />
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
                  {step.status === "done"     && <CheckCircle2 size={18} className="text-emerald-400" />}
                  {step.status === "progress" && <Circle size={18} className="text-amber-400 fill-amber-400/40 animate-pulse" />}
                  {step.status === "wait"     && <Circle size={18} className="text-gray-700" />}
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

  // 비밀번호는 코드에 두지 않고, 입력한 값을 서버가 직접 검사 (주소창이 아니라 헤더로 전달)
  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stats", { headers: { "x-admin-secret": password } });
      if (res.status === 401) {
        setError("비밀번호가 틀렸습니다");
        return;
      }
      if (!res.ok) {
        setError("관리자 기능이 설정되지 않았어요");
        return;
      }
      setStats(await res.json());
      setAuthed(true);
    } catch {
      setError("요청에 실패했어요");
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-gray-900 border border-white/5 rounded-lg p-8 w-full max-w-sm">
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
          <StatCard value={stats.totalUsers}   label="총 가입자"      icon={Users}     color="emerald" />
          <StatCard value={stats.totalTeams}   label="활성 팀"        icon={Trophy}    color="sky"     />
          <StatCard value={stats.totalMembers} label="등록된 팀원"    icon={UserCheck} color="emerald" />
          <StatCard value={stats.totalMatches} label="총 경기 수"     icon={Calendar}  color="sky"     />
        </div>
        {/* 미설정 팀 안내 */}
        {stats.totalTeamsAll > stats.totalTeams && (
          <div className="bg-gray-900 border border-white/5 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
            <AlertTriangle size={15} strokeWidth={1.75} className="text-amber-400" />
            <span>
              팀 이름 미설정 (기본값 &quot;우리팀&quot;) :{" "}
              <span className="text-amber-400 font-bold">{stats.totalTeamsAll - stats.totalTeams}개</span>
              {" "}· 전체 가입 팀 {stats.totalTeamsAll}개
            </span>
          </div>
        )}

        {/* ── 앱 출시 로드맵 ── */}
        <Roadmap title="Apple App Store 출시 로드맵" steps={APPLE_STEPS} defaultOpen icon={Apple} />
        <Roadmap title="Google Play Store 출시 로드맵" steps={PLAY_STEPS} defaultOpen={false} icon={Store} />

        {/* Vercel Analytics 안내 */}
        <div className="bg-gray-900 border border-white/5 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-white flex items-center gap-2"><BarChart3 size={16} strokeWidth={1.75} className="text-gray-400" /> 방문자 · 체류시간 분석</h3>
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
              <Eye size={20} strokeWidth={1.75} className="text-gray-400 mx-auto" />
              <p className="text-xs text-gray-400 mt-1 font-medium">페이지뷰</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Vercel에서 확인</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
              <Users size={20} strokeWidth={1.75} className="text-gray-400 mx-auto" />
              <p className="text-xs text-gray-400 mt-1 font-medium">방문자 수</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Vercel에서 확인</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
              <Timer size={20} strokeWidth={1.75} className="text-gray-400 mx-auto" />
              <p className="text-xs text-gray-400 mt-1 font-medium">평균 체류시간</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Vercel에서 확인</p>
            </div>
          </div>
        </div>

        {/* 날짜별 가입자 차트 */}
        <div className="bg-gray-900 border border-white/5 rounded-lg p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><TrendingUp size={18} strokeWidth={1.75} className="text-gray-400" /> 최근 30일 가입자</h3>
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
        <div className="bg-gray-900 border border-white/5 rounded-lg p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><UserIcon size={18} strokeWidth={1.75} className="text-gray-400" /> 가입자 목록 <span className="text-gray-500 text-sm font-normal">({stats.totalUsers}명)</span></h3>
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
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0"><UserIcon size={14} className="text-gray-400" /></div>
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
