"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import SpmLogo from "@/components/SpmLogo";

export interface HelpItem {
  icon: string;
  title: string;
  desc: string;
}

export interface HelpContent {
  items: HelpItem[];
}

const NAV_ITEMS = [
  { path: "/dashboard", icon: "⚡", label: "홈" },
  { path: "/members", icon: "👥", label: "팀원 관리" },
  { path: "/formations", icon: "🟩", label: "포메이션" },
  { path: "/matches", icon: "📅", label: "경기 관리" },
  { path: "/assign", icon: "🎯", label: "포지션 배정" },
  { path: "/feedback", icon: "📝", label: "경기 피드백" },
  { path: "/votes", icon: "🗳️", label: "투표" },
  { path: "/dues", icon: "💰", label: "회비 관리" },
  { path: "/stats", icon: "📊", label: "팀 통계" },
  { path: "/board", icon: "💬", label: "게시판" },
  { path: "/videos", icon: "🎬", label: "영상 추천" },
  { path: "/matching", icon: "🤝", label: "팀 매칭", adminOnly: true },
];

// 모바일 하단은 NAV_ITEMS 전체를 가로 스크롤로 표시

export default function AppLayout({ children, title, helpContent }: { children: React.ReactNode; title?: string; helpContent?: HelpContent }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [teamName, setTeamName] = useState("우리팀");
  const [avgAge, setAvgAge] = useState<number | null>(null);
  const [pendingMatches, setPendingMatches] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    fetch("/api/user/profile").then(r => r.json()).then(d => {
      if (d.team_name) setTeamName(d.team_name);
      if (d.avg_age) setAvgAge(d.avg_age);
      if (d.is_owner) setIsOwner(true);
    }).catch(() => {});
    fetch("/api/matching/requests").then(r => r.json()).then((data: { status: string }[]) => {
      if (Array.isArray(data)) setPendingMatches(data.filter(r => r.status === "pending").length);
    }).catch(() => {});
    fetch("/api/notifications").then(r => r.json()).then((data: { is_read: boolean }[]) => {
      if (Array.isArray(data)) setUnreadNotifications(data.filter(n => !n.is_read).length);
    }).catch(() => {});
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">

      {/* ── 사이드바 (PC only) ── */}
      <aside
        className={`hidden md:flex flex-col bg-gray-900 border-r border-white/5 transition-all duration-300 shrink-0 relative ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        {/* 로고 */}
        <div className={`flex items-center border-b border-white/5 h-14 ${collapsed ? "justify-center px-0" : "px-4"}`}>
          {collapsed ? (
            <SpmLogo size="sm" showText={false} clickable />
          ) : (
            <SpmLogo size="sm" clickable />
          )}
        </div>

        {/* 팀 이름 */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">현재 팀</p>
            <p className="text-sm font-bold text-emerald-400 truncate">{teamName}</p>
            {avgAge && (
              <p className="text-[10px] text-gray-500 mt-0.5">평균 나이 <span className="text-gray-400 font-semibold">만 {avgAge}세</span></p>
            )}
          </div>
        )}

        {/* 네비게이션 */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
            const locked = item.adminOnly && !isOwner;
            return (
              <button
                key={item.path}
                onClick={() => !locked && router.push(item.path)}
                disabled={locked}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all group relative ${
                  locked
                    ? "text-gray-700 cursor-not-allowed"
                    : active
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-gray-500 hover:text-white hover:bg-white/5"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? (locked ? `${item.label} (개발중)` : item.label) : undefined}
              >
                {active && !locked && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-emerald-400 rounded-r-full" />
                )}
                <span className="text-base shrink-0 relative" style={locked ? { opacity: 0.35, filter: "grayscale(1)" } : {}}>
                  {item.icon}
                  {item.path === "/matching" && !locked && pendingMatches > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-0.5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                      {pendingMatches}
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <span className="truncate flex-1 flex items-center justify-between">
                    <span className={locked ? "opacity-40" : ""}>{item.label}</span>
                    {locked ? (
                      <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-600 border border-gray-700">
                        개발중
                      </span>
                    ) : item.path === "/matching" && pendingMatches > 0 ? (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                        {pendingMatches}
                      </span>
                    ) : null}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* 하단: 유저 */}
        <div className="border-t border-white/5 p-3">
          <button
            onClick={() => router.push("/mypage")}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors text-left ${collapsed ? "justify-center" : ""}`}
          >
            <span className="relative shrink-0">
              {session?.user?.image ? (
                <img src={session.user.image} alt="" className="w-7 h-7 rounded-full ring-1 ring-emerald-400/30" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-xs">👤</span>
                </div>
              )}
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{session?.user?.name}</p>
                <p className="text-[10px] text-gray-600 truncate">{session?.user?.email}</p>
              </div>
            )}
            {!collapsed && unreadNotifications > 0 && (
              <span className="shrink-0 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                🔔 {unreadNotifications}
              </span>
            )}
          </button>
        </div>

        {/* 접기/펼치기 버튼 – 사이드바 오른쪽 중간 */}
        <button
          onClick={() => setCollapsed(p => !p)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-10 bg-gray-800 border border-white/10 rounded-r-lg flex items-center justify-center text-gray-400 hover:text-emerald-400 hover:border-emerald-400/30 transition-all z-20 text-xs"
        >
          {collapsed ? "›" : "‹"}
        </button>
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* 상단 바 */}
        <header className="h-14 bg-gray-900 border-b border-white/5 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* 모바일 로고 */}
            <div className="md:hidden">
              <SpmLogo size="sm" showText={false} clickable />
            </div>
            {title && <h1 className="text-sm font-bold text-white">{title}</h1>}
          </div>
          <div className="flex items-center gap-2">
            {/* 도움말 버튼 */}
            {helpContent && (
              <button
                onClick={() => setShowHelp(true)}
                className="w-8 h-8 rounded-full bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/50 hover:border-emerald-400 text-emerald-400 hover:text-emerald-300 text-sm font-black flex items-center justify-center transition-colors shadow-sm shadow-emerald-500/20"
                title="사용법"
              >
                ?
              </button>
            )}
            <button
              onClick={() => router.push("/mypage")}
              className="md:hidden"
            >
              {session?.user?.image ? (
                <img src={session.user.image} alt="" className="w-7 h-7 rounded-full ring-1 ring-emerald-400/30" />
              ) : (
                <span className="text-sm">👤</span>
              )}
            </button>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* ── 도움말 모달 ── */}
      {showHelp && helpContent && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💡</span>
                <h3 className="font-bold text-white text-sm">{title} 사용법</h3>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-gray-500 hover:text-white text-xl font-bold leading-none">✕</button>
            </div>
            {/* 항목 목록 */}
            <div className="px-5 py-4 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
              {helpContent.items.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4">
              <button
                onClick={() => setShowHelp(false)}
                className="w-full bg-white/5 hover:bg-white/10 text-gray-400 font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 하단 탭바 (모바일 only) – 가로 스크롤 ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-white/5 z-50">
        <div
          className="flex overflow-x-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {NAV_ITEMS.map(item => {
            const active = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
            const locked = item.adminOnly && !isOwner;
            const showBadge = item.path === "/matching" && !locked && pendingMatches > 0;
            return (
              <button
                key={item.path}
                onClick={() => !locked && router.push(item.path)}
                disabled={locked}
                className={`shrink-0 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative ${
                  locked ? "text-gray-800 cursor-not-allowed" : active ? "text-emerald-400" : "text-gray-600"
                }`}
                style={{ minWidth: 64 }}
              >
                {/* 활성 상단 바 */}
                {active && !locked && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-emerald-400 rounded-b-full" />
                )}
                <span
                  className="text-lg leading-none relative"
                  style={locked ? { filter: "grayscale(1)", opacity: 0.3 } : {}}
                >
                  {item.icon}
                  {showBadge && (
                    <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                      {pendingMatches}
                    </span>
                  )}
                </span>
                <span className={`text-[9px] font-medium whitespace-nowrap ${locked ? "opacity-30" : ""}`}>
                  {locked ? "개발중" : item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
