"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Trophy, Plus, Trash2, Users, Medal, Zap, Calendar, X } from "lucide-react";
import AppLayout from "@/components/AppLayout";

interface Member {
  id: string;
  name: string;
  is_mercenary?: boolean;
}

interface LeagueSquad {
  id: string;
  name: string;
  color: string | null;
  captain_member_id: string | null;
  sort_order: number;
}

interface LeagueData {
  id: string;
  title: string;
  sport: "soccer" | "futsal";
  squad_count: number;
}

interface Round {
  id: string;
  title: string | null;
  match_date: string | null;
  league_round: number | null;
}

interface Standing {
  squad_id: string;
  name: string;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

interface LeaderboardEntry {
  member_id: string;
  name: string;
  goals: number;
  assists: number;
}

const SPORT_LABEL: Record<string, string> = { soccer: "축구", futsal: "풋살" };

export default function ScrimmageLeagueDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [league, setLeague] = useState<LeagueData | null>(null);
  const [squads, setSquads] = useState<LeagueSquad[]>([]);
  const [squadMemberMap, setSquadMemberMap] = useState<Record<string, string>>({});
  const [roster, setRoster] = useState<Member[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [addedMemberIds, setAddedMemberIds] = useState<Set<string>>(new Set());
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [creatingRound, setCreatingRound] = useState(false);
  const [showRoundModal, setShowRoundModal] = useState(false);
  const [roundDate, setRoundDate] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") {
      fetchDetail();
      fetchRole();
    }
  }, [status, id]);

  async function fetchRole() {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    setCanManage(data.role === "owner" || data.role === "manager" || data.role === "president");
  }

  async function fetchDetail() {
    setLoading(true);
    const res = await fetch(`/api/scrimmage-leagues/${id}`);
    if (!res.ok) { setLoading(false); setNotFound(true); return; }
    const data = await res.json();
    setLeague(data.league);
    setSquads(data.squads ?? []);
    const map: Record<string, string> = {};
    for (const sm of data.squad_members ?? []) map[sm.member_id] = sm.squad_id;
    setSquadMemberMap(map);
    setRoster(data.roster ?? []);
    setRounds(data.rounds ?? []);
    setStandings(data.standings ?? []);
    setLeaderboard(data.leaderboard ?? []);
    setLoading(false);
  }

  async function assignMember(memberId: string, squadId: string | null) {
    setSquadMemberMap(prev => {
      const next = { ...prev };
      if (squadId) next[memberId] = squadId;
      else delete next[memberId];
      return next;
    });
    await fetch(`/api/scrimmage-leagues/${id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, squad_id: squadId }),
    });
  }

  async function setCaptain(squadId: string, memberId: string | null) {
    const captain = memberId ? teamSplitRoster.find(m => m.id === memberId) : null;
    setSquads(prev => prev.map(s => (s.id === squadId ? { ...s, captain_member_id: memberId, name: captain ? `${captain.name}팀` : s.name } : s)));
    await fetch(`/api/scrimmage-leagues/${id}/squads/${squadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(captain ? { captain_member_id: memberId, name: `${captain.name}팀` } : { captain_member_id: null }),
    });
  }

  async function createRound() {
    setCreatingRound(true);
    const res = await fetch(`/api/scrimmage-leagues/${id}/rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_date: roundDate || null }),
    });
    setCreatingRound(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/scrimmage/${data.id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "회차 생성 실패");
    }
  }

  async function deleteLeague() {
    if (!confirm("이 리그를 삭제할까요? 모든 회차 기록도 함께 삭제돼요.")) return;
    const res = await fetch(`/api/scrimmage-leagues/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/scrimmage");
  }

  const teamSplitRoster = roster.filter(m => addedMemberIds.has(m.id) || squadMemberMap[m.id]);
  const availableToAdd = roster.filter(m => !addedMemberIds.has(m.id) && !squadMemberMap[m.id]);
  const unassigned = teamSplitRoster.filter(m => !squadMemberMap[m.id]);

  function addMember(memberId: string) {
    setAddedMemberIds(prev => new Set(prev).add(memberId));
    setShowAddPicker(false);
  }

  function removeMember(memberId: string) {
    setAddedMemberIds(prev => {
      const next = new Set(prev);
      next.delete(memberId);
      return next;
    });
    if (squadMemberMap[memberId]) assignMember(memberId, null);
  }

  const formatDate = (d: string | null) =>
    d ? new Date(d.replace(/-/g, "/")).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" }) : "날짜 미정";

  if (notFound) {
    return (
      <AppLayout title="리그 내전">
        <div className="text-center py-24">
          <Trophy size={40} strokeWidth={1.5} className="opacity-30 mx-auto mb-3" />
          <p className="text-gray-600">이 리그를 찾을 수 없어요</p>
        </div>
      </AppLayout>
    );
  }

  if (loading || !league) {
    return (
      <AppLayout title="리그 내전">
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={league.title}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">{SPORT_LABEL[league.sport]} · {squads.length}팀 · {rounds.length}회차 진행</p>
          {canManage && (
            <button onClick={deleteLeague} className="text-gray-600 hover:text-red-400 p-2 rounded-xl transition-colors">
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* 통산 순위표 */}
        {rounds.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Trophy size={13} className="text-gray-500" />
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">통산 순위</p>
            </div>
            <div className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-600 border-b border-white/5">
                    <th className="text-left font-normal px-3 py-2">팀</th>
                    <th className="font-normal px-1.5 py-2">승</th>
                    <th className="font-normal px-1.5 py-2">무</th>
                    <th className="font-normal px-1.5 py-2">패</th>
                    <th className="font-normal px-1.5 py-2">득실</th>
                    <th className="font-normal px-2 py-2">승점</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr key={s.squad_id} className={i < standings.length - 1 ? "border-b border-white/[0.03]" : ""}>
                      <td className="px-3 py-2 text-gray-200 font-medium">{s.name}</td>
                      <td className="text-center px-1.5 py-2 text-gray-400">{s.w}</td>
                      <td className="text-center px-1.5 py-2 text-gray-400">{s.d}</td>
                      <td className="text-center px-1.5 py-2 text-gray-400">{s.l}</td>
                      <td className="text-center px-1.5 py-2 text-gray-400">{s.gf - s.ga > 0 ? `+${s.gf - s.ga}` : s.gf - s.ga}</td>
                      <td className="text-center px-2 py-2 text-emerald-400 font-bold">{s.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 득점왕/어시왕 */}
        {leaderboard.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Medal size={13} className="text-gray-500" />
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">득점왕 · 어시왕</p>
            </div>
            <div className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
              {leaderboard.map((p, i) => (
                <div key={p.member_id} className={`flex items-center gap-3 px-4 py-3 ${i < leaderboard.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                  <span className={`w-5 text-sm font-bold text-center ${i < 3 ? "text-amber-400" : "text-gray-600"}`}>{i + 1}</span>
                  <span className="flex-1 text-sm text-gray-200 truncate">{p.name}</span>
                  <span className="text-xs text-emerald-400 font-bold w-14 text-right">{p.goals}골</span>
                  <span className="text-xs text-sky-400 font-bold w-14 text-right">{p.assists}도움</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 회차 목록 */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-gray-500" />
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">회차</p>
            </div>
            {canManage && (
              <button
                onClick={() => { setRoundDate(""); setShowRoundModal(true); }}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-bold"
              >
                <Plus size={13} /> 회차 만들기
              </button>
            )}
          </div>
          {rounds.length === 0 ? (
            <p className="text-center text-xs text-gray-600 py-8 bg-gray-900 border border-white/5 rounded-lg">아직 진행된 회차가 없어요</p>
          ) : (
            <div className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
              {rounds.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => router.push(`/scrimmage/${r.id}`)}
                  className={`w-full text-left flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors ${i < rounds.length - 1 ? "border-b border-white/[0.03]" : ""}`}
                >
                  <span className="text-sm text-gray-200">{r.league_round}회차</span>
                  <span className="text-xs text-gray-500">{formatDate(r.match_date)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 고정 팀 배정 */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Users size={13} className="text-gray-500" />
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">고정 팀 배정</p>
          </div>
          {teamSplitRoster.length === 0 ? (
            <div className="text-center py-10 bg-gray-900 border border-white/5 rounded-lg text-sm text-gray-600">
              아래에서 참가 인원을 추가해주세요
            </div>
          ) : (
            <div className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
              {teamSplitRoster.map((m, i) => (
                <div key={m.id} className={`flex items-center justify-between px-4 py-3 ${i < teamSplitRoster.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                  <span className="text-sm text-gray-200 truncate flex items-center gap-1.5">
                    {m.name}
                    {m.is_mercenary && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                        <Zap size={9} /> 용병
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {squads.map(s => (
                      <button
                        key={s.id}
                        disabled={!canManage}
                        onClick={() => assignMember(m.id, squadMemberMap[m.id] === s.id ? null : s.id)}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                          squadMemberMap[m.id] === s.id ? "bg-emerald-500 text-black" : "bg-white/5 text-gray-500 hover:bg-white/10"
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                    {canManage && (
                      <button onClick={() => removeMember(m.id)} className="text-gray-700 hover:text-red-400 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {canManage && (
            <div className="relative mt-2">
              <button onClick={() => setShowAddPicker(v => !v)} className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold px-1 py-1">
                <Plus size={13} /> 인원 추가
              </button>
              {showAddPicker && (
                <div className="absolute z-10 mt-1 left-0 bg-gray-900 border border-white/10 rounded-xl p-2 shadow-xl min-w-[180px] max-h-64 overflow-y-auto">
                  {availableToAdd.length === 0 ? (
                    <p className="text-xs text-gray-600 px-2 py-1.5">추가할 인원이 없어요</p>
                  ) : (
                    availableToAdd.map(m => (
                      <button key={m.id} onClick={() => addMember(m.id)} className="w-full text-left text-sm text-gray-200 hover:bg-white/5 px-2 py-1.5 rounded-lg flex items-center gap-1.5">
                        {m.name}
                        {m.is_mercenary && <Zap size={10} className="text-amber-400 shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {unassigned.length > 0 && <p className="text-[11px] text-gray-600 mt-2">미배정 {unassigned.length}명</p>}
        </div>

        {/* 팀별 주장 */}
        {canManage && (
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2.5">팀별 주장</p>
            <div className="space-y-2">
              {squads.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0">{s.name}</span>
                  <select
                    value={s.captain_member_id ?? ""}
                    onChange={e => setCaptain(s.id, e.target.value || null)}
                    className="flex-1 bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="">주장 선택</option>
                    {teamSplitRoster.filter(m => squadMemberMap[m.id] === s.id).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showRoundModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowRoundModal(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-4">회차 만들기</h2>
            <label className="text-xs text-gray-500 mb-1 block">날짜</label>
            <input
              type="date"
              value={roundDate}
              onChange={e => setRoundDate(e.target.value)}
              className="w-full bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none mb-4"
            />
            <p className="text-xs text-gray-600 mb-4">현재 고정 팀 배정을 그대로 복사해서 새 회차를 만들어요. 결석자는 회차 화면에서 배정을 해제하면 돼요.</p>
            <button
              onClick={createRound}
              disabled={creatingRound}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black py-3 rounded-xl font-bold transition-colors"
            >
              {creatingRound ? "만드는 중..." : "만들기"}
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
