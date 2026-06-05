import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import CaptureButton from "@/components/CaptureButton";

interface Member {
  id: string;
  name: string;
  position_1st: string | null;
  position_2nd: string | null;
  is_mercenary?: boolean;
  is_cafe_mercenary?: boolean;
  referrer?: string | null;
}

interface MatchInfo {
  match_date: string;
  match_time: string | null;
  match_end_time: string | null;
  location: string | null;
  title: string | null;
  uniform_info: string | null;
}

interface SharedData {
  members: Member[];
  match_info?: MatchInfo | null;
  uniform_info?: string | null;
}

function calcArrivalTime(matchTime: string): string {
  const [h, m] = matchTime.split(":").map(Number);
  const total = h * 60 + m - 30;
  const ah = Math.floor(total / 60);
  const am = total % 60;
  return `${ah}시 ${String(am).padStart(2, "0")}분`;
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
  return `${h}시${m > 0 ? ` ${String(m).padStart(2, "0")}분` : ""}`;
}

export default async function ShareAttendeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("shared_lists")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const { members, match_info, uniform_info: storedUniform } = data.data as SharedData;
  const uniform_info = match_info?.uniform_info ?? storedUniform ?? null;

  const regular = members.filter(m => !m.is_mercenary);
  const mercenary = members.filter(m => m.is_mercenary);

  const hasMercenary = mercenary.length > 0;
  const regularOverflow = regular.length > 10;
  const regular1 = regularOverflow ? regular.slice(0, Math.ceil(regular.length / 2)) : regular;
  const regular2 = regularOverflow ? regular.slice(Math.ceil(regular.length / 2)) : [];

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div id="capture-area" className="bg-gray-950 p-4 rounded-2xl">

          {/* 헤더 */}
          <div className="text-center mb-5">
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
                {match_info.title && <p className="text-gray-400 text-sm">{match_info.title}</p>}
                {match_info.location && <p className="text-gray-500 text-sm">📍 {match_info.location}</p>}
              </div>
            )}
            <div className="mt-3 inline-block bg-emerald-500 text-black font-black text-xl px-5 py-2 rounded-2xl shadow-lg shadow-emerald-500/20">
              오늘 참가 인원 · {members.length}명
            </div>
          </div>

          {/* 참가 인원 레이아웃 */}
          <div className={`grid gap-3 mb-4 items-start ${regularOverflow ? "grid-cols-3" : "grid-cols-2"}`}>

            {/* 정규 팀원 (1번째 칸) */}
            <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
              <div className="bg-emerald-500/20 border-b border-emerald-500/20 px-3 py-2">
                <p className="text-emerald-400 text-sm font-bold">👥 정규 {regular.length}명{regularOverflow ? " (1)" : ""}</p>
              </div>
              <div className="divide-y divide-white/5">
                {regular1.map((m, i) => (
                  <div key={m.id} className="flex items-start px-3 py-2 gap-1.5">
                    <span className="text-xs text-gray-700 w-4 shrink-0 pt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{m.name}</p>
                      <div className="flex gap-0.5 mt-0.5 flex-wrap">
                        {m.position_1st && <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1 py-0.5 rounded">{m.position_1st}</span>}
                        {m.position_2nd && <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1 py-0.5 rounded">{m.position_2nd}</span>}
                        {!m.position_1st && !m.position_2nd && (
                          <span className="text-[10px] text-gray-700">미지정</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {regular.length === 0 && <p className="text-xs text-gray-700 px-3 py-3">없음</p>}
              </div>
            </div>

            {/* 정규 팀원 (2번째 칸, 10명 초과 시만 표시) */}
            {regularOverflow && (
              <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
                <div className="bg-emerald-500/20 border-b border-emerald-500/20 px-3 py-2">
                  <p className="text-emerald-400 text-sm font-bold">👥 정규 {regular.length}명 (2)</p>
                </div>
                <div className="divide-y divide-white/5">
                  {regular2.map((m, i) => (
                    <div key={m.id} className="flex items-start px-3 py-2 gap-1.5">
                      <span className="text-xs text-gray-700 w-4 shrink-0 pt-0.5">{Math.ceil(regular.length / 2) + i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{m.name}</p>
                        <div className="flex gap-0.5 mt-0.5 flex-wrap">
                          {m.position_1st && <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1 py-0.5 rounded">{m.position_1st}</span>}
                          {m.position_2nd && <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1 py-0.5 rounded">{m.position_2nd}</span>}
                          {!m.position_1st && !m.position_2nd && (
                            <span className="text-[10px] text-gray-700">미지정</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 용병 */}
            <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
              <div className="bg-amber-500/20 border-b border-amber-500/20 px-3 py-2">
                <p className="text-amber-400 text-sm font-bold">⚡ 용병 · {mercenary.length}명</p>
              </div>
              <div className="divide-y divide-white/5">
                {mercenary.map((m, i) => (
                  <div key={m.id} className="flex items-start px-3 py-2 gap-1.5">
                    <span className="text-xs text-gray-700 w-4 shrink-0 pt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="text-sm font-semibold text-amber-300">{m.name}</p>
                        {m.is_cafe_mercenary
                          ? <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1 py-0.5 rounded shrink-0">☕카페</span>
                          : m.referrer
                          ? <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded shrink-0">{m.referrer}지인</span>
                          : null}
                      </div>
                      <div className="flex gap-0.5 mt-0.5 flex-wrap">
                        {m.position_1st && <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1 py-0.5 rounded">{m.position_1st}</span>}
                        {m.position_2nd && <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1 py-0.5 rounded">{m.position_2nd}</span>}
                        {!m.position_1st && !m.position_2nd && (
                          <span className="text-[10px] text-gray-700">미지정</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {mercenary.length === 0 && <p className="text-xs text-gray-700 px-3 py-3">없음</p>}
              </div>
            </div>
          </div>

          {/* 공지사항 */}
          <div className="bg-gray-900 border border-white/5 rounded-2xl p-4">
            <p className="font-bold text-white mb-3">📋 공지사항</p>
            <ol className="flex flex-col gap-2.5">
              {match_info?.match_time && (
                <li className="flex gap-2 text-sm text-gray-300">
                  <span className="font-bold text-emerald-400 shrink-0">1.</span>
                  <span>
                    <b className="text-white">{calcArrivalTime(match_info.match_time)}까지</b> 구장으로 출석
                    <span className="text-red-400 text-xs ml-1">(지각비 1만원)</span>
                  </span>
                </li>
              )}
              {uniform_info && (
                <li className="flex gap-2 text-sm text-gray-300">
                  <span className="font-bold text-emerald-400 shrink-0">{match_info?.match_time ? "2" : "1"}.</span>
                  <span>복장: <b className="text-white">{uniform_info}</b></span>
                </li>
              )}
              {hasMercenary && (
                <li className="flex gap-2 text-sm text-gray-300">
                  <span className="font-bold text-emerald-400 shrink-0">
                    {[match_info?.match_time, uniform_info].filter(Boolean).length + 1}.
                  </span>
                  <span>용병 부르시는 분들은 장소, 시간 및 상의 색상 전달</span>
                </li>
              )}
              <li className="flex gap-2 text-sm text-gray-300">
                <span className="font-bold text-emerald-400 shrink-0">
                  {[match_info?.match_time, uniform_info, hasMercenary || null].filter(Boolean).length + 1}.
                </span>
                <span>참석 가능한 인원은 갠톡 바랍니다</span>
              </li>
            </ol>
          </div>

          <p className="text-center text-xs text-gray-700 mt-4">
            {new Date(data.created_at).toLocaleString("ko-KR")} 공유됨
          </p>
        </div>

        {/* 캡쳐 버튼 (이미지에 포함 안 됨) */}
        <CaptureButton targetId="capture-area" />
      </div>
    </div>
  );
}
