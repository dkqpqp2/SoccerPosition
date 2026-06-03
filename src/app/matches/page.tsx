"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Match {
  id: string;
  match_date: string;
  title: string | null;
  position_assignments: { id: string; session_name: string; created_at: string }[];
}

export default function MatchesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [teamName, setTeamName] = useState("");
  const [isScrimmage, setIsScrimmage] = useState(false);
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") {
      fetchMatches();
      fetchTeamName();
    }
  }, [status]);

  async function fetchTeamName() {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    setTeamName(data.team_name || "우리팀");
  }

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
    if (isScrimmage) {
      title = teamA && teamB ? `${teamA} vs ${teamB}` : teamA || teamB || "자체전";
    } else {
      title = opponent ? `${teamName} vs ${opponent}` : null;
    }
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_date: date, title }),
    });
    if (res.ok) {
      setShowForm(false);
      setDate("");
      setOpponent("");
      setTeamA("");
      setTeamB("");
      setIsScrimmage(false);
      fetchMatches();
    }
  }

  async function deleteMatch(id: string) {
    if (!confirm("경기를 삭제할까요? 저장된 쿼터 배정도 모두 삭제됩니다.")) return;
    await fetch(`/api/matches/${id}`, { method: "DELETE" });
    fetchMatches();
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} className="hover:text-green-200">← 뒤로</button>
        <div className="flex items-center gap-2">
          <span className="text-xl">📅</span>
          <h1 className="text-lg font-bold">경기 관리</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-gray-500">경기 {matches.length}개</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition-colors"
          >
            + 경기 추가
          </button>
        </div>

        {showForm && (
          <form onSubmit={createMatch} className="bg-white rounded-2xl shadow p-5 mb-6">
            <h2 className="font-bold text-gray-800 mb-4">경기 추가</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">경기 날짜 *</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              {/* 자체전 토글 */}
              <div
                className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${isScrimmage ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"}`}
                onClick={() => setIsScrimmage(!isScrimmage)}
              >
                <div>
                  <p className={`font-medium text-sm ${isScrimmage ? "text-blue-600" : "text-gray-600"}`}>자체전</p>
                  <p className="text-xs text-gray-400">우리끼리 팀 나눠서 하는 경기</p>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${isScrimmage ? "bg-blue-400" : "bg-gray-300"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isScrimmage ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
              </div>

              {/* 일반 경기 */}
              {!isScrimmage && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">상대팀 이름 (선택)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-green-700 whitespace-nowrap">{teamName}</span>
                    <span className="text-gray-400 text-sm">vs</span>
                    <input
                      type="text"
                      value={opponent}
                      onChange={e => setOpponent(e.target.value)}
                      placeholder="상대팀 이름"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  {opponent && (
                    <p className="text-xs text-gray-400 mt-1">저장 시: <b>{teamName} vs {opponent}</b></p>
                  )}
                </div>
              )}

              {/* 자체전 팀 이름 */}
              {isScrimmage && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">팀 이름 직접 입력</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={teamA}
                      onChange={e => setTeamA(e.target.value)}
                      placeholder="A팀 대표 이름"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <span className="text-gray-400 font-bold">vs</span>
                    <input
                      type="text"
                      value={teamB}
                      onChange={e => setTeamB(e.target.value)}
                      placeholder="B팀 대표 이름"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  {(teamA || teamB) && (
                    <p className="text-xs text-gray-400 mt-1">저장 시: <b>{teamA || "A팀"} vs {teamB || "B팀"}</b></p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-medium">추가</button>
                <button type="button" onClick={() => { setShowForm(false); setIsScrimmage(false); setTeamA(""); setTeamB(""); }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-xl font-medium">취소</button>
              </div>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-center text-gray-400 py-10">로딩 중...</p>
        ) : matches.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📅</div>
            <p>아직 경기가 없어요</p>
            <p className="text-sm mt-1">경기를 추가해보세요!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {matches.map(match => (
              <div
                key={match.id}
                className="bg-white rounded-2xl shadow p-5 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/assign?matchId=${match.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-800 text-lg">{formatDate(match.match_date)}</p>
                    {match.title && <p className="text-sm text-gray-500 mt-0.5">{match.title}</p>}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {match.position_assignments?.length > 0 ? (
                        [...match.position_assignments]
                          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                          .map(a => (
                            <span key={a.id} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{a.session_name}</span>
                          ))
                      ) : (
                        <span className="text-xs text-gray-300">저장된 쿼터 없음</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 font-medium">배정하기 →</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteMatch(match.id); }}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
