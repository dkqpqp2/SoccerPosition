"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FORMATIONS, Formation, PositionSlot } from "@/lib/formations";
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

interface AssignmentData {
  id: string;
  session_name: string;
  formation_name: string;
  formation_slots: PositionSlot[];
  result: Record<string, Member | null>;
  attending_members: Member[] | null;
  matches?: { match_date: string; title: string | null } | null;
}

export default function SharePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<AssignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/share/${id}`)
      .then(res => res.json())
      .then(d => {
        if (d.error) setNotFound(true);
        else setData(d);
        setLoading(false);
      });
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="text-5xl mb-4 opacity-30">⚽</div>
        <p className="text-lg font-bold text-white">공유된 배정을 찾을 수 없어요</p>
        <p className="text-sm text-gray-500 mt-2">링크가 만료됐거나 잘못된 주소예요</p>
      </div>
    </div>
  );

  const formation: Formation = data!.formation_slots
    ? { name: data!.formation_name, slots: data!.formation_slots }
    : FORMATIONS[data!.formation_name] ?? FORMATIONS["4-3-3"];

  const match = data!.matches;
  const assigned = data!.result;
  const attendingMembers: Member[] = data!.attending_members ?? [];

  const sessionName = data!.session_name;
  const captureFilename = `${sessionName}_${data!.formation_name}.png`;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  // 출전 명단 계산
  const assignedMembers = formation.slots.map(s => assigned[s.id]).filter(Boolean) as Member[];
  const assignedIds = new Set(assignedMembers.map(m => m.id));

  const regularStarters = formation.slots.filter(s => assigned[s.id] && !assigned[s.id]!.is_mercenary);
  const mercenaryStarters = formation.slots.filter(s => assigned[s.id]?.is_mercenary);

  // 교체 가능 인원 (참가했지만 출전 명단에 없는 사람)
  const benchMembers = attendingMembers.filter(m => !assignedIds.has(m.id));
  const hasAttendingData = attendingMembers.length > 0;

  const totalCount = hasAttendingData ? attendingMembers.length : assignedMembers.length;
  const starterCount = assignedMembers.length;
  const benchCount = benchMembers.length;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* 상단 홈 버튼 */}
      <div className="max-w-2xl mx-auto px-3 pt-4 flex items-center gap-2">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors bg-gray-900 border border-white/5 px-3 py-1.5 rounded-xl"
        >
          ← 홈으로
        </button>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors bg-gray-900 border border-white/5 px-3 py-1.5 rounded-xl"
        >
          ↩ 이전으로
        </button>
      </div>
      <div className="max-w-2xl mx-auto px-3 py-6">

        {/* ── 캡쳐 영역 시작 ── */}
        <div id="capture-area" className="bg-gray-950 rounded-2xl">

          {/* 헤더 */}
          <div className="px-2 pb-4 text-center">
            <div className="text-3xl mb-2">⚽</div>
            <h1 className="text-xl font-bold text-white">{sessionName}</h1>
            {match && (
              <p className="text-gray-400 text-sm mt-1">
                {formatDate(match.match_date)}{match.title && ` · ${match.title}`}
              </p>
            )}
            <p className="text-emerald-400/70 text-xs mt-1 font-medium">{data!.formation_name} 포메이션</p>
          </div>

          {/* ── 1행: 포지션 필드 | 참여 현황 ── */}
          <div className="flex gap-2.5 mb-2.5">

            {/* 그라운드 (왼쪽 55%) */}
            <div className="w-[55%] shrink-0">
              <div
                className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
                style={{ paddingBottom: "140%", background: "linear-gradient(180deg, #166534 0%, #14532d 40%, #15803d 60%, #166534 100%)" }}
              >
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute border border-white/20 inset-[4%] rounded-sm" />
                  <div className="absolute w-[92%] left-[4%] border-t border-white/20" style={{ top: "50%" }} />
                  <div className="absolute border border-white/20 rounded-full"
                    style={{ width: "22%", height: "14%", top: "43%", left: "39%" }} />
                  <div className="absolute border border-white/20"
                    style={{ width: "46%", height: "13%", top: "4%", left: "27%" }} />
                  <div className="absolute border border-white/20"
                    style={{ width: "46%", height: "13%", bottom: "4%", left: "27%" }} />
                </div>

                {formation.slots.map(slot => {
                  const member = assigned[slot.id];
                  const isGK = slot.id === "GK";
                  const pos = slot.label.toUpperCase();
                  const isMercenary = member?.is_mercenary ?? false;

                  const bgText = !member
                    ? "bg-white/15 text-white/50"
                    : isGK
                    ? "bg-amber-400 text-gray-900"
                    : /^(CB|LB|RB|LWB|RWB|SW|DC|DL|DR|WB|FB)/.test(pos)
                    ? "bg-blue-500 text-white"
                    : /^(ST|CF|SS|LW|RW|LF|RF|FW|ATT|WG|CW)/.test(pos)
                    ? "bg-red-500 text-white"
                    : "bg-emerald-400 text-gray-900";

                  const borderClass = !member
                    ? "border-white/25"
                    : isMercenary
                    ? "border-white border-[2.5px]"
                    : isGK
                    ? "border-amber-300"
                    : /^(CB|LB|RB|LWB|RWB|SW|DC|DL|DR|WB|FB)/.test(pos)
                    ? "border-blue-400"
                    : /^(ST|CF|SS|LW|RW|LF|RF|FW|ATT|WG|CW)/.test(pos)
                    ? "border-red-400"
                    : "border-emerald-300";

                  return (
                    <div
                      key={slot.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[8px] shadow-lg border-2 ${bgText} ${borderClass}`}>
                        {slot.label}
                      </div>
                      {member && (
                        <span className={`mt-0.5 text-[8px] font-bold whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${isMercenary ? "text-amber-300" : "text-white"}`}>
                          {member.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 참여 현황 (오른쪽 45%) */}
            <div className="flex-1 flex flex-col gap-2">

              {/* 총 인원 카드 */}
              <div className="bg-gray-900 border border-white/5 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">참여 현황</p>
                <p className="text-3xl font-black text-emerald-400">{totalCount}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">총 참가인원</p>
              </div>

              {/* 출전/대기 분리 */}
              <div className="bg-gray-900 border border-white/5 rounded-2xl p-3 flex flex-col gap-2">
                {/* 출전 */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">출전</span>
                  <span className="text-sm font-bold text-white">{starterCount}명</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5">
                  <div
                    className="bg-emerald-400 h-1.5 rounded-full transition-all"
                    style={{ width: totalCount > 0 ? `${Math.round((starterCount / totalCount) * 100)}%` : "0%" }}
                  />
                </div>

                {/* 대기 */}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-gray-500">교체대기</span>
                  <span className="text-sm font-bold text-white">{benchCount}명</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5">
                  <div
                    className="bg-sky-400 h-1.5 rounded-full transition-all"
                    style={{ width: totalCount > 0 ? `${Math.round((benchCount / totalCount) * 100)}%` : "0%" }}
                  />
                </div>
              </div>

              {/* 용병 있으면 표시 */}
              {mercenaryStarters.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-center">
                  <p className="text-[10px] text-amber-400/70 mb-0.5">용병</p>
                  <p className="text-xl font-black text-amber-400">{mercenaryStarters.length}명</p>
                </div>
              )}

              {/* 포메이션 슬롯 수 */}
              <div className="bg-gray-900 border border-white/5 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-gray-500 mb-0.5">슬롯</p>
                <p className="text-lg font-black text-white">{formation.slots.length}명</p>
                <p className="text-[9px] text-gray-600 mt-0.5">{data!.formation_name}</p>
              </div>
            </div>
          </div>

          {/* ── 2행: 출전 명단 | 교체 가능 ── */}
          <div className="grid grid-cols-2 gap-2.5">

            {/* 출전 명단 (정규 + 용병 모두, 한 줄 통일) */}
            <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
              <div className="px-3 py-2 border-b border-white/5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">출전 명단</p>
              </div>
              <div className="p-2 flex flex-col gap-1">
                {regularStarters.length === 0 && mercenaryStarters.length === 0 ? (
                  <p className="text-[10px] text-gray-600 px-1 py-2 text-center">배정 없음</p>
                ) : (
                  <>
                    {regularStarters.map(slot => {
                      const member = assigned[slot.id]!;
                      return (
                        <div key={slot.id} className="flex items-center gap-1.5 bg-white/5 rounded-xl px-2 py-1.5">
                          <span className="text-[9px] font-bold text-emerald-400 w-7 shrink-0">{slot.label}</span>
                          <span className="text-gray-300 text-[10px] font-medium truncate">{member.name}</span>
                        </div>
                      );
                    })}
                    {mercenaryStarters.length > 0 && regularStarters.length > 0 && (
                      <div className="border-t border-amber-500/20 my-0.5" />
                    )}
                    {mercenaryStarters.map(slot => {
                      const member = assigned[slot.id]!;
                      const badge = member.is_cafe_mercenary
                        ? <span className="text-[9px] text-sky-400 shrink-0">☕카페</span>
                        : member.referrer
                        ? <span className="text-[9px] text-amber-500 shrink-0">{member.referrer}지인</span>
                        : <span className="text-[9px] text-amber-500/60 shrink-0">용병</span>;
                      return (
                        <div key={slot.id} className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2 py-1.5">
                          <span className="text-[9px] font-bold text-amber-400 w-7 shrink-0">{slot.label}</span>
                          <span className="text-amber-300 text-[10px] font-medium truncate flex-1">{member.name}</span>
                          {badge}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* 교체 가능 (한 줄 통일) */}
            <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
              <div className="px-3 py-2 border-b border-white/5">
                <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">교체 가능</p>
              </div>
              <div className="p-2 flex flex-col gap-1">
                {!hasAttendingData ? (
                  <p className="text-[10px] text-gray-600 px-1 py-2 text-center leading-relaxed">
                    참가 인원을<br />설정 후 저장 시<br />표시됩니다
                  </p>
                ) : benchMembers.length === 0 ? (
                  <p className="text-[10px] text-gray-600 px-1 py-2 text-center">교체 없음</p>
                ) : (
                  benchMembers.map((m, i) => {
                    const posText = [m.position_1st, m.position_2nd].filter(Boolean).join("·");
                    const mercBadge = m.is_mercenary
                      ? (m.is_cafe_mercenary
                          ? <span className="text-[9px] text-sky-400 shrink-0">☕카페</span>
                          : m.referrer
                          ? <span className="text-[9px] text-amber-500 shrink-0">{m.referrer}지인</span>
                          : <span className="text-[9px] text-amber-400 shrink-0">용병</span>)
                      : null;
                    return (
                      <div key={m.id} className="flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/20 rounded-xl px-2 py-1.5">
                        <span className="text-[9px] text-sky-500/60 w-4 shrink-0">{i + 1}</span>
                        <span className={`text-[10px] font-medium truncate flex-1 ${m.is_mercenary ? "text-amber-300" : "text-sky-300"}`}>{m.name}</span>
                        {posText && <span className="text-[9px] text-gray-500 shrink-0">{posText}</span>}
                        {mercBadge}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <p className="text-center text-gray-700 text-xs mt-4 pb-2">⚽ Soccer Position Management</p>
        </div>
        {/* ── 캡쳐 영역 끝 ── */}

        {/* 이미지 저장 버튼 (캡쳐에 포함 안 됨) */}
        <CaptureButton targetId="capture-area" filename={captureFilename} />

      </div>
    </div>
  );
}
