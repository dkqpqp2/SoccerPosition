"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Swords, Link2, Check, Trash2, Users } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { FORMATIONS, PositionSlot, SOCCER_FORMATIONS, FUTSAL_FORMATIONS } from "@/lib/formations";

interface Member {
  id: string;
  user_id?: string | null;
  name: string;
  position_1st: string | null;
  position_2nd: string | null;
  jersey_number?: number | null;
  is_mercenary?: boolean;
  is_cafe_mercenary?: boolean;
  referrer?: string | null;
}

interface Squad {
  id: string;
  name: string;
  color: string | null;
  formation_name: string | null;
  formation_slots: PositionSlot[] | null;
  assigned: Record<string, Member | null>;
  sort_order: number;
}

interface ScrimmageData {
  id: string;
  title: string | null;
  sport: "soccer" | "futsal";
  match_date: string | null;
}

interface CustomFormation {
  id: string;
  name: string;
  slots: PositionSlot[];
}

const SPORT_LABEL: Record<string, string> = { soccer: "축구", futsal: "풋살" };

export default function ScrimmageDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [scrimmage, setScrimmage] = useState<ScrimmageData | null>(null);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [squadMemberMap, setSquadMemberMap] = useState<Record<string, string>>({}); // member_id -> squad_id
  const [roster, setRoster] = useState<Member[]>([]);
  const [customFormations, setCustomFormations] = useState<CustomFormation[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [activeSquadId, setActiveSquadId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") {
      fetchDetail();
      fetchRole();
      fetch("/api/formations").then(r => r.json()).then(d => setCustomFormations(Array.isArray(d) ? d : []));
    }
  }, [status, id]);

  async function fetchRole() {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    const role = data.role ?? null;
    setCanManage(role === "owner" || role === "manager" || role === "coach" || role === "president");
  }

  async function fetchDetail() {
    setLoading(true);
    const res = await fetch(`/api/scrimmages/${id}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setScrimmage(data.scrimmage);
    setSquads(data.squads ?? []);
    setRoster(data.roster ?? []);
    const map: Record<string, string> = {};
    for (const sm of data.squad_members ?? []) map[sm.member_id] = sm.squad_id;
    setSquadMemberMap(map);
    setActiveSquadId(prev => prev ?? (data.squads?.[0]?.id ?? null));
    setLoading(false);
  }

  async function assignMember(memberId: string, squadId: string | null) {
    setSquadMemberMap(prev => {
      const next = { ...prev };
      if (squadId) next[memberId] = squadId;
      else delete next[memberId];
      return next;
    });
    await fetch(`/api/scrimmages/${id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, squad_id: squadId }),
    });
  }

  const activeSquad = squads.find(s => s.id === activeSquadId) ?? null;

  const availableFormationNames = useMemo(() => {
    if (!scrimmage) return [];
    if (scrimmage.sport === "soccer") return SOCCER_FORMATIONS;
    return Object.values(FUTSAL_FORMATIONS).flat();
  }, [scrimmage]);

  function applyFormation(name: string) {
    if (!activeSquad) return;
    const builtIn = FORMATIONS[name];
    const custom = customFormations.find(f => f.name === name);
    const slots = builtIn?.slots ?? custom?.slots;
    if (!slots) return;
    updateSquadLocal(activeSquad.id, { formation_name: name, formation_slots: slots, assigned: {} });
  }

  function updateSquadLocal(squadId: string, patch: Partial<Squad>) {
    setSquads(prev => prev.map(s => (s.id === squadId ? { ...s, ...patch } : s)));
  }

  function assignSlot(memberId: string | null) {
    if (!activeSquad || !selectedSlotId) return;
    const member = memberId ? roster.find(m => m.id === memberId) ?? null : null;
    const nextAssigned = { ...activeSquad.assigned };
    // 이미 다른 슬롯에 배정돼 있으면 해제
    for (const key of Object.keys(nextAssigned)) {
      if (nextAssigned[key]?.id === memberId) delete nextAssigned[key];
    }
    if (member) nextAssigned[selectedSlotId] = member;
    else delete nextAssigned[selectedSlotId];
    updateSquadLocal(activeSquad.id, { assigned: nextAssigned });
    setSelectedSlotId(null);
  }

  async function saveSquad() {
    if (!activeSquad) return;
    setSaving(true);
    await fetch(`/api/scrimmages/${id}/squads/${activeSquad.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formation_name: activeSquad.formation_name,
        formation_slots: activeSquad.formation_slots,
        assigned: activeSquad.assigned,
      }),
    });
    setSaving(false);
  }

  async function deleteScrimmage() {
    if (!confirm("이 내전을 삭제할까요?")) return;
    const res = await fetch(`/api/scrimmages/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/scrimmage");
  }

  async function shareLink() {
    const url = `${window.location.origin}/share/scrimmage/${id}`;
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // 취소 시 링크 복사로 폴백
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const t = document.createElement("textarea");
      t.value = url;
      t.style.cssText = "position:fixed;opacity:0;";
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      document.body.removeChild(t);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const unassigned = roster.filter(m => !squadMemberMap[m.id]);

  if (loading || !scrimmage) {
    return (
      <AppLayout title="내전">
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={scrimmage.title || "내전"}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">
              {scrimmage.match_date && new Date(scrimmage.match_date.replace(/-/g, "/")).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
              {" · "}{SPORT_LABEL[scrimmage.sport]} · {squads.length}파전
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={shareLink} className="flex items-center gap-1.5 text-xs bg-gray-900 border border-white/10 hover:border-white/20 text-gray-300 px-3 py-2 rounded-xl transition-colors">
              {linkCopied ? <Check size={14} className="text-emerald-400" /> : <Link2 size={14} />}
              {linkCopied ? "복사됨" : "공유"}
            </button>
            {canManage && (
              <button onClick={deleteScrimmage} className="text-gray-600 hover:text-red-400 p-2 rounded-xl transition-colors">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 팀 나누기 */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Users size={13} className="text-gray-500" />
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">팀 나누기</p>
          </div>
          <div className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
            {roster.map((m, i) => (
              <div key={m.id} className={`flex items-center justify-between px-4 py-3 ${i < roster.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                <span className="text-sm text-gray-200 truncate">{m.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {squads.map(s => (
                    <button
                      key={s.id}
                      disabled={!canManage}
                      onClick={() => assignMember(m.id, squadMemberMap[m.id] === s.id ? null : s.id)}
                      className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
                        squadMemberMap[m.id] === s.id
                          ? "bg-emerald-500 text-black"
                          : "bg-white/5 text-gray-500 hover:bg-white/10"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {unassigned.length > 0 && (
            <p className="text-[11px] text-gray-600 mt-2">미배정 {unassigned.length}명</p>
          )}
        </div>

        {/* 스쿼드 탭 */}
        <div>
          <div className="flex gap-2 mb-3">
            {squads.map(s => (
              <button
                key={s.id}
                onClick={() => { setActiveSquadId(s.id); setSelectedSlotId(null); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  activeSquadId === s.id ? "bg-emerald-500 text-black" : "bg-gray-900 border border-white/5 text-gray-400"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {activeSquad && (
            <div className="space-y-3">
              {canManage && (
                <select
                  value={activeSquad.formation_name ?? ""}
                  onChange={e => applyFormation(e.target.value)}
                  className="w-full bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                >
                  <option value="" disabled>포메이션 선택</option>
                  {availableFormationNames.map(n => <option key={n} value={n}>{n}</option>)}
                  {customFormations.length > 0 && (
                    <optgroup label="커스텀">
                      {customFormations.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                    </optgroup>
                  )}
                </select>
              )}

              {activeSquad.formation_slots ? (
                <>
                  <div
                    className="relative w-full rounded-lg overflow-hidden select-none"
                    style={{ paddingBottom: "130%", background: "linear-gradient(180deg, #166534 0%, #14532d 40%, #15803d 60%, #166534 100%)" }}
                  >
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute border border-white/20 inset-[3%] rounded-sm" />
                      <div className="absolute w-full border-t border-white/20" style={{ top: "50%" }} />
                      <div className="absolute border border-white/20 rounded-full" style={{ width: "20%", height: "14%", top: "43%", left: "40%" }} />
                    </div>
                    {activeSquad.formation_slots.map(slot => {
                      const member = activeSquad.assigned[slot.id];
                      return (
                        <div
                          key={slot.id}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 cursor-pointer"
                          style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                          onClick={() => canManage && setSelectedSlotId(slot.id === selectedSlotId ? null : slot.id)}
                        >
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs shadow-lg border-2 transition-transform ${
                            selectedSlotId === slot.id
                              ? "bg-yellow-400 border-yellow-300 text-gray-900 scale-110"
                              : member
                              ? "bg-emerald-400 border-emerald-300 text-gray-900"
                              : "bg-white/15 border-white/25 text-white/60"
                          }`}>
                            {slot.label}
                          </div>
                          {member && <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap">{member.name}</span>}
                        </div>
                      );
                    })}
                  </div>

                  {selectedSlotId && canManage && (
                    <div className="bg-gray-900 border border-white/5 rounded-lg p-3">
                      <p className="text-[11px] text-gray-500 mb-2">{selectedSlotId} 자리에 배정할 선수</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => assignSlot(null)} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10">미배정</button>
                        {roster.filter(m => squadMemberMap[m.id] === activeSquad.id).map(m => (
                          <button
                            key={m.id}
                            onClick={() => assignSlot(m.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-200 hover:bg-emerald-500/20 hover:text-emerald-300"
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {canManage && (
                    <button
                      onClick={saveSquad}
                      disabled={saving}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black py-3 rounded-xl font-bold transition-colors"
                    >
                      {saving ? "저장 중..." : `${activeSquad.name} 저장`}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-600 text-sm">
                  <Swords size={28} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
                  {canManage ? "포메이션을 선택해주세요" : "아직 포메이션이 설정되지 않았어요"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
