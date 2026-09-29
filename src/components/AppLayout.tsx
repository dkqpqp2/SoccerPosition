"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Home, Users, HeartPulse, LayoutGrid, Calendar, Target, FileText,
  Vote, Wallet, BarChart3, MessageCircle, Clapperboard, Handshake,
  User, Bell, Lightbulb, X, Swords, type LucideIcon,
} from "lucide-react";
import SpmLogo from "@/components/SpmLogo";

export interface HelpItem {
  icon: string;
  title: string;
  desc: string;
}

export interface HelpContent {
  items: HelpItem[];
}

const NAV_ITEMS: { path: string; icon: LucideIcon; label: string; managerOnly?: boolean; adminOnly?: boolean; ownerOnlyHidden?: boolean; group?: string }[] = [
  { path: "/dashboard", icon: Home, label: "홈", group: "팀" },
  { path: "/members", icon: Users, label: "팀원 관리" },
  { path: "/status", icon: HeartPulse, label: "팀 현황" },
  { path: "/formations", icon: LayoutGrid, label: "포메이션", managerOnly: true, group: "경기" },
  { path: "/matches", icon: Calendar, label: "경기 관리" },
  { path: "/assign", icon: Target, label: "포지션 배정", managerOnly: true },
  { path: "/feedback", icon: FileText, label: "경기 피드백" },
  { path: "/scrimmage", icon: Swords, label: "내전", ownerOnlyHidden: true },
  { path: "/votes", icon: Vote, label: "투표", group: "커뮤니티" },
  { path: "/board", icon: MessageCircle, label: "게시판" },
  { path: "/videos", icon: Clapperboard, label: "영상 추천" },
  { path: "/dues", icon: Wallet, label: "회비 관리", group: "관리" },
  { path: "/stats", icon: BarChart3, label: "팀 통계" },
  { path: "/matching", icon: Handshake, label: "팀 매칭", adminOnly: true },
];

// 모바일 하단 탭바는 그룹 단위(팀/경기/커뮤니티/관리)로 묶어서 표시
const GROUP_ICONS: Record<string, LucideIcon> = {
  "팀": Home,
  "경기": Calendar,
  "커뮤니티": MessageCircle,
  "관리": Wallet,
};

function groupNavItems(items: typeof NAV_ITEMS) {
  const groups: { name: string; icon: LucideIcon; items: typeof NAV_ITEMS }[] = [];
  for (const item of items) {
    if (item.group || groups.length === 0) {
      groups.push({ name: item.group ?? "기타", icon: GROUP_ICONS[item.group ?? ""] ?? Home, items: [] });
    }
    groups[groups.length - 1].items.push(item);
  }
  return groups;
}

export default function AppLayout({ children, title, helpContent }: { children: React.ReactNode; title?: string; helpContent?: HelpContent }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [teamName, setTeamName] = useState("우리팀");
  const [teamLogoUrl, setTeamLogoUrl] = useState<string | null>(null);
  const [avgAge, setAvgAge] = useState<number | null>(null);
  const [pendingMatches, setPendingMatches] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => { setOpenGroup(null); }, [pathname]);

  // 포메이션·포지션 배정은 관리자급(owner/manager/coach/president)에게만 표시
  const canManageNav = userRole === "owner" || userRole === "manager" || userRole === "coach" || userRole === "president";
  // 게시판은 FC키싱구라미 전용
  const boardAllowed = teamId === process.env.NEXT_PUBLIC_BOARD_TEAM_ID;

  function fetchSidebarData() {
    fetch("/api/user/profile").then(r => r.json()).then(d => {
      if (d.team_name) setTeamName(d.team_name);
      setTeamLogoUrl(d.team_logo_url ?? null);
      if (d.avg_age !== undefined) setAvgAge(d.avg_age ?? null);
      setIsOwner(!!d.is_owner);
      setUserRole(d.role ?? null);
      setTeamId(d.team_id ?? null);
    }).catch(() => {});
    fetch("/api/matching/requests").then(r => r.json()).then((data: { status: string }[]) => {
      if (Array.isArray(data)) setPendingMatches(data.filter(r => r.status === "pending").length);
    }).catch(() => {});
    fetch("/api/notifications").then(r => r.json()).then((data: { is_read: boolean }[]) => {
      if (Array.isArray(data)) setUnreadNotifications(data.filter(n => !n.is_read).length);
    }).catch(() => {});
  }

  useEffect(() => {
    fetchSidebarData();
  }, [pathname]);

  // 팀 전환 시 즉시 사이드바 갱신
  useEffect(() => {
    window.addEventListener("teamSwitch", fetchSidebarData);
    return () => window.removeEventListener("teamSwitch", fetchSidebarData);
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
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2.5">
            {teamLogoUrl && (
              <img src={teamLogoUrl} alt={teamName} className="w-8 h-8 rounded-lg object-cover shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">현재 팀</p>
              <p className="text-sm font-bold text-emerald-400 truncate">{teamName}</p>
              {avgAge && (
                <p className="text-[10px] text-gray-500 mt-0.5">평균 나이 <span className="text-gray-400 font-semibold">만 {avgAge}세</span></p>
              )}
            </div>
          </div>
        )}

        {/* 네비게이션 */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.filter(item => {
            if (item.managerOnly && !canManageNav) return false;
            if (item.ownerOnlyHidden && !isOwner) return false;
            if (item.path === "/board" && !boardAllowed) return false;
            return true;
          }).map((item, idx) => {
            const active = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
            const locked = item.adminOnly && !isOwner;
            return (
              <div key={item.path}>
                {item.group && (
                  <>
                    {idx > 0 && <div className="my-2 border-t border-white/5 mx-4" />}
                    {!collapsed && (
                      <p className="px-4 pt-1 pb-1 text-[10px] font-bold text-gray-600 uppercase tracking-widest">{item.group}</p>
                    )}
                  </>
                )}
                <button
                onClick={() => !locked && router.push(item.path)}
                disabled={locked}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all group relative ${
                  locked
                    ? "text-gray-700 cursor-not-allowed"
                    : active
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? (locked ? `${item.label} (개발중)` : item.label) : undefined}
              >
                {active && !locked && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-emerald-400 rounded-r-full" />
                )}
                <span className="shrink-0 relative" style={locked ? { opacity: 0.35, filter: "grayscale(1)" } : {}}>
                  <item.icon size={18} strokeWidth={2.25} />
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
              </div>
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
                <img src={session.user.image.replace(/^http:\/\//, 'https://')} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full ring-1 ring-emerald-400/30" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <User size={14} className="text-emerald-400" />
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
              <span className="shrink-0 flex items-center gap-1 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                <Bell size={10} /> {unreadNotifications}
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 hover:border-emerald-400/60 transition-colors group"
                title="사용법"
              >
                <span className="w-4 h-4 rounded-full bg-emerald-500/30 text-emerald-400 text-[11px] font-black flex items-center justify-center leading-none">?</span>
                <span className="text-[11px] font-semibold text-gray-500 group-hover:text-gray-400 transition-colors">사용법</span>
              </button>
            )}
            <button
              onClick={() => router.push("/mypage")}
              className="md:hidden relative"
            >
              {session?.user?.image ? (
                <img src={session.user.image.replace(/^http:\/\//, 'https://')} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full ring-1 ring-emerald-400/30" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
              ) : (
                <User size={16} className="text-gray-400" />
              )}
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
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
          className="fixed inset-0 bg-black/70 z-50 overflow-y-auto"
          onClick={() => setShowHelp(false)}
        >
          <div className="flex min-h-full items-center justify-center px-4 py-6">
          <div
            className="bg-gray-900 border border-white/10 rounded-lg shadow-2xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-emerald-400" />
                <h3 className="font-bold text-white text-sm">{title} 사용법</h3>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-gray-500 hover:text-white leading-none">
                <X size={18} />
              </button>
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
        </div>
      )}

      {/* ── 하단 탭바 (모바일 only) – 팀/경기/커뮤니티/관리 그룹 ── */}
      {(() => {
        const visibleItems = NAV_ITEMS.filter(item => {
          if (item.managerOnly && !canManageNav) return false;
          if (item.ownerOnlyHidden && !isOwner) return false;
          if (item.path === "/board" && !boardAllowed) return false;
          return true;
        });
        const groups = groupNavItems(visibleItems);
        const activeGroup = groups.find(g =>
          g.items.some(it => pathname === it.path || (it.path !== "/dashboard" && pathname.startsWith(it.path)))
        );
        const openedGroup = groups.find(g => g.name === openGroup);

        return (
          <>
            {openedGroup && (
              <div className="md:hidden fixed inset-0 z-40" onClick={() => setOpenGroup(null)} />
            )}

            {openedGroup && (
              <div className="md:hidden fixed left-0 right-0 bottom-[60px] z-50 bg-gray-900 border-t border-white/5 rounded-t-2xl px-2 pt-3 pb-2 shadow-2xl">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest px-2 mb-2">{openedGroup.name}</p>
                <div className="grid grid-cols-4 gap-1">
                  {openedGroup.items.map(item => {
                    const active = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
                    const locked = item.adminOnly && !isOwner;
                    const showBadge = item.path === "/matching" && !locked && pendingMatches > 0;
                    return (
                      <button
                        key={item.path}
                        onClick={() => { if (locked) return; setOpenGroup(null); router.push(item.path); }}
                        disabled={locked}
                        className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-colors relative ${
                          locked ? "text-gray-700 cursor-not-allowed" : active ? "text-emerald-400 bg-emerald-500/10" : "text-gray-400"
                        }`}
                      >
                        <span className="relative" style={locked ? { filter: "grayscale(1)", opacity: 0.35 } : {}}>
                          <item.icon size={19} strokeWidth={2.25} />
                          {showBadge && (
                            <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                              {pendingMatches}
                            </span>
                          )}
                        </span>
                        <span className={`text-[9px] font-medium text-center leading-tight ${locked ? "opacity-40" : ""}`}>
                          {locked ? "개발중" : item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-gray-900 border-t border-white/5 z-50">
              <div className="flex h-full">
                {groups.map(g => {
                  const isOpen = openGroup === g.name;
                  const isActive = !isOpen && activeGroup?.name === g.name;
                  const groupBadge = g.items.some(it => it.path === "/matching") && isOwner && pendingMatches > 0;
                  return (
                    <button
                      key={g.name}
                      onClick={() => setOpenGroup(isOpen ? null : g.name)}
                      className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
                        isOpen || isActive ? "text-emerald-400" : "text-gray-500"
                      }`}
                    >
                      {(isOpen || isActive) && (
                        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-emerald-400 rounded-b-full" />
                      )}
                      <span className="leading-none relative">
                        <g.icon size={20} strokeWidth={2.25} />
                        {groupBadge && (
                          <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                            {pendingMatches}
                          </span>
                        )}
                      </span>
                      <span className="text-[9px] font-medium">{g.name}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </>
        );
      })()}
    </div>
  );
}
