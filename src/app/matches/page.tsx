"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value ? value.split(":") : ["", ""];
  function update(newH: string, newM: string) {
    if (!newH && !newM) { onChange(""); return; }
    onChange(`${newH.padStart(2, "0")}:${(newM || "00").padStart(2, "0")}`);
  }
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = ["00", "10", "20", "30", "40", "50"];
  const sel = "bg-gray-800 border border-white/10 text-white rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  return (
    <div className="flex items-center gap-1">
      <select value={h || ""} onChange={e => update(e.target.value, m || "00")} className={`flex-1 ${sel}`}>
        <option value="">시</option>
        {hours.map(hh => <option key={hh} value={hh}>{hh}시</option>)}
      </select>
      <span className="text-gray-600 text-sm">:</span>
      <select value={m || ""} onChange={e => update(h || "00", e.target.value)} className={`flex-1 ${sel}`}>
        <option value="">분</option>
        {minutes.map(mm => <option key={mm} value={mm}>{mm}분</option>)}
      </select>
    </div>
  );
}

interface Match {
  id: string;
  match_date: string;
  match_time: string | null;
  match_end_time: string | null;
  location: string | null;
  title: string | null;
  uniform_info?: string | null;
  position_assignments: { id: string; session_name: string; created_at: string }[];
}

interface StatEntry {
  member_id: string;
  name: string;
  goals: number;
  assists: number;
}

interface StatsModal {
  matchId: string;
  matchTitle: string;
}

const inputCls = "w-full bg-gray-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600";

export default function MatchesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [matchEndTime, setMatchEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [uniformInfo, setUniformInfo] = useState("");
  const [opponent, setOpponent] = useState("");
  const [teamName, setTeamName] = useState("");
  const [isScrimmage, setIsScrimmage] = useState(false);
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [statsModal, setStatsModal] = useState<StatsModal | null>(null);
  const [statsEntries, setStatsEntries] = useState<StatEntry[]>([]);
  const [statsSaving, setStatsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editOpponent, setEditOpponent] = useState("");
  const [editIsScrimmage, setEditIsScrimmage] = useState(false);
  const [editTeamA, setEditTeamA] = useState("");
  const [editTeamB, setEditTeamB] = useState("");
  const [editUniformInfo, setEditUniformInfo] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") { fetchMatches(); fetchTeamName(); fetchUserRole(); }
  }, [status]);

  async function fetchTeamName() {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    setTeamName(data.team_name || "우리팀");
  }
  async function fetchUserRole() {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    setUserRole(data.role ?? null);
  }
  const canManage    = userRole === "owner" || userRole === "manager" || userRole === "coach" || userRole === "president";
  // 골/어시 기록 입력 권한: 팀장(owner), 부팀장(manager), 회장(president)
  const canInputStats = userRole === "owner" || userRole === "manager" || userRole === "president";

  async function fetchMatches() {
    const res = await fetch("/api/matches");
    const data = await res.json();
    setMatches(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function createMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    let title: string | null = null;
    if (isScrimmage) title = teamA && teamB ? `${teamA} vs ${teamB}` : teamA || teamB || "자체전";
    else title = opponent ? `${teamName} vs ${opponent}` : null;
    const res = await fetch("/api/matches", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_date: date, match_time: matchTime || null, match_end_time: matchEndTime || null, location: location || null, title, uniform_info: uniformInfo || null }),
    });
    if (res.ok) {
      setShowForm(false);
      setDate(""); setMatchTime(""); setMatchEndTime(""); setLocation(""); setUniformInfo("");
      setOpponent(""); setTeamA(""); setTeamB(""); setIsScrimmage(false);
      fetchMatches();
    }
  }

  function startEdit(match: Match) {
    setEditingId(match.id); setEditDate(match.match_date); setEditTime(match.match_time ?? "");
    setEditEndTime(match.match_end_time ?? ""); setEditLocation(match.location ?? "");
    setEditUniformInfo(match.uniform_info ?? "");
    const title = match.title ?? "";
    const parts = title.split(" vs ");
    if (parts.length === 2 && parts[0] === teamName) { setEditIsScrimmage(false); setEditOpponent(parts[1]); setEditTeamA(""); setEditTeamB(""); }
    else if (parts.length === 2) { setEditIsScrimmage(true); setEditTeamA(parts[0]); setEditTeamB(parts[1]); setEditOpponent(""); }
    else { setEditIsScrimmage(false); setEditOpponent(""); setEditTeamA(""); setEditTeamB(""); }
  }

  async function saveEdit(id: string) {
    let title: string | null = null;
    if (editIsScrimmage) title = editTeamA && editTeamB ? `${editTeamA} vs ${editTeamB}` : editTeamA || editTeamB || "자체전";
    else title = editOpponent ? `${teamName} vs ${editOpponent}` : null;
    await fetch(`/api/matches/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_date: editDate, match_time: editTime || null, match_end_time: editEndTime || null, location: editLocation || null, title, uniform_info: editUniformInfo || null }),
    });
    setEditingId(null); fetchMatches();
  }

  async function openStatsModal(match: Match) {
    // 해당 경기 참가자 불러오기
    const [attendRes, statsRes] = await Promise.all([
      fetch(`/api/matches/attendees?matchId=${match.id}`),
      fetch(`/api/match-stats?matchId=${match.id}`),
    ]);
    const { member_ids } = await attendRes.json();
    const savedStats: { member_id: string; goals: number; assists: number }[] = await statsRes.json();

    // 전체 멤버 불러오기
    const membersRes = await fetch("/api/members");
    const allMembers: { id: string; name: string; is_mercenary: boolean }[] = await membersRes.json();

    // 참가자 중 멤버 목록 구성
    const attendingIds: Set<string> = new Set(Array.isArray(member_ids) ? member_ids : []);
    const attending = allMembers.filter(m => attendingIds.has(m.id));

    // 기존 저장 기록 매핑
    const savedMap: Record<string, { goals: number; assists: number }> = {};
    (Array.isArray(savedStats) ? savedStats : []).forEach(s => {
      savedMap[s.member_id] = { goals: s.goals, assists: s.assists };
    });

    const entries: StatEntry[] = attending.map(m => ({
      member_id: m.id,
      name: m.name,
      goals: savedMap[m.id]?.goals ?? 0,
      assists: savedMap[m.id]?.assists ?? 0,
    }));

    setStatsEntries(entries);
    setStatsModal({
      matchId: match.id,
      matchTitle: match.title ?? formatDate(match.match_date),
    });
  }

  async function saveStats() {
    if (!statsModal) return;
    setStatsSaving(true);
    await fetch("/api/match-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: statsModal.matchId, stats: statsEntries }),
    });
    setStatsSaving(false);
    setStatsModal(null);
  }

  function updateStat(memberId: string, field: "goals" | "assists", delta: number) {
    setStatsEntries(prev => prev.map(e =>
      e.member_id === memberId
        ? { ...e, [field]: Math.max(0, e[field] + delta) }
        : e
    ));
  }

  async function deleteMatch(id: string) {
    if (!confirm("경기를 삭제할까요? 저장된 쿼터 배정도 모두 삭제됩니다.")) return;
    await fetch(`/api/matches/${id}`, { method: "DELETE" });
    fetchMatches();
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  }
  function formatTime(time: string) {
    const [h, m] = time.split(":").map(Number);
    return `${h}시${m > 0 ? ` ${m}분` : ""}`;
  }

  const Toggle = ({ on, onToggle, label, sub }: { on: boolean; onToggle: () => void; label: string; sub: string }) => (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${on ? "border-blue-500/40 bg-blue-500/10" : "border-white/10 bg-white/3"}`} onClick={onToggle}>
      <div>
        <p className={`font-medium text-sm ${on ? "text-blue-400" : "text-gray-400"}`}>{label}</p>
        <p className="text-xs text-gray-600">{sub}</p>
      </div>
      <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${on ? "bg-blue-500" : "bg-gray-700"}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </div>
    </div>
  );

  return (
    <AppLayout title="경기 관리">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <p className="text-xs text-gray-600 uppercase tracking-widest">경기 {matches.length}개</p>
          {canManage && (
            <button onClick={() => setShowForm(true)} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors">
              + 경기 추가
            </button>
          )}
        </div>

        {/* 추가 폼 */}
        {showForm && (
          <form onSubmit={createMatch} className="bg-gray-900 border border-white/10 rounded-2xl p-5 mb-5">
            <h2 className="font-bold text-white mb-4">경기 추가</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">경기 날짜 *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">시작 시간</label><TimePicker value={matchTime} onChange={setMatchTime} /></div>
                <div className="pb-2 text-gray-600 text-sm">~</div>
                <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">종료 시간</label><TimePicker value={matchEndTime} onChange={setMatchEndTime} /></div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">경기 장소</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="예: 수원 황구지천구장" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">복장 정보</label>
                <input type="text" value={uniformInfo} onChange={e => setUniformInfo(e.target.value)} placeholder="예: 검빨하계 or 팀조끼" className={inputCls} />
                <p className="text-xs text-gray-600 mt-1">참가 인원 공유 시 자동 포함돼요</p>
              </div>
              <Toggle on={isScrimmage} onToggle={() => setIsScrimmage(!isScrimmage)} label="자체전" sub="우리끼리 팀 나눠서 하는 경기" />
              {!isScrimmage ? (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">상대팀 이름 (선택)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-emerald-400 whitespace-nowrap">{teamName}</span>
                    <span className="text-gray-600 text-sm">vs</span>
                    <input type="text" value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="상대팀 이름" className={`flex-1 bg-gray-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600`} />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">팀 이름 직접 입력</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={teamA} onChange={e => setTeamA(e.target.value)} placeholder="A팀" className={`flex-1 bg-gray-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-600`} />
                    <span className="text-gray-600 font-bold">vs</span>
                    <input type="text" value={teamB} onChange={e => setTeamB(e.target.value)} placeholder="B팀" className={`flex-1 bg-gray-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-600`} />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-2.5 rounded-xl font-bold">추가</button>
                <button type="button" onClick={() => { setShowForm(false); setIsScrimmage(false); setTeamA(""); setTeamB(""); setMatchTime(""); setMatchEndTime(""); setLocation(""); setUniformInfo(""); }}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2.5 rounded-xl font-semibold">취소</button>
              </div>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : matches.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3 opacity-30">📅</div>
            <p className="text-gray-600">아직 경기가 없어요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {matches.map(match => (
              <div key={match.id} className="bg-gray-900 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors">
                {editingId === match.id ? (
                  <div className="flex flex-col gap-3">
                    <p className="font-bold text-white text-sm">경기 수정</p>
                    <div><label className="text-xs text-gray-500 mb-1 block">경기 날짜</label><input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className={inputCls} /></div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">시작</label><TimePicker value={editTime} onChange={setEditTime} /></div>
                      <div className="pb-2 text-gray-600 text-sm">~</div>
                      <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">종료</label><TimePicker value={editEndTime} onChange={setEditEndTime} /></div>
                    </div>
                    <div><label className="text-xs text-gray-500 mb-1 block">경기 장소</label><input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="예: 수원 황구지천구장" className={inputCls} /></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">복장 정보</label><input type="text" value={editUniformInfo} onChange={e => setEditUniformInfo(e.target.value)} placeholder="예: 검빨하계" className={inputCls} /></div>
                    <Toggle on={editIsScrimmage} onToggle={() => setEditIsScrimmage(!editIsScrimmage)} label="자체전" sub="우리끼리 팀 나눠서 하는 경기" />
                    {!editIsScrimmage ? (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">상대팀 이름</label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-emerald-400 whitespace-nowrap">{teamName}</span>
                          <span className="text-gray-600 text-sm">vs</span>
                          <input type="text" value={editOpponent} onChange={e => setEditOpponent(e.target.value)} placeholder="상대팀 이름" className={`flex-1 bg-gray-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600`} />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">팀 이름</label>
                        <div className="flex items-center gap-2">
                          <input type="text" value={editTeamA} onChange={e => setEditTeamA(e.target.value)} placeholder="A팀" className={`flex-1 bg-gray-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-600`} />
                          <span className="text-gray-600 font-bold">vs</span>
                          <input type="text" value={editTeamB} onChange={e => setEditTeamB(e.target.value)} placeholder="B팀" className={`flex-1 bg-gray-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-600`} />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(match.id)} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-2 rounded-xl text-sm font-bold">저장</button>
                      <button onClick={() => setEditingId(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2 rounded-xl text-sm font-semibold">취소</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-white">{formatDate(match.match_date)}</p>
                        {match.match_time && (
                          <p className="text-sm text-emerald-400 font-medium mt-0.5">
                            {formatTime(match.match_time)}{match.match_end_time && ` ~ ${formatTime(match.match_end_time)}`}
                          </p>
                        )}
                        {match.title && <p className="text-sm text-gray-400 mt-0.5">{match.title}</p>}
                        {match.location && <p className="text-xs text-gray-600 mt-0.5">📍 {match.location}</p>}
                      </div>
                      {/* 기록 버튼 — 우측 상단 */}
                      {canInputStats && (
                        <button
                          onClick={() => openStatsModal(match)}
                          className="shrink-0 flex items-center gap-1 bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-white/10 text-gray-400 hover:text-emerald-400 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors"
                        >
                          ⚽ 기록
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                      {match.position_assignments?.length > 0 ? (
                        [...match.position_assignments]
                          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                          .map(a => canManage ? (
                            <span key={a.id} className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">{a.session_name}</span>
                          ) : (
                            <button key={a.id} onClick={() => router.push(`/share/${a.id}`)}
                              className="text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 font-semibold px-2.5 py-1 rounded-full transition-colors">
                              {a.session_name} 보기 →
                            </button>
                          ))
                      ) : (
                        <span className="text-xs text-gray-700">저장된 쿼터 없음</span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {canManage && (
                        <button onClick={() => router.push(`/assign?matchId=${match.id}`)}
                          className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold text-sm py-2 rounded-xl transition-colors">
                          배정하기 →
                        </button>
                      )}
                      <button onClick={() => router.push(`/feedback?matchId=${match.id}`)}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 font-semibold text-sm py-2 rounded-xl transition-colors">
                        피드백
                      </button>
                      {canManage && (
                        <button onClick={() => startEdit(match)} className="px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors font-medium">수정</button>
                      )}
                      {canManage && (
                        <button onClick={() => deleteMatch(match.id)} className="px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors font-medium">삭제</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ⚽ 골/어시 기록 모달 */}
      {statsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={() => setStatsModal(null)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-white text-base">⚽ 골/어시 기록</h3>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{statsModal.matchTitle}</p>
              </div>
              <button onClick={() => setStatsModal(null)} className="text-gray-500 hover:text-white text-xl font-bold">✕</button>
            </div>

            {statsEntries.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="text-3xl mb-2 opacity-30">👥</div>
                <p className="text-sm text-gray-600">참가 인원을 먼저 설정해주세요</p>
                <p className="text-xs text-gray-700 mt-1">배정 페이지에서 참가자를 선택하면 여기에 표시돼요</p>
              </div>
            ) : (
              <>
                <div className="overflow-y-auto flex-1">
                  {/* 헤더 */}
                  <div className="flex items-center px-5 py-2 border-b border-white/5">
                    <span className="flex-1 text-xs text-gray-600 font-semibold">선수</span>
                    <span className="w-24 text-center text-xs text-emerald-400 font-semibold">🥅 골</span>
                    <span className="w-24 text-center text-xs text-blue-400 font-semibold">🎯 어시</span>
                  </div>
                  {statsEntries.map(entry => (
                    <div key={entry.member_id} className="flex items-center px-5 py-2.5 border-b border-white/5 last:border-0">
                      <span className="flex-1 text-sm font-medium text-white truncate">{entry.name}</span>
                      {/* 골 카운터 */}
                      <div className="w-24 flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => updateStat(entry.member_id, "goals", -1)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-sm flex items-center justify-center transition-colors"
                        >−</button>
                        <span className={`text-sm font-black w-5 text-center ${entry.goals > 0 ? "text-emerald-400" : "text-gray-700"}`}>
                          {entry.goals}
                        </span>
                        <button
                          onClick={() => updateStat(entry.member_id, "goals", 1)}
                          className="w-7 h-7 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold text-sm flex items-center justify-center transition-colors"
                        >+</button>
                      </div>
                      {/* 어시 카운터 */}
                      <div className="w-24 flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => updateStat(entry.member_id, "assists", -1)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-sm flex items-center justify-center transition-colors"
                        >−</button>
                        <span className={`text-sm font-black w-5 text-center ${entry.assists > 0 ? "text-blue-400" : "text-gray-700"}`}>
                          {entry.assists}
                        </span>
                        <button
                          onClick={() => updateStat(entry.member_id, "assists", 1)}
                          className="w-7 h-7 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold text-sm flex items-center justify-center transition-colors"
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-5 py-4 border-t border-white/5 shrink-0">
                  <button
                    onClick={saveStats}
                    disabled={statsSaving}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-colors"
                  >
                    {statsSaving ? "저장 중..." : "기록 저장"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
