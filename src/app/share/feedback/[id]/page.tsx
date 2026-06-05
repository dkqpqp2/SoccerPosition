import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";

interface MatchInfo {
  match_date: string;
  match_time: string | null;
  match_end_time: string | null;
  title: string | null;
  location: string | null;
}

interface PlayerFeedback {
  member_id: string;
  name: string;
  positions: string[];
  feedback: string;
  is_mercenary?: boolean;
  is_cafe_mercenary?: boolean;
  referrer?: string | null;
}

interface QuarterFeedback {
  session_id: string;
  session_name: string;
  players: PlayerFeedback[];
}

interface SharedFeedbackData {
  type: "feedback";
  match_info: MatchInfo;
  team_feedback: string | null;
  quarter_feedbacks: QuarterFeedback[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const wd = days[d.getDay()];
  return `${y}년 ${mo}월 ${day}일 (${wd})`;
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h}시${m > 0 ? ` ${m}분` : ""}`;
}

export default async function ShareFeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("shared_lists")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const { match_info, team_feedback, quarter_feedbacks: rawQuarterFeedbacks } = data.data as SharedFeedbackData;
  const quarter_feedbacks = [...rawQuarterFeedbacks].sort((a, b) => a.session_name.localeCompare(b.session_name, "ko"));

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* 헤더 */}
        <div className="text-center mb-6">
          <p className="text-emerald-400 font-bold text-base">⚽ {data.team_name}</p>
          {match_info && (
            <div className="mt-1">
              <p className="text-white font-bold text-lg">{formatDate(match_info.match_date)}</p>
              {match_info.match_time && (
                <p className="text-emerald-400 font-semibold">
                  {formatTime(match_info.match_time)}
                  {match_info.match_end_time && ` ~ ${formatTime(match_info.match_end_time)}`}
                </p>
              )}
              {match_info.title && <p className="text-gray-400 text-sm mt-0.5">{match_info.title}</p>}
              {match_info.location && <p className="text-gray-500 text-sm">📍 {match_info.location}</p>}
            </div>
          )}
          <div className="mt-3 inline-block bg-emerald-500 text-black font-black text-lg px-5 py-2 rounded-2xl shadow-lg shadow-emerald-500/20">
            📝 경기 피드백
          </div>
        </div>

        {/* 팀 전체 피드백 */}
        {team_feedback && (
          <div className="bg-gray-900 border border-white/5 rounded-2xl p-5 mb-4">
            <p className="font-bold text-white mb-3 flex items-center gap-2">
              <span>🏆</span> 팀 전체 피드백
            </p>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{team_feedback}</p>
          </div>
        )}

        {/* 쿼터별 개인 피드백 */}
        {quarter_feedbacks.some(q => q.players.some(p => p.feedback)) && (
          <div
            className="grid gap-3 mb-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(quarter_feedbacks.length, 3)}, 1fr)` }}
          >
            {quarter_feedbacks.map(q => {
              const withFeedback = q.players.filter(p => p.feedback);
              return (
                <div key={q.session_id} className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
                  <div className="bg-emerald-500/20 border-b border-emerald-500/10 px-3 py-2 flex items-center justify-between">
                    <p className="text-emerald-400 text-sm font-bold">{q.session_name}</p>
                    <p className="text-gray-500 text-xs">{withFeedback.length}명</p>
                  </div>
                  <div className="divide-y divide-white/5">
                    {withFeedback.length === 0 ? (
                      <p className="text-xs text-gray-700 px-3 py-3">피드백 없음</p>
                    ) : (
                      withFeedback.map((p, i) => (
                        <div key={p.member_id} className={`px-3 py-2.5 ${p.is_mercenary ? "bg-amber-500/5" : ""}`}>
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="text-xs text-gray-700 w-4 shrink-0">{i + 1}</span>
                            <span className={`font-bold text-sm ${p.is_mercenary ? "text-amber-300" : "text-white"}`}>
                              {p.name}
                            </span>
                            {p.is_mercenary && (
                              p.is_cafe_mercenary
                                ? <span className="text-xs text-sky-400">☕카페</span>
                                : p.referrer
                                ? <span className="text-xs text-amber-500">{p.referrer}지인</span>
                                : <span className="text-xs text-amber-500">용병</span>
                            )}
                            <div className="flex gap-0.5 flex-wrap">
                              {p.positions.map(pos => (
                                <span
                                  key={pos}
                                  className={`text-xs px-1.5 py-0.5 rounded-full ${p.is_mercenary ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"}`}
                                >
                                  {pos}
                                </span>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap pl-5">
                            {p.feedback}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 피드백 없는 경우 */}
        {!team_feedback && quarter_feedbacks.every(q => q.players.every(p => !p.feedback)) && (
          <div className="text-center py-10">
            <div className="text-4xl mb-3 opacity-30">💬</div>
            <p className="text-gray-600">아직 작성된 피드백이 없어요</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-700 mt-4">
          {new Date(data.created_at).toLocaleString("ko-KR")} 공유됨
        </p>
      </div>
    </div>
  );
}
