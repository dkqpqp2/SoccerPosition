"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import SpmLogo from "@/components/SpmLogo";

const NAV_ITEMS = [
  { path: "/dashboard", icon: "⚡", label: "홈" },
  { path: "/members", icon: "👥", label: "팀원 관리" },
  { path: "/formations", icon: "🟩", label: "포메이션" },
  { path: "/matches", icon: "📅", label: "경기 관리" },
  { path: "/assign", icon: "🎯", label: "포지션 배정" },
  { path: "/feedback", icon: "📝", label: "경기 피드백" },
  { path: "/stats", icon: "📊", label: "팀 통계" },
  { path: "/board", icon: "💬", label: "게시판" },
  { path: "/videos", icon: "🎬", label: "영상 추천" },
];

const BOTTOM_NAV = [
  { path: "/dashboard", icon: "⚡", label: "홈" },
  { path: "/matches", icon: "📅", label: "경기" },
  { path: "/board", icon: "💬", label: "게시판" },
  { path: "/stats", icon: "📊", label: "통계" },
  { path: "/members", icon: "👥", label: "팀원" },
];

export default function AppLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [teamName, setTeamName] = useState("우리팀");
  const [avgAge, setAvgAge] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/user/profile").then(r => r.json()).then(d => {
      if (d.team_name) setTeamName(d.team_name);
      if (d.avg_age) setAvgAge(d.avg_age);
    }).catch(() => {});
  }, []);

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
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all group relative ${
                  active
                    ? "text-emerald-400 bg-emerald-500/10"
                    : "text-gray-500 hover:text-white hover:bg-white/5"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-emerald-400 rounded-r-full" />
                )}
                <span className="text-base shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
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
            {session?.user?.image ? (
              <img src={session.user.image} alt="" className="w-7 h-7 rounded-full ring-1 ring-emerald-400/30 shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <span className="text-xs">👤</span>
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{session?.user?.name}</p>
                <p className="text-[10px] text-gray-600 truncate">{session?.user?.email}</p>
              </div>
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
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* ── 하단 탭바 (모바일 only) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-white/5 flex z-50">
        {BOTTOM_NAV.map(item => {
          const active = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                active ? "text-emerald-400" : "text-gray-600"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
