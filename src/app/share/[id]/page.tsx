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
    <div className="min-h-screen flex items-center justify-center bg-green-800">
      <p className="text-white">로딩 중...</p>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-green-800">
      <div className="text-center text-white">
        <div className="text-5xl mb-4">⚽</div>
        <p className="text-xl font-bold">공유된 배정을 찾을 수 없어요</p>
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
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-700">
      {/* 헤더 */}
      <div className="px-6 py-5 text-white text-center">
        <div className="text-3xl mb-1">⚽</div>
        <h1 className="text-xl font-bold">{data!.session_name}</h1>
        {match && (
          <p className="text-green-200 text-sm mt-0.5">
            {formatDate(match.match_date)}{match.title && ` · ${match.title}`}
          </p>
        )}
        <p className="text-green-300 text-xs mt-1">{data!.formation_name} 포메이션</p>
      </div>

      {/* 그라운드 */}
      <div className="max-w-sm mx-auto px-4 pb-6">
        <div
          className="relative w-full rounded-2xl overflow-hidden"
          style={{ paddingBottom: "140%", background: "linear-gradient(180deg, #2d7a2d 0%, #1a5c1a 100%)" }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute w-full border-t-2 border-white/30" style={{ top: "50%" }} />
            <div className="absolute border-2 border-white/30 rounded-full" style={{ width: "20%", height: "14%", top: "43%", left: "40%" }} />
            <div className="absolute border-2 border-white/30" style={{ width: "50%", height: "13%", top: "2%", left: "25%" }} />
            <div className="absolute border-2 border-white/30" style={{ width: "50%", height: "13%", bottom: "2%", left: "25%" }} />
            <div className="absolute border-2 border-white/40 inset-2 rounded" />
          </div>

          {formation.slots.map(slot => {
            const member = assigned[slot.id];
            return (
              <div
                key={slot.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              >
                <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center font-bold shadow-lg border-2 ${member ? "bg-yellow-400 border-yellow-300 text-gray-900" : "bg-white/50 border-white/50 text-gray-500"}`}>
                  <span className="text-xs font-bold leading-none">{slot.label}</span>
                  {member && <span className="text-xs leading-none mt-0.5 truncate max-w-[44px] text-center">{member.name}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 명단 */}
        <div className="mt-4 bg-white/10 rounded-2xl p-4">
          <p className="text-white text-xs font-semibold mb-3">출전 명단</p>
          <div className="grid grid-cols-2 gap-2">
            {formation.slots.map(slot => {
              const member = assigned[slot.id];
              if (!member) return null;
              return (
                <div key={slot.id} className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                  <span className="text-xs font-bold text-yellow-300 w-8">{slot.label}</span>
                  <span className="text-white text-xs font-medium truncate">{member.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-green-300 text-xs mt-4">⚽ 축구 포지션 배정 앱으로 만들었어요</p>
      </div>
    </div>
  );
}
