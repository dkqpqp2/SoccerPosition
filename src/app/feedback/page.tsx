"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import AppLayout from "@/components/AppLayout";
import { extractYouTubeId, ytThumb, ytEmbed, VIDEO_CATEGORIES, VideoCategory } from "@/lib/youtube";

interface Match { id: string; match_date: string; match_time: string | null; match_end_time: string | null; title: string | null; location: string | null; }
interface MatchSummary { id: string; match_date: string; match_time: string | null; title: string | null; position_assignments: { id: string }[]; }
interface PlayerEntry { member_id: string; name: string; positions: string[]; }
interface QuarterFeedback { session_id: string; session_name: string; players: (PlayerEntry & { feedback: string })[]; }
interface FeedbackVideo { youtube_id: string; title: string; description?: string; category: VideoCategory; }

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
  const [videos, setVideos] = useState<FeedbackVideo[]>([]);
  const [showVideoAdd, setShowVideoAdd] = useState(false);
  const [videoForm, setVideoForm] = useState({ url: "", title: "", description: "", category: "etc" as VideoCategory });
  const [videoFormError, setVideoFormError] = useState("");
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") fetchMatches();
  }, [status]);

  useEffect(() => { if (matchId) loadFeedback(matchId); }, [matchId]);

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
    setVideos(data.feedback?.videos ?? []);
    setActiveTab(0);
    const existingQF: QuarterFeedback[] = data.feedback?.player_feedbacks ?? [];
    const sortedQuarters = (data.quarters as { session_id: string; session_name: string; players: PlayerEntry[] }[])
      .slice()
      .sort((a, b) => a.session_name.localeCompare(b.session_name, "ko"));

    const merged: QuarterFeedback[] = sortedQuarters.map(q => {
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

  function updatePlayerFeedback(quarterIdx: number, memberId: string, text: string) {
    setQuarterFeedbacks(prev =>
      prev.map((q, qi) => qi !== quarterIdx ? q : { ...q, players: q.players.map(p => p.member_id === memberId ? { ...p, feedback: text } : p) })
    );
  }

  async function save() {
    if (!selectedMatch) return;
    setSaving(true);
    await fetch("/api/feedback", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: selectedMatch.id, team_feedback: teamFeedback || null, quarter_feedbacks: quarterFeedbacks.map(q => ({ ...q, players: q.players.filter(p => p.feedback) })), videos }),
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function shareFeedback() {
    if (!selectedMatch) return;
    setSharing(true);
    const res = await fetch("/api/share/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ match_id: selectedMatch.id }) });
    if (!res.ok) { setSharing(false); return; }
    const { id } = await res.json();
    const url = `${window.location.origin}/share/feedback/${id}`;
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share) await navigator.share({ title: "경기 피드백", url });
    else { await navigator.clipboard.writeText(url); setShareToast("🔗 공유 링크가 복사됐어요!"); setTimeout(() => setShareToast(""), 3000); }
    setSharing(false);
  }

  const totalPages = Math.ceil(matches.length / PAGE_SIZE);

  return (
    <AppLayout title="경기 피드백">
      {shareToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-white/10 text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold">
          {shareToast}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* 경기 선택 리스트 */}
        {!selectedMatch && (
          <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden mb-5">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <p className="text-sm font-bold text-white">경기 선택</p>
              <p className="text-xs text-gray-600">총 {matches.length}경기</p>
            </div>

            {matches.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-2 opacity-30">📅</div>
                <p className="text-sm text-gray-600">배정이 저장된 경기가 없어요</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-white/5">
                  {matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(m => (
                    <button key={m.id} onClick={() => router.push(`/feedback?matchId=${m.id}`)}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-emerald-500/5 transition-colors text-left">
                      <div>
                        <p className="font-semibold text-white text-sm">{formatDate(m.match_date)}</p>
                        {m.title && <p className="text-xs text-gray-500 mt-0.5">{m.title}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.match_time && <span className="text-xs text-emerald-400 font-medium">{formatTime(m.match_time)}</span>}
                        <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">{m.position_assignments.length}쿼터</span>
                        <span className="text-gray-600 text-sm">→</span>
                      </div>
                    </button>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-white/5 flex items-center justify-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-white/5 disabled:opacity-30">←</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === p ? "bg-emerald-500 text-black" : "text-gray-500 hover:bg-white/5"}`}>{p}</button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-white/5 disabled:opacity-30">→</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {selectedMatch && (
          <button onClick={() => { setSelectedMatch(null); router.push("/feedback"); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-4 transition-colors">
            ← 경기 목록으로
          </button>
        )}

        {loading && <div className="flex items-center justify-center py-10"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>}

        {!loading && selectedMatch && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-white text-base">
                  {formatDate(selectedMatch.match_date)}
                  {selectedMatch.match_time && (
                    <span className="text-emerald-400 ml-2 text-sm font-medium">
                      {formatTime(selectedMatch.match_time)}{selectedMatch.match_end_time && ` ~ ${formatTime(selectedMatch.match_end_time)}`}
                    </span>
                  )}
                </p>
                {selectedMatch.title && <p className="text-sm text-gray-400 mt-0.5">{selectedMatch.title}</p>}
              </div>
              <div className="flex gap-2">
                {canWrite && (
                  <button onClick={save} disabled={saving}
                    className={`px-5 py-2 rounded-xl font-bold text-sm transition-colors ${saved ? "bg-blue-500 text-white" : "bg-emerald-500 hover:bg-emerald-400 text-black"}`}>
                    {saved ? "✓ 저장됨" : saving ? "저장 중..." : "저장"}
                  </button>
                )}
                <button onClick={shareFeedback} disabled={sharing}
                  className="px-5 py-2 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 transition-colors">
                  {sharing ? "..." : "🔗 공유"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 팀 전체 피드백 */}
              <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
                <p className="font-bold text-white mb-3 flex items-center gap-2">
                  <span>🏆</span> 팀 전체 피드백
                </p>
                {canWrite ? (
                  <textarea
                    value={teamFeedback}
                    onChange={e => setTeamFeedback(e.target.value)}
                    placeholder={"오늘 경기 전반적인 피드백을 작성하세요\n\n예: 전반에 압박 수비가 잘 됐지만 후반 체력 저하로 공간이 많이 열렸어요."}
                    rows={14}
                    className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed placeholder-gray-600"
                  />
                ) : (
                  <div className="min-h-[200px] text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {teamFeedback || <span className="text-gray-600">아직 작성된 피드백이 없어요</span>}
                  </div>
                )}
              </div>

              {/* 개인 피드백 */}
              <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
                <p className="font-bold text-white mb-3 flex items-center gap-2">
                  <span>👤</span> 개인 피드백
                </p>
                {quarterFeedbacks.length === 0 ? (
                  <p className="text-sm text-gray-600">배정된 쿼터가 없어요</p>
                ) : (
                  <>
                    <div className="flex gap-1.5 mb-4 flex-wrap">
                      {quarterFeedbacks.map((q, i) => (
                        <button key={q.session_id} onClick={() => setActiveTab(i)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                            activeTab === i ? "bg-emerald-500 text-black" : "bg-white/5 text-gray-500 hover:bg-white/10"
                          }`}>
                          {q.session_name}
                          {q.players.filter(p => p.feedback).length > 0 && (
                            <span className={`ml-1 ${activeTab === i ? "text-black/60" : "text-emerald-400"}`}>✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                    {quarterFeedbacks[activeTab] && (
                      <div className="flex flex-col gap-3 overflow-y-auto max-h-[480px] pr-1">
                        {quarterFeedbacks[activeTab].players.length === 0 ? (
                          <p className="text-sm text-gray-600">배정된 선수가 없어요</p>
                        ) : (
                          quarterFeedbacks[activeTab].players.map(p => (
                            <div key={p.member_id} className="bg-gray-800/50 border border-white/5 rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="font-semibold text-white text-sm">{p.name}</span>
                                <div className="flex gap-1 flex-wrap">
                                  {p.positions.map(pos => (
                                    <span key={pos} className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">{pos}</span>
                                  ))}
                                </div>
                              </div>
                              {canWrite ? (
                                <textarea
                                  value={p.feedback}
                                  onChange={e => updatePlayerFeedback(activeTab, p.member_id, e.target.value)}
                                  placeholder={`${p.name} 선수 피드백...`}
                                  rows={2}
                                  className="w-full bg-gray-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none placeholder-gray-600"
                                />
                              ) : (
                                <p className="text-sm text-gray-400 whitespace-pre-wrap min-h-[32px]">
                                  {p.feedback || <span className="text-gray-600">-</span>}
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
            {/* 추천 영상 섹션 */}
            <div className="mt-4 bg-gray-900 border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-white flex items-center gap-2"><span>🎬</span> 추천 영상</p>
                {canWrite && (
                  <button
                    onClick={() => { setShowVideoAdd(true); setVideoFormError(""); setVideoForm({ url: "", title: "", description: "", category: "etc" }); }}
                    className="text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                  >
                    + 영상 추가
                  </button>
                )}
              </div>

              {videos.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">
                  {canWrite ? "이 경기와 관련된 영상을 추천해보세요" : "추천된 영상이 없어요"}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {videos.map((v, i) => (
                    <div key={i} className="bg-gray-800/50 border border-white/5 rounded-xl overflow-hidden">
                      <div
                        className="relative aspect-video cursor-pointer group"
                        onClick={() => setPlayingVideoId(playingVideoId === v.youtube_id + i ? null : v.youtube_id + i)}
                      >
                        {playingVideoId === v.youtube_id + i ? (
                          <iframe src={ytEmbed(v.youtube_id)} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                        ) : (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ytThumb(v.youtube_id)} alt={v.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-semibold text-white line-clamp-1">{v.title}</p>
                        {v.description && <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{v.description}</p>}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-gray-600">{VIDEO_CATEGORIES.find(c => c.value === v.category)?.label ?? v.category}</span>
                          {canWrite && (
                            <button onClick={() => setVideos(prev => prev.filter((_, idx) => idx !== i))} className="text-[10px] text-red-500/60 hover:text-red-400 transition-colors">삭제</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!canWrite && (
              <p className="text-center text-xs text-gray-600 mt-4">관리자·감독·코치만 피드백을 작성할 수 있어요</p>
            )}

          </>
        )}
      </div>

      {/* 영상 추가 모달 (AppLayout 내 최상위) */}
      {showVideoAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={() => setShowVideoAdd(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white text-base mb-4">🎬 영상 추가</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">YouTube URL *</label>
                <input type="url" value={videoForm.url} onChange={e => { setVideoForm(p => ({ ...p, url: e.target.value })); setVideoFormError(""); }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none placeholder-gray-600" autoFocus />
                {extractYouTubeId(videoForm.url) && (
                  <div className="mt-2 rounded-xl overflow-hidden aspect-video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ytThumb(extractYouTubeId(videoForm.url)!)} alt="preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">제목 *</label>
                <input type="text" value={videoForm.title} onChange={e => setVideoForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="예: 4-3-3 압박 전술 설명"
                  className="w-full bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none placeholder-gray-600" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">카테고리</label>
                <div className="flex flex-wrap gap-1.5">
                  {VIDEO_CATEGORIES.filter(c => c.value !== "all").map(c => (
                    <button key={c.value} onClick={() => setVideoForm(p => ({ ...p, category: c.value as VideoCategory }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${videoForm.category === c.value ? "bg-emerald-500 text-black" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">설명 (선택)</label>
                <input type="text" value={videoForm.description} onChange={e => setVideoForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="핵심 내용이나 추천 이유"
                  className="w-full bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none placeholder-gray-600" />
              </div>
              {videoFormError && <p className="text-red-400 text-xs">{videoFormError}</p>}
              <div className="flex gap-3 mt-1">
                <button onClick={() => {
                  const ytId = extractYouTubeId(videoForm.url);
                  if (!videoForm.url.trim()) { setVideoFormError("URL을 입력해주세요"); return; }
                  if (!ytId) { setVideoFormError("올바른 YouTube URL이 아니에요"); return; }
                  if (!videoForm.title.trim()) { setVideoFormError("제목을 입력해주세요"); return; }
                  setVideos(prev => [...prev, { youtube_id: ytId, title: videoForm.title.trim(), description: videoForm.description.trim() || undefined, category: videoForm.category }]);
                  setShowVideoAdd(false);
                }} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl transition-colors">
                  추가
                </button>
                <button onClick={() => setShowVideoAdd(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2.5 rounded-xl transition-colors">취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-950"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>}>
      <FeedbackContent />
    </Suspense>
  );
}
