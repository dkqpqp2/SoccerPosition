"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FORMATIONS, Formation, PositionSlot } from "@/lib/formations";

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
  matches?: { match_date: string; title: string | null } | null;
}

export default function SharePage() {
  const { id } = useParams<{ id: string }>();
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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

  return (
    <div className="min-h-screen bg-gray-950">
      {/* 헤더 */}
      <div className="px-6 py-6 text-center border-b border-white/5">
        <div className="text-3xl mb-2">⚽</div>
        <h1 className="text-xl font-bold text-white">{data!.session_name}</h1>
        {match && (
          <p className="text-gray-400 text-sm mt-1">
            {formatDate(match.match_date)}{match.title && ` · ${match.title}`}
          </p>
        )}
        <p className="text-emerald-400/70 text-xs mt-1 font-medium">{data!.formation_name} 포메이션</p>
      </div>

      {/* 그라운드 */}
      <div className="max-w-sm mx-auto px-4 py-6">
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
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-[9px] shadow-lg border-2 ${bgText} ${borderClass}`}>
                  {slot.label}
                </div>
                {member && (
                  <span className={`mt-1 text-[9px] font-bold whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${isMercenary ? "text-amber-300" : "text-white"}`}>
                    {member.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 명단 */}
        {(() => {
          const regularSlots = formation.slots.filter(s => assigned[s.id] && !assigned[s.id]!.is_mercenary);
          const mercenarySlots = formation.slots.filter(s => assigned[s.id]?.is_mercenary);
          return (
            <div className="mt-4 bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
              {/* 정규 팀원 */}
              {regularSlots.length > 0 && (
                <div className="p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">출전 명단</p>
                  <div className="grid grid-cols-2 gap-2">
                    {regularSlots.map(slot => {
                      const member = assigned[slot.id]!;
                      return (
                        <div key={slot.id} className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-2">
                          <span className="text-xs font-bold text-emerald-400 w-8 shrink-0">{slot.label}</span>
                          <span className="text-gray-300 text-xs font-medium truncate">{member.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 용병 */}
              {mercenarySlots.length > 0 && (
                <div className={`p-4 ${regularSlots.length > 0 ? "border-t border-amber-500/20 bg-amber-500/5" : ""}`}>
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">⚡ 용병 · {mercenarySlots.length}명</p>
                  <div className="grid grid-cols-2 gap-2">
                    {mercenarySlots.map(slot => {
                      const member = assigned[slot.id]!;
                      return (
                        <div key={slot.id} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                          <span className="text-xs font-bold text-amber-400 w-8 shrink-0">{slot.label}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-amber-300 text-xs font-medium truncate block">{member.name}</span>
                            {member.is_cafe_mercenary
                              ? <span className="text-[10px] text-sky-400">☕카페</span>
                              : member.referrer
                              ? <span className="text-[10px] text-amber-500">{member.referrer}지인</span>
                              : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        <p className="text-center text-gray-700 text-xs mt-4">⚽ Soccer Position Management</p>
      </div>
    </div>
  );
}
