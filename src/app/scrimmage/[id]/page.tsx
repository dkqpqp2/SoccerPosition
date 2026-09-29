"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Swords, Link2, Check, Trash2, Users, Trophy, X, Zap, Plus } from "lucide-react";
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
  captain_member_id: string | null;
  sort_order: number;
  redacted: boolean;
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

interface Fixture {
  id: string;
  squad_a_id: string;
  squad_b_id: string;
  score_a: number | null;
  score_b: number | null;
}

interface StatEntry {
  member_id: string;
  goals: number;
  assists: number;
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
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, { goals: number; assists: number }>>({});
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsDraft, setStatsDraft] = useState<StatEntry[]>([]);
  const [statsSaving, setStatsSaving] = useState(false);
  const [addedMercenaryIds, setAddedMercenaryIds] = useState<Set<string>>(new Set());
  const [showMercenaryPicker, setShowMercenaryPicker] = useState(false);
  const [myCaptainSquadId, setMyCaptainSquadId] = useState<string | null>(null);
  const [mySquadId, setMySquadId] = useState<string | null>(null);
  const [editLinkCopied, setEditLinkCopied] = useState(false);
  const [notFound, setNotFound] = useState(false);

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
    // 내전 생성·관리는 관리자·매니저·회장만 가능
    setCanManage(data.role === "owner" || data.role === "manager" || data.role === "president");
  }

  async function fetchDetail() {
    setLoading(true);
    const res = await fetch(`/api/scrimmages/${id}`);
    if (!res.ok) { setLoading(false); setNotFound(true); return; }
    const data = await res.json();
    setScrimmage(data.scrimmage);
    setSquads(data.squads ?? []);
    setRoster(data.roster ?? []);
    const map: Record<string, string> = {};
    for (const sm of data.squad_members ?? []) map[sm.member_id] = sm.squad_id;
    setSquadMemberMap(map);
    setFixtures(data.fixtures ?? []);
    const sm: Record<string, { goals: number; assists: number }> = {};
    for (const s of data.stats ?? []) sm[s.member_id] = { goals: s.goals, assists: s.assists };
    setStatsMap(sm);
    setMyCaptainSquadId(data.my_captain_squad_id ?? null);
    setMySquadId(data.my_squad_id ?? null);
    setActiveSquadId(prev => prev ?? data.my_captain_squad_id ?? data.my_squad_id ?? (data.squads?.[0]?.id ?? null));
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
  const canEditActiveSquad = canManage || (!!activeSquad && myCaptainSquadId === activeSquad.id);

  const regularRoster = roster.filter(m => !m.is_mercenary);
  const mercenaryPool = roster.filter(m => m.is_mercenary);
  const visibleMercenaries = mercenaryPool.filter(m => addedMercenaryIds.has(m.id) || squadMemberMap[m.id]);
  const availableMercenaries = mercenaryPool.filter(m => !addedMercenaryIds.has(m.id) && !squadMemberMap[m.id]);
  const teamSplitRoster = [...regularRoster, ...visibleMercenaries];

  function addMercenary(memberId: string) {
    setAddedMercenaryIds(prev => new Set(prev).add(memberId));
    setShowMercenaryPicker(false);
  }

  async function setCaptain(memberId: string | null) {
    if (!activeSquad) return;
    const patch: Partial<Squad> = { captain_member_id: memberId };
    if (memberId) {
      const captain = teamSplitRoster.find(m => m.id === memberId);
      if (captain) patch.name = `${captain.name}팀`;
    }
    updateSquadLocal(activeSquad.id, patch);
    await fetch(`/api/scrimmages/${id}/squads/${activeSquad.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

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

  function updateFixtureLocal(fixtureId: string, patch: Partial<Fixture>) {
    setFixtures(prev => prev.map(f => (f.id === fixtureId ? { ...f, ...patch } : f)));
  }

  async function saveFixtureScore(fixtureId: string, scoreA: number | null, scoreB: number | null) {
    await fetch(`/api/scrimmages/${id}/fixtures/${fixtureId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score_a: scoreA, score_b: scoreB }),
    });
  }

  const standings = useMemo(() => {
    const table: Record<string, { squadId: string; name: string; w: number; d: number; l: number; gf: number; ga: number; pts: number }> = {};
    for (const s of squads) table[s.id] = { squadId: s.id, name: s.name, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    for (const f of fixtures) {
      if (f.score_a === null || f.score_b === null) continue;
      const a = table[f.squad_a_id];
      const b = table[f.squad_b_id];
      if (!a || !b) continue;
      a.gf += f.score_a; a.ga += f.score_b;
      b.gf += f.score_b; b.ga += f.score_a;
      if (f.score_a > f.score_b) { a.w++; a.pts += 3; b.l++; }
      else if (f.score_a < f.score_b) { b.w++; b.pts += 3; a.l++; }
      else { a.d++; b.d++; a.pts++; b.pts++; }
    }
    return Object.values(table).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga));
  }, [squads, fixtures]);

  function openStatsModal() {
    const draft: StatEntry[] = roster
      .filter(m => squadMemberMap[m.id])
      .map(m => ({ member_id: m.id, goals: statsMap[m.id]?.goals ?? 0, assists: statsMap[m.id]?.assists ?? 0 }));
    setStatsDraft(draft);
    setShowStatsModal(true);
  }

  function updateStatDraft(memberId: string, field: "goals" | "assists", delta: number) {
    setStatsDraft(prev => prev.map(e => (e.member_id === memberId ? { ...e, [field]: Math.max(0, e[field] + delta) } : e)));
  }

  async function saveStats() {
    setStatsSaving(true);
    await fetch(`/api/scrimmages/${id}/stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stats: statsDraft }),
    });
    const sm: Record<string, { goals: number; assists: number }> = {};
    for (const e of statsDraft) if (e.goals > 0 || e.assists > 0) sm[e.member_id] = { goals: e.goals, assists: e.assists };
    setStatsMap(sm);
    setStatsSaving(false);
    setShowStatsModal(false);
  }

  async function deleteScrimmage() {
    if (!confirm("이 내전을 삭제할까요?")) return;
    const res = await fetch(`/api/scrimmages/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/scrimmage");
  }

  async function copyOrShareLink(url: string) {
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ url });
        return true;
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
    return false;
  }

  async function shareLink() {
    await copyOrShareLink(`${window.location.origin}/share/scrimmage/${id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function shareEditLink() {
    await copyOrShareLink(`${window.location.origin}/scrimmage/${id}`);
    setEditLinkCopied(true);
    setTimeout(() => setEditLinkCopied(false), 2000);
  }

  const unassigned = teamSplitRoster.filter(m => !squadMemberMap[m.id]);

  if (notFound) {
    return (
      <AppLayout title="내전">
        <div className="text-center py-24">
          <Swords size={40} strokeWidth={1.5} className="opacity-30 mx-auto mb-3" />
          <p className="text-gray-600">이 내전을 볼 수 없어요</p>
          <p className="text-sm text-gray-700 mt-1">관리자이거나 이 내전의 주장으로 지정된 경우에만 볼 수 있어요</p>
        </div>
      </AppLayout>
    );
  }

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
            {canManage && (
              <button onClick={openStatsModal} className="flex items-center gap-1.5 text-xs bg-gray-900 border border-white/10 hover:border-white/20 text-gray-300 px-3 py-2 rounded-xl transition-colors">
                <Trophy size={14} /> 골/어시
              </button>
            )}
            <button onClick={shareLink} className="flex items-center gap-1.5 text-xs bg-gray-900 border border-white/10 hover:border-white/20 text-gray-300 px-3 py-2 rounded-xl transition-colors">
              {linkCopied ? <Check size={14} className="text-emerald-400" /> : <Link2 size={14} />}
              {linkCopied ? "복사됨" : "공유"}
            </button>
            {canManage && (
              <button onClick={shareEditLink} className="flex items-center gap-1.5 text-xs bg-gray-900 border border-white/10 hover:border-white/20 text-gray-300 px-3 py-2 rounded-xl transition-colors">
                {editLinkCopied ? <Check size={14} className="text-emerald-400" /> : <Link2 size={14} />}
                {editLinkCopied ? "복사됨" : "주장 링크"}
              </button>
            )}
            {canManage && (
              <button onClick={deleteScrimmage} className="text-gray-600 hover:text-red-400 p-2 rounded-xl transition-colors">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 결과 */}
        {fixtures.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Trophy size={13} className="text-gray-500" />
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">결과</p>
            </div>
            <div className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden mb-3">
              {fixtures.map((f, i) => {
                const squadA = squads.find(s => s.id === f.squad_a_id);
                const squadB = squads.find(s => s.id === f.squad_b_id);
                return (
                  <div key={f.id} className={`flex items-center justify-center gap-3 px-4 py-3 ${i < fixtures.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                    <span className="text-sm text-gray-300 font-medium w-16 text-right truncate">{squadA?.name}</span>
                    {canManage ? (
                      <>
                        <input
                          type="number" min={0} inputMode="numeric"
                          value={f.score_a ?? ""}
                          onChange={e => updateFixtureLocal(f.id, { score_a: e.target.value === "" ? null : Number(e.target.value) })}
                          onBlur={() => saveFixtureScore(f.id, f.score_a, f.score_b)}
                          className="w-12 bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-center text-sm text-white focus:outline-none"
                        />
                        <span className="text-gray-600">:</span>
                        <input
                          type="number" min={0} inputMode="numeric"
                          value={f.score_b ?? ""}
                          onChange={e => updateFixtureLocal(f.id, { score_b: e.target.value === "" ? null : Number(e.target.value) })}
                          onBlur={() => saveFixtureScore(f.id, f.score_a, f.score_b)}
                          className="w-12 bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-center text-sm text-white focus:outline-none"
                        />
                      </>
                    ) : (
                      <span className="text-sm font-bold text-white">{f.score_a ?? "-"} : {f.score_b ?? "-"}</span>
                    )}
                    <span className="text-sm text-gray-300 font-medium w-16 truncate">{squadB?.name}</span>
                  </div>
                );
              })}
            </div>

            {/* 순위표 */}
            <div className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-600 border-b border-white/5">
                    <th className="text-left font-normal px-3 py-2">팀</th>
                    <th className="font-normal px-1.5 py-2">승</th>
                    <th className="font-normal px-1.5 py-2">무</th>
                    <th className="font-normal px-1.5 py-2">패</th>
                    <th className="font-normal px-1.5 py-2">득실</th>
                    <th className="font-normal px-2 py-2">승점</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr key={s.squadId} className={i < standings.length - 1 ? "border-b border-white/[0.03]" : ""}>
                      <td className="px-3 py-2 text-gray-200 font-medium">{s.name}</td>
                      <td className="text-center px-1.5 py-2 text-gray-400">{s.w}</td>
                      <td className="text-center px-1.5 py-2 text-gray-400">{s.d}</td>
                      <td className="text-center px-1.5 py-2 text-gray-400">{s.l}</td>
                      <td className="text-center px-1.5 py-2 text-gray-400">{s.gf - s.ga > 0 ? `+${s.gf - s.ga}` : s.gf - s.ga}</td>
                      <td className="text-center px-2 py-2 text-emerald-400 font-bold">{s.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 팀 나누기 */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Users size={13} className="text-gray-500" />
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">팀 나누기</p>
          </div>
          <div className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
            {teamSplitRoster.map((m, i) => (
              <div key={m.id} className={`flex items-center justify-between px-4 py-3 ${i < teamSplitRoster.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                <span className="text-sm text-gray-200 truncate flex items-center gap-1.5">
                  {m.name}
                  {m.is_mercenary && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                      <Zap size={9} /> 용병
                    </span>
                  )}
                </span>
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

          {canManage && (
            <div className="relative mt-2">
              <button
                onClick={() => setShowMercenaryPicker(v => !v)}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold px-1 py-1"
              >
                <Plus size={13} /> 용병 추가
              </button>
              {showMercenaryPicker && (
                <div className="absolute z-10 mt-1 left-0 bg-gray-900 border border-white/10 rounded-xl p-2 shadow-xl min-w-[160px]">
                  {availableMercenaries.length === 0 ? (
                    <p className="text-xs text-gray-600 px-2 py-1.5">
                      {mercenaryPool.length === 0 ? "등록된 용병이 없어요" : "추가할 용병이 없어요"}
                    </p>
                  ) : (
                    availableMercenaries.map(m => (
                      <button
                        key={m.id}
                        onClick={() => addMercenary(m.id)}
                        className="w-full text-left text-sm text-gray-200 hover:bg-white/5 px-2 py-1.5 rounded-lg"
                      >
                        {m.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

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
                  value={activeSquad.captain_member_id ?? ""}
                  onChange={e => setCaptain(e.target.value || null)}
                  className="w-full bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                >
                  <option value="">주장 선택 (선택 시 팀명이 자동으로 바뀌어요)</option>
                  {teamSplitRoster.filter(m => squadMemberMap[m.id] === activeSquad.id).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}

              {canEditActiveSquad && (
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

              {activeSquad.redacted ? (
                <div className="text-center py-12 text-gray-600 text-sm">
                  <Swords size={28} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
                  <p>이 팀 라인업은 비공개예요</p>
                  <p className="text-xs text-gray-700 mt-1">배정된 팀원만 볼 수 있어요</p>
                </div>
              ) : activeSquad.formation_slots ? (
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
                          onClick={() => canEditActiveSquad && setSelectedSlotId(slot.id === selectedSlotId ? null : slot.id)}
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

                  {selectedSlotId && canEditActiveSquad && (
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

                  {canEditActiveSquad && (
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
                  {canEditActiveSquad ? "포메이션을 선택해주세요" : "아직 포메이션이 설정되지 않았어요"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showStatsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowStatsModal(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">골/어시 기록</h2>
              <button onClick={() => setShowStatsModal(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>

            <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-2">
              {statsDraft.length === 0 ? (
                <p className="text-center text-xs text-gray-600 py-8">팀 배정된 선수가 없어요</p>
              ) : (
                statsDraft.map(entry => {
                  const member = roster.find(m => m.id === entry.member_id);
                  const squad = squads.find(s => s.id === squadMemberMap[entry.member_id]);
                  return (
                    <div key={entry.member_id} className="flex items-center justify-between bg-white/[0.03] rounded-xl px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-200 truncate">{member?.name}</p>
                        <p className="text-[10px] text-gray-600">{squad?.name}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-500">골</span>
                          <button onClick={() => updateStatDraft(entry.member_id, "goals", -1)} className="w-6 h-6 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10">-</button>
                          <span className="w-4 text-center text-sm font-bold text-white">{entry.goals}</span>
                          <button onClick={() => updateStatDraft(entry.member_id, "goals", 1)} className="w-6 h-6 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10">+</button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-500">어시</span>
                          <button onClick={() => updateStatDraft(entry.member_id, "assists", -1)} className="w-6 h-6 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10">-</button>
                          <span className="w-4 text-center text-sm font-bold text-white">{entry.assists}</span>
                          <button onClick={() => updateStatDraft(entry.member_id, "assists", 1)} className="w-6 h-6 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10">+</button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={saveStats}
              disabled={statsSaving}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black py-3 rounded-xl font-bold transition-colors mt-4"
            >
              {statsSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
