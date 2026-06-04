"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// 24시간제 시간 선택기
function TimePicker({ value, onChange, placeholder = "시간 선택" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [h, m] = value ? value.split(":") : ["", ""];

  function update(newH: string, newM: string) {
    if (!newH && !newM) { onChange(""); return; }
    onChange(`${newH.padStart(2, "0")}:${(newM || "00").padStart(2, "0")}`);
  }

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = ["00", "10", "20", "30", "40", "50"];

  const sel = "border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white";

  return (
    <div className="flex items-center gap-1">
      <select value={h || ""} onChange={e => update(e.target.value, m || "00")} className={`flex-1 ${sel}`}>
        <option value="">시</option>
        {hours.map(hh => <option key={hh} value={hh}>{hh}시</option>)}
      </select>
      <span className="text-gray-400 text-sm">:</span>
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
  position_assignments: { id: string; session_name: string; created_at: string }[];
}

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
  const [opponent, setOpponent] = useState("");
  const [teamName, setTeamName] = useState("");
  const [isScrimmage, setIsScrimmage] = useState(false);
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") { fetchMatches(); fetchTeamName(); }
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
      body: JSON.stringify({ match_date: date, match_time: matchTime || null, match_end_time: matchEndTime || null, location: location || null, title }),
    });
    if (res.ok) {
      setShowForm(false);
      setDate(""); setMatchTime(""); setMatchEndTime(""); setLocation("");
      setOpponent(""); setTeamA(""); setTeamB(""); setIsScrimmage(false);
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

  function formatTime(time: string) {
    const [h, m] = time.split(":").map(Number);
    return `${h}시${m > 0 ? ` ${m}분` : ""}`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white px-4 py-3 flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} className="hover:text-green-200">← 뒤로</button>
        <div className="flex items-center gap-2">
          <span className="text-xl">📅</span>
          <h1 className="text-lg font-bold">경기 관리</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">경기 {matches.length}개</p>
          <button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition-colors">
            + 경기 추가
          </button>
        </div>

        {showForm && (
          <form onSubmit={createMatch} className="bg-white rounded-2xl shadow p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-4">경기 추가</h2>
            <div className="flex flex-col gap-3">

              {/* 날짜 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">경기 날짜 *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" required />
              </div>

              {/* 시작 시간 + 종료 시간 */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">시작 시간</label>
                  <TimePicker value={matchTime} onChange={setMatchTime} />
                </div>
                <div className="pb-2 text-gray-400 text-sm">~</div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">종료 시간</label>
                  <TimePicker value={matchEndTime} onChange={setMatchEndTime} />
                </div>
              </div>

              {/* 장소 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">경기 장소</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                  placeholder="예: 수원 황구지천구장"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              {/* 자체전 토글 */}
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${isScrimmage ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"}`}
                onClick={() => setIsScrimmage(!isScrimmage)}>
                <div>
                  <p className={`font-medium text-sm ${isScrimmage ? "text-blue-600" : "text-gray-600"}`}>자체전</p>
                  <p className="text-xs text-gray-400">우리끼리 팀 나눠서 하는 경기</p>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${isScrimmage ? "bg-blue-400" : "bg-gray-300"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isScrimmage ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
              </div>

              {!isScrimmage && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">상대팀 이름 (선택)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-green-700 whitespace-nowrap">{teamName}</span>
                    <span className="text-gray-400 text-sm">vs</span>
                    <input type="text" value={opponent} onChange={e => setOpponent(e.target.value)}
                      placeholder="상대팀 이름"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>
              )}

              {isScrimmage && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">팀 이름 직접 입력</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={teamA} onChange={e => setTeamA(e.target.value)} placeholder="A팀"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <span className="text-gray-400 font-bold">vs</span>
                    <input type="text" value={teamB} onChange={e => setTeamB(e.target.value)} placeholder="B팀"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-medium">추가</button>
                <button type="button" onClick={() => { setShowForm(false); setIsScrimmage(false); setTeamA(""); setTeamB(""); setMatchTime(""); setMatchEndTime(""); setLocation(""); }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-xl font-medium">취소</button>
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
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {matches.map(match => (
              <div key={match.id} className="bg-white rounded-2xl shadow p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-800">{formatDate(match.match_date)}</p>
                    {match.match_time && (
                      <p className="text-sm text-green-600 font-medium">
                        {formatTime(match.match_time)}
                        {match.match_end_time && ` ~ ${formatTime(match.match_end_time)}`}
                      </p>
                    )}
                    {match.title && <p className="text-sm text-gray-500 mt-0.5">{match.title}</p>}
                    {match.location && <p className="text-xs text-gray-400 mt-0.5">📍 {match.location}</p>}
                  </div>
                </div>
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
                <div className="flex gap-2 mt-3">
                  <button onClick={() => router.push(`/assign?matchId=${match.id}`)}
                    className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 font-semibold text-sm py-2 rounded-xl transition-colors">
                    배정하기 →
                  </button>
                  <button onClick={() => deleteMatch(match.id)}
                    className="px-4 py-2 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium">
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
