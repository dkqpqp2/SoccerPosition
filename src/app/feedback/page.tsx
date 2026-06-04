"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

interface Match {
  id: string;
  match_date: string;
  match_time: string | null;
  match_end_time: string | null;
  title: string | null;
  location: string | null;
}

interface MatchSummary {
  id: string;
  match_date: string;
  match_time: string | null;
  title: string | null;
  position_assignments: { id: string }[];
}

interface PlayerEntry {
  member_id: string;
  name: string;
  positions: string[];
}

interface QuarterFeedback {
  session_id: string;
  session_name: string;
  players: (PlayerEntry & { feedback: string })[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h}시${m > 0 ? ` ${m}분` : ""}`;
}

function FeedbackContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get("matchId");

  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [quarterFeedbacks, setQuarterFeedbacks] = useState<QuarterFeedback[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [teamFeedback, setTeamFeedback] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareToast, setShareToast] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") fetchMatches();
  }, [status]);

  useEffect(() => {
    if (matchId) loadFeedback(matchId);
  }, [matchId]);

  async function fetchMatches() {
    const res = await fetch("/api/matches");
    const data = await res.json();
    const list: MatchSummary[] = Array.isArray(data) ? data : [];
    setMatches(list.filter(m => m.position_assignments?.length > 0));
  }

  async function loadFeedback(mId: string) {
    setLoading(true);
    const res = await fetch(`/api/feedback?matchId=${mId}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();

    setSelectedMatch(data.match);
    setCanWrite(data.can_feedback ?? false);
    setTeamFeedback(data.feedback?.team_feedback ?? "");
    setActiveTab(0);

    // 쿼터별 피드백 병합
    const existingQF: QuarterFeedback[] = data.feedback?.player_feedbacks ?? [];
    const merged: QuarterFeedback[] = (data.quarters as { session_id: string; session_name: string; players: PlayerEntry[] }[]).map(q => {
      const existingQ = existingQF.find(eq => eq.session_id === q.session_id);
      return {
        session_id: q.session_id,
        session_name: q.session_name,
        players: q.players.map(p => {
          const found = existingQ?.players.find(ep => ep.member_id === p.member_id);
          return { ...p, feedback: found?.feedback ?? "" };
        }),
      };
    });
    setQuarterFeedbacks(merged);
    setLoading(false);
  }

  function selectMatch(mId: string) {
    router.push(`/feedback?matchId=${mId}`);
  }

  function updatePlayerFeedback(quarterIdx: number, memberId: string, text: string) {
    setQuarterFeedbacks(prev =>
      prev.map((q, qi) =>
        qi !== quarterIdx ? q : {
          ...q,
          players: q.players.map(p => p.member_id === memberId ? { ...p, feedback: text } : p),
        }
      )
    );
  }

  async function save() {
    if (!selectedMatch) return;
    setSaving(true);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: selectedMatch.id,
        team_feedback: teamFeedback || null,
        quarter_feedbacks: quarterFeedbacks.map(q => ({
          ...q,
          players: q.players.filter(p => p.feedback),
        })),
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function shareFeedback() {
    if (!selectedMatch) return;
    setSharing(true);
    const res = await fetch("/api/share/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: selectedMatch.id }),
    });
    if (!res.ok) { setSharing(false); return; }
    const { id } = await res.json();
    const url = `${window.location.origin}/share/feedback/${id}`;

    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      await navigator.share({ title: "경기 피드백", url });
    } else {
      await navigator.clipboard.writeText(url);
      setShareToast("🔗 공유 링크가 복사됐어요!");
      setTimeout(() => setShareToast(""), 3000);
    }
    setSharing(false);
  }

  const totalPages = Math.ceil(matches.length / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      {shareToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold">
          {shareToast}
        </div>
      )}

      <header className="bg-green-700 text-white px-4 py-3 flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} className="hover:text-green-200">← 뒤로</button>
        <div className="flex items-center gap-2">
          <span className="text-xl">📝</span>
          <h1 className="text-lg font-bold">경기 피드백</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">

        {/* 경기 선택 리스트 */}
        {!selectedMatch && (
          <div className="bg-white rounded-2xl shadow mb-5">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">경기 선택</p>
              <p className="text-xs text-gray-400">총 {matches.length}경기</p>
            </div>

            {matches.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">📅</div>
                <p className="text-sm">배정이 저장된 경기가 없어요</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-50">
                  {matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(m => (
                    <button
                      key={m.id}
                      onClick={() => selectMatch(m.id)}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-green-50 transition-colors text-left"
                    >
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{formatDate(m.match_date)}</p>
                        {m.title && <p className="text-xs text-gray-400 mt-0.5">{m.title}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.match_time && (
                          <span className="text-xs text-green-600 font-medium">{formatTime(m.match_time)}</span>
                        )}
                        <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                          {m.position_assignments.length}쿼터
                        </span>
                        <span className="text-gray-300 text-sm">→</span>
                      </div>
                    </button>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">←</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === p ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                        {p}
                      </button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">→</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 선택된 경기 뒤로 버튼 */}
        {selectedMatch && (
          <button onClick={() => { setSelectedMatch(null); router.push("/feedback"); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 mb-4 transition-colors">
            ← 경기 목록으로
          </button>
        )}

        {loading && <p className="text-center text-gray-400 py-10">로딩 중...</p>}

        {!loading && selectedMatch && (
          <>
            {/* 경기 정보 + 버튼 */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800 text-base">
                  {formatDate(selectedMatch.match_date)}
                  {selectedMatch.match_time && (
                    <span className="text-green-600 ml-2 text-sm">
                      {formatTime(selectedMatch.match_time)}
                      {selectedMatch.match_end_time && ` ~ ${formatTime(selectedMatch.match_end_time)}`}
                    </span>
                  )}
                </p>
                {selectedMatch.title && <p className="text-sm text-gray-500">{selectedMatch.title}</p>}
              </div>
              <div className="flex gap-2">
                {canWrite && (
                  <button onClick={save} disabled={saving}
                    className={`px-5 py-2 rounded-xl font-bold text-sm transition-colors ${saved ? "bg-blue-500 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}>
                    {saved ? "✓ 저장됨" : saving ? "저장 중..." : "저장"}
                  </button>
                )}
                <button onClick={shareFeedback} disabled={sharing}
                  className="px-5 py-2 rounded-xl font-bold text-sm bg-gray-700 hover:bg-gray-800 text-white transition-colors">
                  {sharing ? "..." : "🔗 공유"}
                </button>
              </div>
            </div>

            {/* 2단 레이아웃 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* 왼쪽: 팀 전체 피드백 */}
              <div className="bg-white rounded-2xl shadow p-5">
                <p className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-lg">🏆</span> 팀 전체 피드백
                </p>
                {canWrite ? (
                  <textarea
                    value={teamFeedback}
                    onChange={e => setTeamFeedback(e.target.value)}
                    placeholder={"오늘 경기 전반적인 피드백을 작성하세요\n\n예: 전반에 압박 수비가 잘 됐지만 후반 체력 저하로 공간이 많이 열렸어요."}
                    rows={14}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none leading-relaxed"
                  />
                ) : (
                  <div className="min-h-[200px] text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {teamFeedback || <span className="text-gray-300">아직 작성된 피드백이 없어요</span>}
                  </div>
                )}
              </div>

              {/* 오른쪽: 쿼터별 개인 피드백 */}
              <div className="bg-white rounded-2xl shadow p-5">
                <p className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-lg">👤</span> 개인 피드백
                </p>

                {quarterFeedbacks.length === 0 ? (
                  <p className="text-sm text-gray-400">배정된 쿼터가 없어요</p>
                ) : (
                  <>
                    {/* 쿼터 탭 */}
                    <div className="flex gap-1.5 mb-4 flex-wrap">
                      {quarterFeedbacks.map((q, i) => (
                        <button
                          key={q.session_id}
                          onClick={() => setActiveTab(i)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                            activeTab === i
                              ? "bg-green-600 text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {q.session_name}
                          {q.players.filter(p => p.feedback).length > 0 && (
                            <span className={`ml-1 ${activeTab === i ? "text-green-200" : "text-green-500"}`}>
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* 선택된 쿼터 선수 목록 */}
                    {quarterFeedbacks[activeTab] && (
                      <div className="flex flex-col gap-3 overflow-y-auto max-h-[480px] pr-1">
                        {quarterFeedbacks[activeTab].players.length === 0 ? (
                          <p className="text-sm text-gray-400">배정된 선수가 없어요</p>
                        ) : (
                          quarterFeedbacks[activeTab].players.map(p => (
                            <div key={p.member_id} className="border border-gray-100 rounded-xl p-3">
                              <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-800 text-sm">{p.name}</span>
                                  <div className="flex gap-1 flex-wrap">
                                    {p.positions.map(pos => (
                                      <span key={pos} className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{pos}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              {canWrite ? (
                                <textarea
                                  value={p.feedback}
                                  onChange={e => updatePlayerFeedback(activeTab, p.member_id, e.target.value)}
                                  placeholder={`${p.name} 선수 피드백...`}
                                  rows={2}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                                />
                              ) : (
                                <p className="text-sm text-gray-600 whitespace-pre-wrap min-h-[32px]">
                                  {p.feedback || <span className="text-gray-300">-</span>}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {!canWrite && (
              <p className="text-center text-xs text-gray-400 mt-4">관리자·감독·코치만 피드백을 작성할 수 있어요</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>}>
      <FeedbackContent />
    </Suspense>
  );
}
