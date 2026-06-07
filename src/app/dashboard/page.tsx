"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";

type TeamRole = "owner" | "manager" | "coach" | "president" | "member" | "treasurer";

interface TeamMember {
  role: TeamRole;
  joined_at: string;
  user_id: string;
  users: { id: string; name: string; email: string; image: string };
}

interface TeamInfo {
  id: string;
  name: string;
  invite_code: string;
  my_role: TeamRole;
  is_owner: boolean;
  can_manage: boolean;
  members: TeamMember[];
}

interface MyTeamItem {
  id: string;
  name: string;
  color: string;
  role: TeamRole;
  is_mine: boolean;
  is_active: boolean;
}

interface Match {
  id: string;
  title: string;
  match_date: string;
  match_time: string | null;
  match_end_time: string | null;
  location: string | null;
}

interface Assignment {
  id: string;
  session_name: string;
  result: Record<string, { id: string; name: string } | null>;
  formation_slots: { id: string; label: string; x: number; y: number }[];
  created_at: string;
}

interface MemberInfo {
  id: string;
  is_mercenary: boolean;
}

interface PlayerFeedback {
  name: string;
  feedback: string;
}

interface FeedbackData {
  team_feedback: string | null;
  player_feedbacks: PlayerFeedback[];
}

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "관리자",
  manager: "감독",
  coach: "코치",
  president: "회장",
  member: "팀원",
  treasurer: "총무",
};

const ROLE_COLOR: Record<TeamRole, string> = {
  owner: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  manager: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  coach: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
  president: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  member: "bg-white/10 text-gray-400 border border-white/10",
  treasurer: "bg-teal-500/20 text-teal-400 border border-teal-500/30",
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [myTeams, setMyTeams] = useState<MyTeamItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [memberPage,  setMemberPage]  = useState(0);
  const PAGE_SIZE = 10;
  const [switching, setSwitching] = useState(false);

  const [upcomingMatch, setUpcomingMatch] = useState<Match | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeQuarter, setActiveQuarter] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // 클론 포함 trackIndex: 0=마지막클론, 1~n=실제, n+1=첫번째클론
  const [trackIdx, setTrackIdx] = useState(1);
  const [isJumping, setIsJumping] = useState(false);
  const [mercenaryIds, setMercenaryIds] = useState<Set<string>>(new Set());

  const [recentFeedbackMatch, setRecentFeedbackMatch] = useState<Match | null>(null);
  const [recentFeedback, setRecentFeedback] = useState<FeedbackData | null>(null);
  const [feedbackLoaded, setFeedbackLoaded] = useState(false);

  // 슬라이더 터치/드래그
  const sliderRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number>(0);
  // stale closure 방지용 ref — 항상 최신 trackIdx 값
  const trackIdxRef = useRef<number>(1);
  // 캐러셀 실제 너비 (ResizeObserver로 추적)
  const [carouselWidth, setCarouselWidth] = useState(0);

  // trackIdx + ref 동시 업데이트 헬퍼
  function updateTrackIdx(val: number) {
    trackIdxRef.current = val;
    setTrackIdx(val);
  }

  // 캐러셀 실제 너비를 ResizeObserver로 추적 (다른 페이지 갔다 와도 정확히 재계산)
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setCarouselWidth(w);
    });
    ro.observe(el);
    // 초기값 즉시 설정
    if (el.clientWidth > 0) setCarouselWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [carouselRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") {
      fetchTeam();
      fetchMyTeams();
      fetchMatchData();
      fetchMembers();
    }
  }, [status]);

  async function fetchMembers() {
    const res = await fetch("/api/members");
    if (!res.ok) return;
    const data: MemberInfo[] = await res.json();
    setMercenaryIds(new Set(data.filter(m => m.is_mercenary).map(m => m.id)));
  }

  async function fetchTeam() {
    const res = await fetch("/api/team");
    if (res.ok) setTeam(await res.json());
  }

  async function fetchMyTeams() {
    const res = await fetch("/api/team/list");
    if (res.ok) setMyTeams(await res.json());
  }

  async function fetchMatchData() {
    const res = await fetch("/api/matches");
    if (!res.ok) return;
    const matches: (Match & { position_assignments: Assignment[] })[] = await res.json();
    if (!matches.length) { setFeedbackLoaded(true); return; }

    const now = new Date();

    // 경기 종료 시간이 아직 안 지난 경기 중 가장 가까운 것
    const upcoming = matches
      .filter(m => {
        const [y, mo, d] = m.match_date.split("-").map(Number);
        if (m.match_end_time) {
          const [h, min] = m.match_end_time.split(":").map(Number);
          return now < new Date(y, mo - 1, d, h, min, 0);
        } else {
          // 종료 시간 없으면 경기 날짜 자정까지
          return now <= new Date(y, mo - 1, d, 23, 59, 59);
        }
      })
      .sort((a, b) => a.match_date.localeCompare(b.match_date))[0]
      ?? matches.sort((a, b) => b.match_date.localeCompare(a.match_date))[0]; // 없으면 가장 최근 과거 경기

    setUpcomingMatch(upcoming);
    setActiveQuarter(0);
    updateTrackIdx(1);

    const aRes = await fetch(`/api/assignments?matchId=${upcoming.id}`);
    if (aRes.ok) {
      const data: Assignment[] = await aRes.json();
      setAssignments(
        [...data].sort((a, b) => a.session_name.localeCompare(b.session_name, "ko"))
      );
    }

    // 가장 최근 종료된 경기의 피드백
    const pastMatch = matches
      .filter(m => {
        const [y, mo, d] = m.match_date.split("-").map(Number);
        if (m.match_end_time) {
          const [h, min] = m.match_end_time.split(":").map(Number);
          return now >= new Date(y, mo - 1, d, h, min, 0);
        } else {
          return now > new Date(y, mo - 1, d, 23, 59, 59);
        }
      })
      .sort((a, b) => b.match_date.localeCompare(a.match_date))[0];

    if (pastMatch) {
      setRecentFeedbackMatch(pastMatch);
      const fRes = await fetch(`/api/feedback?matchId=${pastMatch.id}`);
      if (fRes.ok) {
        const fData = await fRes.json();
        setRecentFeedback(fData.feedback ?? null);
      }
    }
    setFeedbackLoaded(true);
  }

  async function switchTeam(teamId: string) {
    if (switching) return;
    setSwitching(true);
    // 이전 팀 데이터 즉시 초기화
    setUpcomingMatch(null);
    setAssignments([]);
    setRecentFeedbackMatch(null);
    setRecentFeedback(null);
    setFeedbackLoaded(false);
    setMercenaryIds(new Set());
    await fetch("/api/team/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId }),
    });
    await Promise.all([fetchTeam(), fetchMyTeams(), fetchMatchData(), fetchMembers()]);
    setShowMembers(false);
    setShowInvite(false);
    setSwitching(false);
  }

  function copyInviteLink() {
    const link = `${window.location.origin}/join?code=${team?.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function changeRole(targetUserId: string, newRole: TeamRole) {
    const res = await fetch("/api/team/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_user_id: targetUserId, new_role: newRole }),
    });
    if (res.ok) fetchTeam();
    else alert((await res.json()).error);
  }

  async function kickMember(targetUserId: string, name: string) {
    if (!confirm(`"${name}"님을 팀에서 강퇴할까요?`)) return;
    const res = await fetch("/api/team/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_user_id: targetUserId }),
    });
    if (res.ok) fetchTeam();
    else alert((await res.json()).error);
  }

  // 포지션 카테고리 색상
  function getSlotStyle(label: string, memberId: string | undefined, isGK: boolean) {
    if (isGK) return "bg-amber-400 border-amber-300 text-gray-900";

    const pos = label.toUpperCase();
    // 수비
    if (/^(CB|LB|RB|LWB|RWB|SW|DC|DL|DR|WB|FB)/.test(pos))
      return "bg-blue-500 border-blue-400 text-white";
    // 공격
    if (/^(ST|CF|SS|LW|RW|LF|RF|FW|ATT|WG|CW)/.test(pos))
      return "bg-red-500 border-red-400 text-white";
    // 미드필더 (기본)
    return "bg-emerald-400 border-emerald-300 text-gray-900";
  }

  function formatDate(dateStr: string) {
    // UTC 파싱 오류 방지: 로컬 시간으로 파싱
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return {
      label: diff > 0 ? `D-${diff}` : diff === 0 ? "오늘" : `D+${Math.abs(diff)}`,
      isUpcoming: diff >= 0,
      formatted: `${month}월 ${day}일 (${["일","월","화","수","목","금","토"][d.getDay()]})`,
    };
  }

  function changeQuarter(idx: number) {
    updateTrackIdx(idx + 1);
    setActiveQuarter(idx);
  }

  function slideTo(newTrackIdx: number, n: number) {
    // 범위 클램핑: 빠른 스와이프로 범위 초과 방지
    newTrackIdx = Math.max(0, Math.min(n + 1, newTrackIdx));
    updateTrackIdx(newTrackIdx);
    if (newTrackIdx === 0) setActiveQuarter(n - 1);
    else if (newTrackIdx === n + 1) setActiveQuarter(0);
    else setActiveQuarter(newTrackIdx - 1);
  }

  function onCarouselTransitionEnd(n: number) {
    // ref로 최신값 참조 (state는 클로저 캡처 시점 문제)
    const current = trackIdxRef.current;
    if (current !== 0 && current !== n + 1) return;
    const newIdx = current === 0 ? n : 1;
    const newActive = newIdx - 1;

    // 모든 transition 끄고 → 위치+내용 동시 업데이트 → transition 복원
    setIsJumping(true);
    updateTrackIdx(newIdx);
    setActiveQuarter(newActive);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setIsJumping(false))
    );
  }

  // 터치
  function onTouchStart(e: React.TouchEvent) {
    dragStartX.current = e.touches[0].clientX;
    setIsDragging(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    setDragOffset(e.touches[0].clientX - dragStartX.current);
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - dragStartX.current;
    setIsDragging(false);
    setDragOffset(0);
    if (Math.abs(dx) > 50) {
      // ref로 최신 trackIdx 참조 (stale closure 방지)
      const current = trackIdxRef.current;
      slideTo(dx < 0 ? current + 1 : current - 1, assignments.length);
    }
  }

  // 마우스
  function onMouseDown(e: React.MouseEvent) {
    dragStartX.current = e.clientX;
    setIsDragging(true);
    function onMouseMove(ev: MouseEvent) { setDragOffset(ev.clientX - dragStartX.current); }
    function onMouseUp(ev: MouseEvent) {
      const dx = ev.clientX - dragStartX.current;
      setIsDragging(false);
      setDragOffset(0);
      if (Math.abs(dx) > 50) {
        // ref로 최신 trackIdx 참조 (클로저 캡처 시점 문제 방지)
        const current = trackIdxRef.current;
        slideTo(dx < 0 ? current + 1 : current - 1, assignments.length);
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const joinedTeam = myTeams.find(t => !t.is_mine);
  const myOwnTeam = myTeams.find(t => t.is_mine);

  return (
    <AppLayout title="홈">
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-5">

        {/* 신규 가입 온보딩 배너: 팀 이름이 기본값인 경우 */}
        {team?.name === "우리팀" && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl shrink-0">👋</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-emerald-300 text-sm">가입을 환영해요!</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                아직 팀 이름이 <span className="text-white font-semibold">"우리팀"</span>으로 되어 있어요.
                마이페이지에서 팀 이름을 변경해주세요!
              </p>
            </div>
            <button
              onClick={() => router.push("/mypage")}
              className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
            >
              팀 이름 설정 →
            </button>
          </div>
        )}

        {/* 팀 전환 탭 */}
        {myTeams.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {myOwnTeam && (
              <button
                onClick={() => switchTeam(myOwnTeam.id)}
                disabled={switching}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                  myOwnTeam.is_active
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                🏠 내 팀
                <span className="text-xs opacity-75 font-normal truncate max-w-[80px]">{myOwnTeam.name}</span>
              </button>
            )}
            {joinedTeam && (
              <button
                onClick={() => switchTeam(joinedTeam.id)}
                disabled={switching}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                  joinedTeam.is_active
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                🤝 가입한 팀
                <span className="text-xs opacity-75 font-normal truncate max-w-[80px]">{joinedTeam.name}</span>
              </button>
            )}
            {!joinedTeam && (
              <button
                onClick={() => router.push("/join")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white/5 text-gray-400 hover:bg-white/10 border border-dashed border-white/10 transition-colors whitespace-nowrap"
              >
                + 팀 가입
              </button>
            )}
          </div>
        )}

        {/* 팀 카드 */}
        {team && (
          <div className="bg-gray-900 rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <span className="text-emerald-400 font-black text-base">{team.name[0]}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white">{team.name}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLOR[team.my_role]}`}>
                      {ROLE_LABEL[team.my_role]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex -space-x-1.5">
                      {team.members.slice(0, 5).map((m, i) =>
                        m.users?.image ? (
                          <img key={i} src={m.users.image} alt={m.users.name} className="w-5 h-5 rounded-full ring-1 ring-gray-900" />
                        ) : (
                          <div key={i} className="w-5 h-5 rounded-full ring-1 ring-gray-900 bg-emerald-500/20 flex items-center justify-center text-[9px]">👤</div>
                        )
                      )}
                    </div>
                    <p className="text-xs text-gray-500">팀원 {team.members.length}명</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { setShowMembers(true); setShowInvite(false); setMemberPage(0); }}
                  className="text-xs font-bold px-3 py-2 rounded-xl transition-colors bg-white/5 text-gray-400 hover:bg-white/10"
                >
                  👥 팀원
                </button>
                {team.is_owner && (
                  <button
                    onClick={() => { setShowInvite(true); setShowMembers(false); }}
                    className="text-xs font-bold px-3 py-2 rounded-xl transition-colors bg-white/5 text-gray-400 hover:bg-white/10"
                  >
                    🔗 초대
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 포지션 배정 슬라이더 ── */}
        {upcomingMatch && (() => {
          const { label, isUpcoming, formatted } = formatDate(upcomingMatch.match_date);
          return (
            <div className="bg-gray-900 rounded-2xl border border-white/5 overflow-hidden">
              {/* 경기 정보 헤더 */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">
                    {isUpcoming ? "다가오는 경기" : "최근 경기"}
                  </p>
                  <p className="text-sm font-bold text-white">{upcomingMatch.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatted}{upcomingMatch.location ? ` · ${upcomingMatch.location}` : ""}</p>
                </div>
                <span className={`text-sm font-black px-3 py-1.5 rounded-xl shrink-0 ${
                  isUpcoming
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/5 text-gray-400 border border-white/10"
                }`}>
                  {label}
                </span>
              </div>

              {assignments.length > 0 ? (
                <>
                  {/* 쿼터 탭 */}
                  <div className="flex gap-1.5 px-4 py-2 overflow-x-auto">
                    {assignments.map((a, i) => (
                      <button
                        key={a.id}
                        onClick={() => changeQuarter(i)}
                        className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                          activeQuarter === i
                            ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/30"
                            : "bg-white/5 text-gray-400 hover:bg-white/10"
                        }`}
                      >
                        {a.session_name || `${i + 1}쿼터`}
                      </button>
                    ))}
                  </div>

                  {/* 캐러셀 */}
                  {(() => {
                    const n = assignments.length;
                    return (
                      <div
                        ref={carouselRef}
                        className="overflow-hidden pb-4 select-none cursor-grab active:cursor-grabbing"
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                        onMouseDown={onMouseDown}
                      >
                        {(() => {
                          const GAP = 12;
                          const cw = carouselWidth > 0 ? carouselWidth : 320;
                          const cardW = Math.floor(cw * 0.7);
                          const peek = (cw - cardW) / 2;
                          // cloned: [마지막클론, 0, 1, ..., n-1, 첫번째클론]
                          const cloned = [assignments[n - 1], ...assignments, assignments[0]];
                          const baseOffset = peek - trackIdx * (cardW + GAP);
                          return (
                            <div
                              ref={trackRef}
                              className="flex"
                              onTransitionEnd={() => onCarouselTransitionEnd(n)}
                              style={{
                                gap: `${GAP}px`,
                                transform: `translateX(${baseOffset + dragOffset}px)`,
                                transition: (isDragging || isJumping) ? "none" : "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                              }}
                            >
                              {cloned.map((assignment, ci) => {
                                const isActive = ci === trackIdx;
                                const slots = assignment.formation_slots ?? [];
                                const result = assignment.result ?? {};
                                const realIdx = ((ci - 1) % n + n) % n;
                                return (
                                  <div
                                    key={`${ci}`}
                                    className="flex-shrink-0"
                                    style={{
                                      width: `${cardW}px`,
                                      opacity: isActive ? 1 : 0.4,
                                      transform: isActive ? "scale(1)" : "scale(0.93)",
                                      transition: isJumping ? "none" : "opacity 0.3s, transform 0.3s",
                                    }}
                                  >
                                    <div className="text-center mb-1.5">
                                      <span className={`text-[10px] font-bold ${isActive ? "text-emerald-400" : "text-gray-600"}`}>
                                        {assignment.session_name || `${realIdx + 1}쿼터`}
                                      </span>
                                    </div>
                                    {/* 축구장 */}
                                    <div className="relative w-full rounded-xl overflow-hidden"
                                      style={{
                                        paddingBottom: "110%",
                                        background: "linear-gradient(180deg, #166534 0%, #14532d 40%, #15803d 60%, #166534 100%)",
                                      }}
                                    >
                                      <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute border border-white/20 inset-[4%] rounded-sm" />
                                        <div className="absolute w-[92%] left-[4%] border-t border-white/20" style={{ top: "50%" }} />
                                        <div className="absolute border border-white/20 rounded-full"
                                          style={{ width: "22%", height: "17%", top: "41.5%", left: "39%" }} />
                                        <div className="absolute w-1.5 h-1.5 bg-white/30 rounded-full"
                                          style={{ top: "calc(50% - 3px)", left: "calc(50% - 3px)" }} />
                                        <div className="absolute border border-white/20"
                                          style={{ width: "46%", height: "14%", top: "4%", left: "27%" }} />
                                        <div className="absolute border border-white/20"
                                          style={{ width: "46%", height: "14%", bottom: "4%", left: "27%" }} />
                                        <div className="absolute border border-white/20"
                                          style={{ width: "24%", height: "6%", top: "4%", left: "38%" }} />
                                        <div className="absolute border border-white/20"
                                          style={{ width: "24%", height: "6%", bottom: "4%", left: "38%" }} />
                                      </div>
                                      {slots.map(slot => {
                                        const member = result[slot.id];
                                        const isGK = slot.id === "GK";
                                        const isMerc = member && mercenaryIds.has(member.id);
                                        const markerStyle = member
                                          ? getSlotStyle(slot.label, member.id, isGK)
                                          : "bg-white/15 border-white/25 text-white/50";
                                        return (
                                          <div key={slot.id}
                                            className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                                            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                                          >
                                            <div className={`w-7 h-7 flex items-center justify-center rounded-full font-black text-[8px] shadow-lg border-2 ${markerStyle} ${isMerc ? "ring-2 ring-white ring-offset-1 ring-offset-transparent" : ""}`}>
                                              {slot.label}
                                            </div>
                                            {member && (
                                              <span className="mt-1.5 text-[8px] font-bold text-white whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                                                {member.name}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* 인디케이터 */}
                  {assignments.length > 1 && (
                    <div className="flex items-center justify-center gap-1.5 pb-4">
                      {assignments.map((_, i) => (
                        <button key={i} onClick={() => changeQuarter(i)}
                          className={`rounded-full transition-all ${activeQuarter === i ? "w-4 h-1.5 bg-emerald-400" : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="px-4 pb-5 text-center">
                  <div className="py-6 flex flex-col items-center gap-2">
                    <span className="text-3xl opacity-30">🏃</span>
                    <p className="text-xs text-gray-600">아직 포지션 배정이 없어요</p>
                    {team?.can_manage && (
                      <button
                        onClick={() => router.push(`/assign?matchId=${upcomingMatch.id}`)}
                        className="mt-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors"
                      >
                        배정하러 가기 →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 최근 경기 피드백 ── */}
        {feedbackLoaded && (
          <div className="bg-gray-900 rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📝</span>
                <p className="text-sm font-bold text-white">최근 경기 피드백</p>
              </div>
              {recentFeedbackMatch && recentFeedback && (
                <button
                  onClick={() => router.push(`/feedback?matchId=${recentFeedbackMatch.id}`)}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  자세히 →
                </button>
              )}
            </div>

            {!recentFeedback || (!recentFeedback.team_feedback?.trim() && !recentFeedback.player_feedbacks?.some(p => p.feedback?.trim())) ? (
              <div className="flex flex-col items-center gap-2 py-5">
                <span className="text-3xl opacity-30">💬</span>
                <p className="text-xs text-gray-600">아직 피드백이 없습니다</p>
                {recentFeedbackMatch && team?.can_manage && (
                  <button
                    onClick={() => router.push(`/feedback?matchId=${recentFeedbackMatch.id}`)}
                    className="mt-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors"
                  >
                    피드백 작성하기 →
                  </button>
                )}
              </div>
            ) : (
              <>
                {recentFeedback.team_feedback && (
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-3 py-2.5 mb-3">
                    <p className="text-[10px] text-emerald-400 font-bold mb-1 uppercase tracking-wider">팀 피드백</p>
                    <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">{recentFeedback.team_feedback}</p>
                  </div>
                )}
                {recentFeedback.player_feedbacks?.filter(p => p.feedback?.trim()).length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {recentFeedback.player_feedbacks.filter(p => p.feedback?.trim()).slice(0, 3).map((p, i) => (
                      <div key={i} className="flex items-start gap-2 bg-white/3 rounded-xl px-3 py-2 border border-white/5">
                        <span className="text-xs font-bold text-white shrink-0 min-w-[48px] truncate">{p.name}</span>
                        <span className="text-[10px] text-gray-400 leading-relaxed line-clamp-1">— {p.feedback}</span>
                      </div>
                    ))}
                    {recentFeedback.player_feedbacks.filter(p => p.feedback?.trim()).length > 3 && (
                      <p className="text-[10px] text-gray-600 text-center pt-1">
                        외 {recentFeedback.player_feedbacks.filter(p => p.feedback?.trim()).length - 3}명 더보기
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>

      {/* ─── 팀원 모달 ─── */}
      {showMembers && team && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setShowMembers(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: "80vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 - 고정 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <h3 className="font-bold text-white text-base">팀원 목록</h3>
              <button
                onClick={() => setShowMembers(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            {/* 목록 */}
            {(() => {
              const totalPages  = Math.ceil(team.members.length / PAGE_SIZE);
              const paged       = team.members.slice(memberPage * PAGE_SIZE, (memberPage + 1) * PAGE_SIZE);
              return (
                <>
                  <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-2">
                    {paged.map((m, idx) => (
                      <div key={m.user_id} className="flex items-center gap-3 bg-white/3 rounded-2xl px-4 py-3 border border-white/5">
                        {/* 번호 */}
                        <span className="text-xs text-gray-700 w-5 shrink-0 text-right">{memberPage * PAGE_SIZE + idx + 1}</span>
                        {m.users?.image ? (
                          <img src={m.users.image} alt="" className="w-9 h-9 rounded-full shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-sm shrink-0">👤</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{m.users?.name ?? "이름 없음"}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLOR[m.role]}`}>
                          {ROLE_LABEL[m.role]}
                        </span>
                        {team.is_owner && m.role !== "owner" && (
                          <div className="flex gap-1 shrink-0">
                            <select
                              value={m.role}
                              onChange={(e) => changeRole(m.user_id, e.target.value as TeamRole)}
                              className="text-xs bg-white/5 border border-white/10 rounded-lg px-1.5 py-1 text-gray-400 focus:outline-none"
                            >
                              <option value="manager">감독</option>
                              <option value="coach">코치</option>
                              <option value="president">회장</option>
                              <option value="treasurer">총무</option>
                              <option value="member">팀원</option>
                            </select>
                            <button
                              onClick={() => kickMember(m.user_id, m.users?.name)}
                              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors"
                            >
                              강퇴
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 페이지네이션 - 고정 */}
                  {totalPages > 1 && (
                    <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-white/5">
                      <button
                        onClick={() => setMemberPage(p => Math.max(0, p - 1))}
                        disabled={memberPage === 0}
                        className="text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        ‹ 이전
                      </button>
                      <span className="text-xs text-gray-500">
                        {memberPage + 1} / {totalPages}
                        <span className="text-gray-700 ml-1">({team.members.length}명)</span>
                      </span>
                      <button
                        onClick={() => setMemberPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={memberPage === totalPages - 1}
                        className="text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        다음 ›
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── 초대 모달 ─── */}
      {showInvite && team && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setShowInvite(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg p-5"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base">팀원 초대</h3>
              <button
                onClick={() => setShowInvite(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">초대 링크를 공유하면 팀에 합류할 수 있어요</p>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-white/5 rounded-xl px-3 py-2.5 text-xs text-gray-400 font-mono truncate border border-white/5">
                {`${typeof window !== "undefined" ? window.location.origin : ""}/join?code=${team.invite_code}`}
              </div>
              <button
                onClick={copyInviteLink}
                className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  copied ? "bg-emerald-500 text-black" : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400"
                }`}
              >
                {copied ? "✓ 복사됨" : "복사"}
              </button>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">초대 코드</span>
              <span className="font-mono font-bold text-gray-300 text-sm tracking-widest">{team.invite_code}</span>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}
