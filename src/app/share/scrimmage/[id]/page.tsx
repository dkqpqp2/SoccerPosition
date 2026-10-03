"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { PositionSlot } from "@/lib/formations";

interface Member {
  id: string;
  name: string;
  jersey_number?: number | null;
}

interface Squad {
  id: string;
  name: string;
  formation_name: string | null;
  formation_slots: PositionSlot[] | null;
  assigned: Record<string, Member | null>;
}

interface ScrimmageData {
  id: string;
  title: string | null;
  sport: "soccer" | "futsal";
  match_date: string | null;
}

const SPORT_LABEL: Record<string, string> = { soccer: "축구", futsal: "풋살" };

export default function ScrimmageSharePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [scrimmage, setScrimmage] = useState<ScrimmageData | null>(null);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/share/scrimmage/${id}`)
      .then(res => res.json())
      .then(d => {
        if (d.error) setNotFound(true);
        else { setScrimmage(d.scrimmage); setSquads(d.squads ?? []); }
        setLoading(false);
      });
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound || !scrimmage) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <Swords size={40} strokeWidth={1.5} className="opacity-30 mx-auto mb-4" />
        <p className="text-lg font-bold text-white">공유된 내전을 찾을 수 없어요</p>
        <p className="text-sm text-gray-500 mt-2">링크가 만료됐거나 잘못된 주소예요</p>
      </div>
    </div>
  );

  const formatDate = (d: string | null) =>
    d ? new Date(d.replace(/-/g, "/")).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" }) : "";

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-2xl mx-auto px-3 pt-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors bg-gray-900 border border-white/5 px-3 py-1.5 rounded-xl"
        >
          ← 홈으로
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-3 py-6">
        <div className="text-center mb-6">
          <Swords size={28} strokeWidth={1.75} className="text-emerald-400 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-white">{scrimmage.title || "내전"}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {formatDate(scrimmage.match_date)} · {SPORT_LABEL[scrimmage.sport]} · {squads.length}파전
          </p>
        </div>

        <div className="space-y-5">
          {squads.map(squad => {
            const slots = squad.formation_slots ?? [];
            const members = slots.map(s => squad.assigned[s.id]).filter(Boolean) as Member[];
            return (
              <div key={squad.id} className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <p className="font-bold text-white">{squad.name}</p>
                  <p className="text-[11px] text-gray-500">{squad.formation_name ?? "미설정"} · {members.length}명</p>
                </div>

                {slots.length === 0 ? (
                  <p className="text-center text-xs text-gray-600 py-8">아직 라인업이 없어요</p>
                ) : (
                  <div className="p-3">
                    <div
                      className="relative w-full rounded-lg overflow-hidden"
                      style={{ paddingBottom: "110%", background: "linear-gradient(180deg, #166534 0%, #14532d 40%, #15803d 60%, #166534 100%)" }}
                    >
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute border border-white/20 inset-[3%] rounded-sm" />
                        <div className="absolute w-full border-t border-white/20" style={{ top: "50%" }} />
                        <div className="absolute border border-white/20 rounded-full" style={{ width: "20%", height: "14%", top: "43%", left: "40%" }} />
                      </div>
                      {slots.map(slot => {
                        const member = squad.assigned[slot.id];
                        return (
                          <div
                            key={slot.id}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                          >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-[10px] shadow-lg border-2 ${
                              member ? "bg-emerald-400 border-emerald-300 text-gray-900" : "bg-white/15 border-white/25 text-white/50"
                            }`}>
                              {slot.label}
                            </div>
                            {member && <span className="mt-0.5 text-[9px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap">{member.name}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="flex items-center justify-center gap-1 text-gray-700 text-xs mt-6 pb-2">
          <Swords size={12} /> Sports Position Management
        </p>
      </div>
    </div>
  );
}
