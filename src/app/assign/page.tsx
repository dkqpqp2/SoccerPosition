"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { FORMATIONS, Formation, PositionSlot, SOCCER_FORMATIONS, FUTSAL_FORMATIONS } from "@/lib/formations";
import KakaoShare from "@/components/KakaoShare";
import AppLayout from "@/components/AppLayout";

interface Member {
  id: string;
  user_id?: string | null;
  name: string;
  position_1st: string | null;
  position_2nd: string | null;
  is_mercenary?: boolean;
  is_cafe_mercenary?: boolean;
  referrer?: string | null;
}

type Step = "setup" | "conflict" | "result";

interface Conflict {
  label: string;
  slotIds: string[];
  candidates: Member[];
}

interface SlotPopup {
  slotId: string;
  label: string;
  currentMember: Member | null;
}

interface CustomFormation {
  id: string;
  name: string;
  slots: PositionSlot[];
}

interface SavedAssignment {
  id: string;
  session_name: string;
  formation_name: string;
  formation_id: string;
  formation_slots: PositionSlot[];
  result: Record<string, Member | null>;
  created_at: string;
}

function AssignContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get("matchId");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFormation, setSelectedFormation] = useState<string>("4-3-3");
  const [customFormations, setCustomFormations] = useState<CustomFormation[]>([]);
  const [step, setStep] = useState<Step>("setup");
  const [loadedFormationSlots, setLoadedFormationSlots] = useState<PositionSlot[] | null>(null);
  const [loadedAssignmentId, setLoadedAssignmentId] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<Record<string, Member | null>>({});
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [conflictChoices, setConflictChoices] = useState<Record<string, string>>({});
  const [popup, setPopup] = useState<SlotPopup | null>(null);
  const [teamColor] = useState("#facc15");
  const [matchInfo, setMatchInfo] = useState<{ match_date: string; match_time: string | null; match_end_time: string | null; location: string | null; title: string | null; uniform_info: string | null } | null>(null);
  const [rsvpAttendingUserIds, setRsvpAttendingUserIds] = useState<string[]>([]);
  const [savedAssignments, setSavedAssignments] = useState<SavedAssignment[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSessionName, setSaveSessionName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showFormationChange, setShowFormationChange] = useState(false);
  const [attendingIds, setAttendingIds] = useState<Set<string>>(new Set());
  const [showAttendModal, setShowAttendModal] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [otherEditors, setOtherEditors] = useState<string[]>([]);
  const [conflictAlert, setConflictAlert] = useState<string[] | null>(null);
  const sessionIdRef = useRef(Math.random().toString(36).slice(2));
  const prevOtherCountRef = useRef(0);

  const canManage = userRole === "owner" || userRole === "manager" || userRole === "coach" || userRole === "president";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") {
      fetchMembers();
      fetchCustomFormations();
      fetchSavedAssignments();
      fetchMatchInfo();
      fetchUserRole();
    }
  }, [status]);

  async function fetchSavedAssignments() {
    const url = matchId ? `/api/assignments?matchId=${matchId}` : "/api/assignments";
    const res = await fetch(url);
    const data = await res.json();
    setSavedAssignments(Array.isArray(data) ? data : []);
  }

  async function fetchMatchInfo() {
    if (!matchId) return;
    const res = await fetch("/api/matches");
    const data = await res.json();
    const match = data.find((m: { id: string }) => m.id === matchId);
    if (match) {
      setMatchInfo({ match_date: match.match_date, match_time: match.match_time ?? null, match_end_time: match.match_end_time ?? null, location: match.location ?? null, title: match.title, uniform_info: match.uniform_info ?? null });
      const attending = (match.rsvp_list ?? [])
        .filter((r: { status: string }) => r.status === "attending")
        .map((r: { user_id: string }) => r.user_id);
      setRsvpAttendingUserIds(attending);
    }
  }

  async function saveAssignment() {
    if (!saveSessionName.trim() || saving) return;
    setSaving(true);
    setSaveError("");
    if (loadedAssignmentId) {
      await fetch(`/api/assignments/${loadedAssignmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result: assigned,
          formation_name: formation.name,
          formation_id: selectedFormation,
          formation_slots: formation.slots,
          attending_members: attendingIds.size > 0 ? members.filter(m => attendingIds.has(m.id)) : undefined,
        }),
      });
    } else {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_name: saveSessionName,
          formation_name: formation.name,
          formation_id: selectedFormation,
          formation_slots: formation.slots,
          result: assigned,
          match_id: matchId || null,
          attending_members: attendingIds.size > 0 ? members.filter(m => attendingIds.has(m.id)) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSaveError(err.error ?? "저장에 실패했어요.");
        setSaving(false);
        return;
      }
    }
    setShowSaveModal(false);
    setSaveSessionName("");
    setSaveError("");
    setSaving(false);
    await fetchSavedAssignments();
    reset();
  }

  async function deleteAssignment(id: string) {
    if (!confirm("삭제할까요?")) return;
    await fetch(`/api/assignments/${id}`, { method: "DELETE" });
    fetchSavedAssignments();
  }

  function loadAssignment(saved: SavedAssignment) {
    if (saved.formation_id) setSelectedFormation(saved.formation_id);
    if (saved.formation_slots) setLoadedFormationSlots(saved.formation_slots);
    setAssigned(saved.result);
    setLoadedAssignmentId(saved.id);
    setSaveSessionName(saved.session_name);
    // attendingIds는 건드리지 않음 — 사용자가 설정한 참가 인원 유지
    // (attendingIds가 비어있을 때만 불러온 배정의 팀원으로 채워서 팝업이 동작하게)
    if (attendingIds.size === 0) {
      const assignedMemberIds = new Set(
        Object.values(saved.result).filter(Boolean).map(m => m!.id)
      );
      setAttendingIds(assignedMemberIds);
    }
    setStep("result");
  }

  async function fetchUserRole() {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    setUserRole(data.role ?? null);
    setUserName(data.name ?? "");
  }

  // Supabase Realtime presence — 같은 경기 배정 페이지에 있는 다른 사람 감지
  useEffect(() => {
    if (!matchId || !userName) return;
    const channel = supabaseClient.channel(`assign-${matchId}`, {
      config: { presence: { key: sessionIdRef.current } },
    });
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ name: string }>();
      const others = Object.entries(state)
        .filter(([key]) => key !== sessionIdRef.current)
        .flatMap(([, presences]) => presences.map((p) => p.name));
      setOtherEditors(others);
      // 작업자가 없던 상태에서 누군가 새로 들어오면 즉시 알림
      if (others.length > 0 && prevOtherCountRef.current === 0) {
        setConflictAlert(others);
      }
      prevOtherCountRef.current = others.length;
    });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ name: userName });
      }
    });
    return () => { supabaseClient.removeChannel(channel); };
  }, [matchId, userName]);

  async function fetchCustomFormations() {
    const res = await fetch("/api/formations");
    const data = await res.json();
    setCustomFormations(Array.isArray(data) ? data : []);
  }

  async function fetchMembers() {
    const res = await fetch("/api/members");
    const data = await res.json();
    const list: Member[] = Array.isArray(data) ? data : [];
    setMembers(list);
    if (matchId) {
      const attRes = await fetch(`/api/matches/attendees?matchId=${matchId}`);
      const attData = await attRes.json();
      setAttendingIds(attData.member_ids?.length > 0 ? new Set(attData.member_ids) : new Set());
    } else {
      setAttendingIds(new Set());
    }
    setLoading(false);
  }

  async function saveAttendees(ids: Set<string>) {
    if (!matchId) return;
    await fetch("/api/matches/attendees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ match_id: matchId, member_ids: [...ids] }) });
  }

  function toggleAttending(id: string) {
    setAttendingIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleAllAttending(all: boolean) {
    setAttendingIds(all ? new Set(members.map(m => m.id)) : new Set<string>());
  }

  async function confirmAttendees(ids: Set<string>) {
    setAttendingIds(ids);
    setShowAttendModal(false);
    await saveAttendees(ids);
  }

  function getUnassignedMembers(currentAssigned: Record<string, Member | null>, excludeSlotId?: string) {
    const assignedIds = new Set(Object.entries(currentAssigned).filter(([slotId, m]) => m && slotId !== excludeSlotId).map(([, m]) => m!.id));
    return members.filter(m => attendingIds.has(m.id) && !assignedIds.has(m.id));
  }

  const attendingMembers = members.filter(m => attendingIds.has(m.id));

  async function shareAttendees(attending: Member[]) {
    setShareToast(true);
    const res = await fetch("/api/share/attendees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ members: attending, match_info: matchInfo }) });
    if (!res.ok) { setShareToast(false); alert("공유 링크 생성에 실패했어요"); return; }
    const { id } = await res.json();
    const url = `${window.location.origin}/share/attendees/${id}`;
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share) await navigator.share({ url });
    else await navigator.clipboard.writeText(url);
    setTimeout(() => setShareToast(false), 2500);
  }

  function autoAssign() {
    const cf = customFormations.find(f => f.id === selectedFormation);
    const formation = cf ? { name: cf.name, slots: cf.slots } : FORMATIONS[selectedFormation] ?? FORMATIONS["4-3-3"];
    const slots = formation.slots;
    const result: Record<string, Member | null> = {};
    slots.forEach(s => result[s.id] = null);
    const assignedMemberIds = new Set<string>();
    const pool = attendingMembers;
    const labelSlots: Record<string, string[]> = {};
    for (const slot of slots) { if (!labelSlots[slot.label]) labelSlots[slot.label] = []; labelSlots[slot.label].push(slot.id); }
    const labelWanters: Record<string, Member[]> = {};
    for (const m of pool) { if (m.position_1st) { if (!labelWanters[m.position_1st]) labelWanters[m.position_1st] = []; labelWanters[m.position_1st].push(m); } }
    const conflictList: Conflict[] = [];
    for (const [label, slotIds] of Object.entries(labelSlots)) {
      const wanters = (labelWanters[label] || []).filter(m => !assignedMemberIds.has(m.id));
      if (wanters.length === 0) continue;
      if (wanters.length <= slotIds.length) { wanters.forEach((m, i) => { result[slotIds[i]] = m; assignedMemberIds.add(m.id); }); }
      else { conflictList.push({ label, slotIds, candidates: wanters }); }
    }
    const conflictMemberIds = new Set(conflictList.flatMap(c => c.candidates.map(m => m.id)));
    for (const slot of slots) {
      if (result[slot.id]) continue;
      const inConflict = conflictList.some(c => c.slotIds.includes(slot.id));
      if (inConflict) continue;
      const wants = pool.filter(m => m.position_2nd === slot.label && !assignedMemberIds.has(m.id) && !conflictMemberIds.has(m.id));
      if (wants.length >= 1) { result[slot.id] = wants[0]; assignedMemberIds.add(wants[0].id); }
    }
    setAssigned(result);
    if (conflictList.length > 0) { setConflicts(conflictList); setStep("conflict"); } else { setStep("result"); }
  }

  function resolveConflicts() {
    const updated = { ...assigned };
    const assignedMemberIds = new Set(Object.values(updated).filter(Boolean).map(m => m!.id));
    for (const conflict of conflicts) {
      const chosenId = conflictChoices[conflict.label];
      if (!chosenId) return;
      const chosenMember = conflict.candidates.find(m => m.id === chosenId)!;
      updated[conflict.slotIds[0]] = chosenMember;
      assignedMemberIds.add(chosenMember.id);
      const remaining = conflict.candidates.filter(m => m.id !== chosenId);
      remaining.forEach((m, i) => { const slotId = conflict.slotIds[i + 1]; if (slotId) { updated[slotId] = m; assignedMemberIds.add(m.id); } });
    }
    const cf = customFormations.find(f => f.id === selectedFormation);
    const curFormation: Formation = cf ? { name: cf.name, slots: cf.slots } : FORMATIONS[selectedFormation] ?? FORMATIONS["4-3-3"];
    for (const slot of curFormation.slots) {
      if (updated[slot.id]) continue;
      const wants = attendingMembers.filter(m => m.position_2nd === slot.label && !assignedMemberIds.has(m.id));
      if (wants.length > 0) { updated[slot.id] = wants[0]; assignedMemberIds.add(wants[0].id); }
    }
    const seen = new Set<string>();
    for (const slotId of Object.keys(updated)) {
      const m = updated[slotId];
      if (!m) continue;
      if (seen.has(m.id)) updated[slotId] = null;
      else seen.add(m.id);
    }
    setAssigned(updated);
    setStep("result");
  }

  function handleSlotClick(slot: PositionSlot) {
    setPopup({ slotId: slot.id, label: slot.label, currentMember: assigned[slot.id] ?? null });
  }

  function handleAssignMember(memberId: string) {
    if (!popup) return;
    const member = members.find(m => m.id === memberId)!;
    setAssigned(prev => {
      const next = { ...prev };
      // 이 팀원이 다른 슬롯에 배정돼 있으면 그곳을 비워서 스왑
      for (const [slotId, m] of Object.entries(next)) {
        if (m?.id === memberId && slotId !== popup.slotId) {
          next[slotId] = null;
          break;
        }
      }
      next[popup.slotId] = member;
      return next;
    });
    setPopup(null);
  }

  function handleRemoveMember() {
    if (!popup) return;
    setAssigned(prev => ({ ...prev, [popup.slotId]: null }));
    setPopup(null);
  }

  function reset() {
    setStep("setup"); setAssigned({}); setConflicts([]); setConflictChoices({});
    setPopup(null); setLoadedFormationSlots(null); setLoadedAssignmentId(null); setSaveSessionName("");
    setShowFormationChange(false);
  }

  /** result 단계에서 포메이션 변경 — 기존 배정은 슬롯 ID가 같은 것만 유지 */
  function changeFormationInResult(newFormationId: string) {
    const cf = customFormations.find(f => f.id === newFormationId);
    const newFormation = cf
      ? { name: cf.name, slots: cf.slots }
      : FORMATIONS[newFormationId] ?? FORMATIONS["4-3-3"];

    setSelectedFormation(newFormationId);
    setLoadedFormationSlots(null); // 커스텀 슬롯 초기화

    // 새 포메이션의 슬롯 중 기존 배정이 있으면 유지, 없으면 null
    setAssigned(prev => {
      const next: Record<string, Member | null> = {};
      for (const slot of newFormation.slots) {
        next[slot.id] = prev[slot.id] ?? null;
      }
      return next;
    });

    setShowFormationChange(false);
  }

  const customFormation = customFormations.find(f => f.id === selectedFormation);
  const formation: Formation = customFormation
    ? { name: customFormation.name, slots: customFormation.slots }
    : FORMATIONS[selectedFormation]
    ? FORMATIONS[selectedFormation]
    : loadedFormationSlots
    ? { name: selectedFormation, slots: loadedFormationSlots }
    : FORMATIONS["4-3-3"];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-950"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const mercenaryIds = new Set(members.filter(m => m.is_mercenary).map(m => m.id));

  return (
    <AppLayout title={matchInfo ? `포지션 배정 · ${new Date(matchInfo.match_date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}` : "포지션 배정"} helpContent={{ items: [
      { icon: "👥", title: "참가자 선택", desc: "왼쪽 팀원 목록에서 이번 경기에 참가하는 선수를 선택해요." },
      { icon: "🎯", title: "포지션 배정", desc: "선수를 드래그하거나 포지션 슬롯을 클릭해 배정해요. 선호 포지션이 자동으로 추천돼요." },
      { icon: "⚡", title: "자동 배정", desc: "자동 배정 버튼을 누르면 선호 포지션 기반으로 AI가 최적 배치를 추천해요." },
      { icon: "📋", title: "쿼터 관리", desc: "쿼터를 추가해 전반·후반·쿼터별로 다른 배정을 저장할 수 있어요." },
      { icon: "🔗", title: "공유", desc: "저장 후 공유 링크를 팀원들에게 보내면 배정 결과를 확인할 수 있어요." },
    ]}}>

      {/* 상단 서브바 */}
      <div className="flex items-center px-4 py-2 border-b border-white/5 bg-gray-900/60 backdrop-blur-sm sticky top-0 z-10 gap-3">
        <button onClick={() => matchId ? router.push("/matches") : router.push("/dashboard")} className="text-gray-500 hover:text-white text-sm shrink-0 transition-colors">← 뒤로</button>
        {matchInfo && (
          <p className="text-xs text-gray-500 truncate">
            📅 {new Date(matchInfo.match_date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" })}
            {matchInfo.title && ` · ${matchInfo.title}`}
          </p>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 lg:px-6 lg:py-6">

        {/* 동시 편집 경고 */}
        {otherEditors.length > 0 && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 flex items-start gap-2.5">
            <span className="text-base shrink-0 mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-300">
                {otherEditors.join(", ")}님이 지금 이 배정 페이지에 있어요
              </p>
              <p className="text-xs text-amber-400/70 mt-0.5">같은 쿼터 이름으로 동시에 저장하면 충돌할 수 있어요. 서로 확인 후 진행하세요.</p>
            </div>
          </div>
        )}

        {/* STEP 1: 포메이션 선택 */}
        {step === "setup" && (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-start">

            {/* 왼쪽: 저장된 배정 이력 */}
            <div className="w-full lg:w-52 lg:shrink-0 lg:sticky lg:top-20 flex flex-col gap-3">
              <button
                className="lg:hidden flex items-center justify-between bg-gray-900 border border-white/5 rounded-xl px-4 py-3"
                onClick={() => setShowHistoryMobile(p => !p)}
              >
                <span className="text-sm font-bold text-white">📋 배정 이력 ({savedAssignments.length})</span>
                <span className="text-gray-400 text-sm">{showHistoryMobile ? "▲" : "▼"}</span>
              </button>

              <div className={`${showHistoryMobile ? "flex" : "hidden"} lg:flex flex-col gap-3`}>
                <p className="hidden lg:block text-xs font-bold text-gray-600 uppercase tracking-widest">배정 이력</p>
                {savedAssignments.length === 0 ? (
                  <div className="bg-gray-900 border border-white/5 rounded-xl p-4 text-center text-gray-600 text-xs">저장된 이력 없음</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {savedAssignments.map(s => (
                      <div key={s.id} className="bg-gray-900 border border-white/5 rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="font-bold text-white text-sm">{s.session_name}</p>
                          <button onClick={() => deleteAssignment(s.id)} className="text-xs text-red-400 hover:text-red-300">삭제</button>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{s.formation_name}</p>
                        <button onClick={() => loadAssignment(s)} className="w-full text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold py-1.5 rounded-lg transition-colors border border-emerald-500/20">
                          불러오기
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {savedAssignments.length > 0 && (
                  <button
                    onClick={() => setShowStatsModal(true)}
                    className="w-full flex items-center justify-between bg-gray-900 border border-white/5 rounded-xl px-4 py-3 hover:border-white/10 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">📊</span>
                      <div className="text-left">
                        <p className="text-sm font-bold text-white">참여 현황</p>
                        <p className="text-xs text-gray-600">{savedAssignments.length}쿼터</p>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-400 font-semibold">보기 →</span>
                  </button>
                )}
              </div>
            </div>

            {/* 가운데 + 오른쪽 */}
            <div className="flex-1 min-w-0 w-full flex flex-col lg:flex-row gap-4 lg:gap-5">

              {/* 가운데: 그라운드 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">포메이션 선택</p>
                  {canManage && <button onClick={() => router.push("/formations")} className="text-xs text-emerald-400 hover:text-emerald-300">+ 포메이션 만들기</button>}
                </div>
                <FormationSelect value={selectedFormation} onChange={setSelectedFormation} customFormations={customFormations} />
                <FieldView formation={formation} assigned={{}} preview teamColor={teamColor} mercenaryIds={new Set()} />
              </div>

              {/* 오른쪽: 참가자 + 배정 버튼 */}
              <div className="w-full lg:w-60 lg:shrink-0 flex flex-col gap-3 lg:sticky lg:top-20">
                {members.length === 0 ? (
                  <div className="bg-gray-900 border border-white/5 rounded-2xl p-5 text-center">
                    <p className="text-sm text-gray-500">팀원이 없어요!</p>
                    <button onClick={() => router.push("/members")} className="mt-2 text-emerald-400 underline text-sm">팀원 추가하러 가기</button>
                  </div>
                ) : (
                  <>
                    {/* 참가 인원 카드 */}
                    <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/5 flex flex-col gap-2">
                        <p className="text-sm font-bold text-white">
                          오늘 참가 인원
                          <span className="text-gray-600 font-normal mx-1.5">/</span>
                          <span className="text-emerald-400 text-xs font-semibold">{attendingIds.size}명</span><span className="text-gray-500 text-xs font-normal"> 참가</span>
                        </p>
                        <div className="flex gap-1.5">
                          {attendingIds.size > 0 && (
                            <button onClick={() => shareAttendees(attendingMembers)} className="flex-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-semibold py-2 rounded-lg border border-blue-500/20 transition-colors">공유</button>
                          )}
                          {canManage && (
                            <button onClick={() => setShowAttendModal(true)} className="flex-1 text-xs bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2 rounded-lg transition-colors">✏️ 설정</button>
                          )}
                        </div>
                        {canManage && matchId && rsvpAttendingUserIds.length > 0 && (
                          <button
                            onClick={() => {
                              const rsvpMemberIds = members
                                .filter(m => !m.is_mercenary && m.user_id && rsvpAttendingUserIds.includes(m.user_id))
                                .map(m => m.id);
                              setAttendingIds(prev => {
                                const merged = new Set(prev);
                                rsvpMemberIds.forEach(id => merged.add(id));
                                saveAttendees(merged);
                                return merged;
                              });
                            }}
                            className="w-full text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold py-2 rounded-lg border border-amber-500/20 transition-colors"
                          >
                            ✅ 참석자 추가하기 ({rsvpAttendingUserIds.length}명)
                          </button>
                        )}
                      </div>

                      {attendingIds.size === 0 ? (
                        <div className="px-4 py-5 text-center">
                          <p className="text-xs text-gray-600">참가 인원을 설정해주세요</p>
                          {canManage && <button onClick={() => setShowAttendModal(true)} className="mt-2 text-xs text-emerald-400 font-semibold hover:text-emerald-300">+ 참가자 선택하기</button>}
                        </div>
                      ) : (
                        <div>
                          {(() => {
                            const regular = attendingMembers.filter(m => !m.is_mercenary);
                            return regular.length > 0 ? (
                              <div>
                                <p className="text-xs font-semibold text-gray-600 px-4 pt-3 pb-1">정규 팀원 ({regular.length}명)</p>
                                <div className="flex flex-col px-3 pb-2 gap-0.5">
                                  {regular.map(m => (
                                    <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/3">
                                      <span className="text-sm font-medium text-white">{m.name}</span>
                                      <div className="flex gap-1">
                                        {m.position_1st && <span className="text-xs bg-emerald-500/15 text-emerald-400 px-1.5 rounded-full border border-emerald-500/20">{m.position_1st}</span>}
                                        {m.position_2nd && <span className="text-xs bg-blue-500/15 text-blue-400 px-1.5 rounded-full border border-blue-500/20">{m.position_2nd}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          })()}
                          {(() => {
                            const mercenary = attendingMembers.filter(m => m.is_mercenary);
                            return mercenary.length > 0 ? (
                              <div className="border-t border-white/5">
                                <p className="text-xs font-semibold text-amber-400 px-4 pt-3 pb-1">⚡ 용병 ({mercenary.length}명)</p>
                                <div className="flex flex-col px-3 pb-3 gap-0.5">
                                  {mercenary.map(m => (
                                    <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-sm font-medium text-amber-300">{m.name}</span>
                                        {m.is_cafe_mercenary ? <span className="text-xs text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-full">☕카페</span>
                                          : m.referrer ? <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{m.referrer}지인</span> : null}
                                      </div>
                                      <div className="flex gap-1">
                                        {m.position_1st && <span className="text-xs bg-emerald-500/15 text-emerald-400 px-1.5 rounded-full border border-emerald-500/20">{m.position_1st}</span>}
                                        {m.position_2nd && <span className="text-xs bg-blue-500/15 text-blue-400 px-1.5 rounded-full border border-blue-500/20">{m.position_2nd}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>

                    {canManage && (
                      <button
                        onClick={autoAssign}
                        disabled={attendingIds.size === 0}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-600 text-black py-4 rounded-2xl font-bold text-base transition-colors shadow-lg shadow-emerald-500/20"
                      >
                        🎲 자동 배정 시작
                        {attendingIds.size > 0 && <span className="text-sm font-normal ml-1 opacity-70">({attendingIds.size}명)</span>}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: 충돌 해결 */}
        {step === "conflict" && (
          <div className="max-w-lg mx-auto">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-4">
              <h2 className="font-bold text-amber-400 text-sm mb-0.5">⚠️ 포지션 겹침!</h2>
              <p className="text-amber-300/70 text-xs">슬롯보다 희망자가 많아요. 우선순위 1명만 선택해주세요. 나머지는 자동 배정돼요.</p>
            </div>
            <div className="flex flex-col gap-3">
              {conflicts.map(conflict => (
                <div key={conflict.label} className="bg-gray-900 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-sm font-bold">{conflict.label}</span>
                    <span className="text-sm text-gray-500">슬롯 {conflict.slotIds.length}개 · 희망자 {conflict.candidates.length}명</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {conflict.candidates.map(m => (
                      <button key={m.id} onClick={() => setConflictChoices(prev => ({ ...prev, [conflict.label]: m.id }))}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${conflictChoices[conflict.label] === m.id ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-white/10 hover:border-white/20 text-gray-300 bg-white/5"}`}>
                        {m.name}{conflictChoices[conflict.label] === m.id && <span className="ml-1">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={resolveConflicts} disabled={conflicts.some(c => !conflictChoices[c.label])}
              className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-600 text-black py-3 rounded-xl font-bold transition-colors">
              배정 완료
            </button>
          </div>
        )}

        {/* STEP 3: 결과 */}
        {step === "result" && (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-start">

            <div className="w-full lg:w-52 lg:shrink-0 lg:sticky lg:top-20 flex flex-col gap-3">
              <button onClick={reset} className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-white transition-colors">
                ← 배정으로 돌아가기
              </button>
              <button className="lg:hidden flex items-center justify-between bg-gray-900 border border-white/5 rounded-xl px-4 py-3" onClick={() => setShowHistoryMobile(p => !p)}>
                <span className="text-sm font-bold text-white">📋 배정 이력 ({savedAssignments.length})</span>
                <span className="text-gray-400 text-sm">{showHistoryMobile ? "▲" : "▼"}</span>
              </button>
              <div className={`${showHistoryMobile ? "flex" : "hidden"} lg:flex flex-col gap-3`}>
                <p className="hidden lg:block text-xs font-bold text-gray-600 uppercase tracking-widest">배정 이력</p>
                {savedAssignments.length === 0 ? (
                  <div className="bg-gray-900 border border-white/5 rounded-xl p-4 text-center text-gray-600 text-xs">저장된 이력 없음</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {savedAssignments.map(s => (
                      <div key={s.id} className="bg-gray-900 border border-white/5 rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="font-bold text-white text-sm">{s.session_name}</p>
                          <button onClick={() => deleteAssignment(s.id)} className="text-xs text-red-400 hover:text-red-300">삭제</button>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{s.formation_name}</p>
                        <button onClick={() => loadAssignment(s)} className="w-full text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold py-1.5 rounded-lg transition-colors border border-emerald-500/20">불러오기</button>
                      </div>
                    ))}
                  </div>
                )}
                {savedAssignments.length > 0 && (
                  <button onClick={() => setShowStatsModal(true)} className="w-full flex items-center justify-between bg-gray-900 border border-white/5 rounded-xl px-4 py-3 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <span>📊</span>
                      <div className="text-left"><p className="text-sm font-bold text-white">참여 현황</p><p className="text-xs text-gray-600">{savedAssignments.length}쿼터</p></div>
                    </div>
                    <span className="text-xs text-emerald-400 font-semibold">보기 →</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 w-full flex flex-col lg:flex-row gap-4 lg:gap-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">🏆 {formation.name}</p>
                    {canManage && (
                      <button
                        onClick={() => setShowFormationChange(v => !v)}
                        className="text-xs text-gray-500 hover:text-emerald-400 bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 px-2 py-1 rounded-lg transition-colors"
                      >
                        변경
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-gray-600">슬롯을 눌러 수정</span>
                </div>

                {/* 포메이션 변경 드롭다운 */}
                {showFormationChange && (
                  <div className="mb-3">
                    <FormationSelect
                      value={selectedFormation}
                      onChange={changeFormationInResult}
                      customFormations={customFormations}
                    />
                  </div>
                )}

                <FieldView formation={formation} assigned={assigned} onSlotClick={handleSlotClick} teamColor={teamColor} mercenaryIds={mercenaryIds} />
              </div>

              <div className="w-full lg:w-60 lg:shrink-0 flex flex-col gap-3 lg:sticky lg:top-20">
                {(() => {
                  const regular = attendingMembers.filter(m => !m.is_mercenary);
                  const mercenary = attendingMembers.filter(m => m.is_mercenary);
                  const assignedIds = new Set(Object.values(assigned).filter(Boolean).map(m => m!.id));
                  return (
                    <>
                      {regular.length > 0 && (
                        <div className="bg-gray-900 border border-white/5 rounded-2xl p-4">
                          <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">정규 팀원 ({regular.length}명)</p>
                          <div className="flex flex-col gap-1">
                            {regular.map(m => (
                              <div key={m.id} className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${assignedIds.has(m.id) ? "bg-emerald-500/10" : "bg-amber-500/5 border border-amber-500/10"}`}>
                                <span className={`text-sm font-medium ${assignedIds.has(m.id) ? "text-white" : "text-amber-400"}`}>{m.name}</span>
                                {assignedIds.has(m.id) ? <span className="text-xs text-emerald-400">✓</span> : <span className="text-xs text-amber-400">미배정</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {mercenary.length > 0 && (
                        <div className="bg-gray-900 border border-amber-500/20 rounded-2xl p-4">
                          <p className="text-xs font-bold text-amber-400 mb-2 uppercase tracking-wider">⚡ 용병 ({mercenary.length}명)</p>
                          <div className="flex flex-col gap-1">
                            {mercenary.map(m => (
                              <div key={m.id} className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${assignedIds.has(m.id) ? "bg-emerald-500/10" : "bg-amber-500/5"}`}>
                                <span className={`text-sm font-medium ${assignedIds.has(m.id) ? "text-amber-300" : "text-amber-400/60"}`}>{m.name}</span>
                                {assignedIds.has(m.id) ? <span className="text-xs text-emerald-400">✓</span> : <span className="text-xs text-amber-400/50">미배정</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
                {canManage && (
                  <button
                    onClick={() => { if (!loadedAssignmentId) setSaveSessionName(`${savedAssignments.length + 1}쿼터`); setShowSaveModal(true); }}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-3 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/20"
                  >
                    💾 이 배정 저장
                  </button>
                )}
                {loadedAssignmentId && (
                  <div className="flex gap-2">
                    <KakaoShare assignmentId={loadedAssignmentId} sessionName={saveSessionName} formationName={formation.name} matchTitle={matchInfo?.title} matchDate={matchInfo?.match_date} />
                    <button
                      onClick={async () => {
                        const url = `${window.location.origin}/share/${loadedAssignmentId}`;
                        try { await navigator.clipboard.writeText(url); } catch {
                          const t = document.createElement("textarea");
                          t.value = url; t.style.position = "fixed"; t.style.opacity = "0";
                          document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t);
                        }
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2500);
                      }}
                      className={`shrink-0 px-4 py-3 rounded-xl font-bold text-sm transition-colors border whitespace-nowrap ${linkCopied ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "bg-white/5 hover:bg-white/10 border-white/10 text-gray-400"}`}
                    >
                      {linkCopied ? "✓" : "🔗"} 링크
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 참여 현황 모달 */}
      {showStatsModal && (() => {
        const memberQuarters: Record<string, { name: string; isMercenary: boolean; quarters: boolean[] }> = {};
        savedAssignments.forEach((s, qIdx) => {
          for (const member of Object.values(s.result)) {
            if (!member) continue;
            if (!memberQuarters[member.id]) {
              const m = members.find(x => x.id === member.id);
              memberQuarters[member.id] = { name: member.name, isMercenary: m?.is_mercenary || false, quarters: Array(savedAssignments.length).fill(false) };
            }
            memberQuarters[member.id].quarters[qIdx] = true;
          }
        });
        const sorted = Object.values(memberQuarters).sort((a, b) => b.quarters.filter(Boolean).length - a.quarters.filter(Boolean).length);
        const total = savedAssignments.length;
        const quarterLabels = savedAssignments.map((s, i) => s.session_name.replace(/[^0-9]/g, "") || String(i + 1));
        return (
          <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto" onClick={() => setShowStatsModal(false)}>
            <div className="flex min-h-full items-center justify-center px-4 py-6">
            <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div><h3 className="font-bold text-white text-lg">📊 참여 현황</h3><p className="text-xs text-gray-500 mt-0.5">총 {total}쿼터 · {sorted.length}명</p></div>
                <button onClick={() => setShowStatsModal(false)} className="text-gray-500 hover:text-white text-xl font-bold">✕</button>
              </div>
              <div className="px-6 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-24 shrink-0">이름</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {quarterLabels.map((label, i) => <span key={i} className="text-xs font-bold bg-white/5 text-gray-500 rounded px-2 py-0.5 min-w-[24px] text-center">{label}Q</span>)}
                  </div>
                  <span className="text-xs text-gray-500 ml-auto shrink-0">합계</span>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 px-6 pb-6">
                <div className="flex flex-col gap-1">
                  {sorted.map((p, idx) => {
                    const count = p.quarters.filter(Boolean).length;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={idx} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
                        <span className={`text-sm font-medium w-24 shrink-0 truncate ${p.isMercenary ? "text-amber-400" : "text-white"}`}>
                          {p.name}{p.isMercenary && <span className="text-xs ml-0.5">⚡</span>}
                        </span>
                        <div className="flex gap-1.5 flex-wrap flex-1">
                          {p.quarters.map((played, i) => played
                            ? <span key={i} className="text-xs font-bold bg-emerald-500 text-black rounded px-1.5 py-0.5 min-w-[24px] text-center">{quarterLabels[i]}</span>
                            : <span key={i} className="text-xs bg-white/5 text-gray-600 rounded px-1.5 py-0.5 min-w-[24px] text-center">{quarterLabels[i]}</span>
                          )}
                        </div>
                        <div className="shrink-0 text-right w-16">
                          <span className="text-xs font-bold text-white">{count}<span className="text-gray-600 font-normal">/{total}</span></span>
                          <div className="mt-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#10b981" : pct >= 50 ? "#facc15" : "#f87171" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="px-6 pb-5">
                <button onClick={() => setShowStatsModal(false)} className="w-full bg-white/5 hover:bg-white/10 text-gray-400 font-semibold py-2.5 rounded-xl transition-colors">닫기</button>
              </div>
            </div>
            </div>
          </div>
        );
      })()}

      {/* 참가 인원 선택 모달 */}
      {showAttendModal && (
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto" onClick={() => setShowAttendModal(false)}>
          <div className="flex min-h-full items-center justify-center px-4 py-6">
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">참가 인원 선택</h3>
                <p className="text-xs text-gray-500 mt-0.5"><span className="text-emerald-400 font-bold">{attendingIds.size}명</span> / {members.length}명 선택됨</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleAllAttending(true)} className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold px-2.5 py-1.5 rounded-lg border border-emerald-500/20">전체</button>
                <button onClick={() => toggleAllAttending(false)} className="text-xs bg-white/5 hover:bg-white/10 text-gray-400 font-semibold px-2.5 py-1.5 rounded-lg">해제</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {(() => {
                const regular = members.filter(m => !m.is_mercenary);
                return regular.length > 0 ? (
                  <div>
                    <p className="text-xs font-bold text-gray-600 px-5 pt-4 pb-2 uppercase tracking-wide">정규 팀원 ({regular.length}명)</p>
                    {regular.map(m => {
                      const checked = attendingIds.has(m.id);
                      return (
                        <button key={m.id} onClick={() => toggleAttending(m.id)}
                          className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${checked ? "bg-emerald-500/5" : "hover:bg-white/3"}`}>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${checked ? "bg-emerald-500 border-emerald-500" : "border-gray-600"}`}>
                            {checked && <span className="text-black text-[10px] font-bold">✓</span>}
                          </div>
                          <span className={`text-sm font-medium flex-1 ${checked ? "text-white" : "text-gray-500"}`}>{m.name}</span>
                          <div className="flex gap-1 shrink-0">
                            {m.position_1st && <span className={`text-xs px-1.5 py-0.5 rounded-full ${checked ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-gray-600"}`}>{m.position_1st}</span>}
                            {m.position_2nd && <span className={`text-xs px-1.5 py-0.5 rounded-full ${checked ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" : "bg-white/5 text-gray-600"}`}>{m.position_2nd}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null;
              })()}
              {(() => {
                const mercenary = members.filter(m => m.is_mercenary);
                return mercenary.length > 0 ? (
                  <div className="border-t border-white/5 mt-1">
                    <p className="text-xs font-bold text-amber-400 px-5 pt-4 pb-2 uppercase tracking-wide">⚡ 용병 ({mercenary.length}명)</p>
                    {mercenary.map(m => {
                      const checked = attendingIds.has(m.id);
                      return (
                        <button key={m.id} onClick={() => toggleAttending(m.id)}
                          className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${checked ? "bg-amber-500/5" : "hover:bg-white/3"}`}>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${checked ? "bg-amber-400 border-amber-400" : "border-gray-600"}`}>
                            {checked && <span className="text-black text-[10px] font-bold">✓</span>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className={`text-sm font-medium ${checked ? "text-amber-300" : "text-gray-500"}`}>{m.name}</span>
                            {m.is_cafe_mercenary ? <span className="text-xs text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-full shrink-0">☕카페</span>
                              : m.referrer ? <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full shrink-0">{m.referrer}지인</span> : null}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {m.position_1st && <span className={`text-xs px-1.5 py-0.5 rounded-full ${checked ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-gray-600"}`}>{m.position_1st}</span>}
                            {m.position_2nd && <span className={`text-xs px-1.5 py-0.5 rounded-full ${checked ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" : "bg-white/5 text-gray-600"}`}>{m.position_2nd}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null;
              })()}
            </div>
            <div className="px-5 py-4 border-t border-white/5">
              <button onClick={() => confirmAttendees(attendingIds)} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl transition-colors">
                확인 ({attendingIds.size}명 선택됨)
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* 공유 토스트 */}
      {shareToast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-white/10 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg">
          🔗 공유 링크가 복사됐어요!
        </div>
      )}

      {/* 저장 모달 */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto" onClick={() => setShowSaveModal(false)}>
          <div className="flex min-h-full items-center justify-center px-6 py-6">
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white mb-4">{loadedAssignmentId ? `"${saveSessionName}" 업데이트` : "배정 저장"}</h3>
            {loadedAssignmentId ? (
              <div className="mb-4 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
                <p className="text-sm text-blue-400"><b>{saveSessionName}</b>에 현재 배정을 덮어씌웁니다.</p>
              </div>
            ) : (
              <div className="mb-4">
                <label className="text-sm text-gray-500 mb-1 block">저장 이름</label>
                <input type="text" value={saveSessionName}
                  onChange={e => { setSaveSessionName(e.target.value); setSaveError(""); }}
                  onKeyDown={e => e.key === "Enter" && saveAssignment()}
                  placeholder="예: 1쿼터, 2쿼터..."
                  className={`w-full bg-gray-800 border text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600 ${saveError ? "border-red-500/50" : "border-white/10"}`} autoFocus />
                {saveError && (
                  <p className="text-xs text-red-400 mt-1.5">{saveError}</p>
                )}
                <p className="text-xs text-gray-600 mt-1">같은 이름은 사용할 수 없어요 · 이름순으로 자동 정렬돼요</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={saveAssignment} disabled={saving} className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black py-2.5 rounded-xl font-bold">
                {saving ? "저장 중..." : "저장"}
              </button>
              <button onClick={() => { setShowSaveModal(false); setSaveError(""); }} disabled={saving} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2.5 rounded-xl font-semibold">취소</button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* 동시 편집 알림 모달 */}
      {conflictAlert && (
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto" onClick={() => setConflictAlert(null)}>
          <div className="flex min-h-full items-center justify-center px-4 py-6">
          <div className="bg-gray-900 border border-amber-500/30 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <span className="text-4xl">⚠️</span>
              <h3 className="font-black text-white text-lg mt-2">다른 사람이 배정 중이에요</h3>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                <b className="text-amber-300">{conflictAlert.join(", ")}</b>님이 지금 이 경기의 배정 작업을 하고 있어요.<br />
                같은 쿼터를 동시에 저장하면 충돌할 수 있으니 서로 확인 후 진행해주세요.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => router.push("/matches")} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2.5 rounded-xl font-semibold transition-colors">뒤로가기</button>
              <button onClick={() => setConflictAlert(null)} className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-xl font-bold transition-colors">확인하고 계속</button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* 슬롯 클릭 팝업 */}
      {popup && (
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto" onClick={() => setPopup(null)}>
          <div className="flex min-h-full items-center justify-center px-6 py-6">
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white mb-1">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-lg mr-2 text-sm">{popup.label}</span>
              포지션
            </h3>
            {popup.currentMember && (
              <div className="mt-3 mb-4 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-emerald-400 mb-0.5">현재 배정</p>
                  <p className="font-semibold text-white">{popup.currentMember.name}</p>
                </div>
                <button onClick={handleRemoveMember} className="text-sm text-red-400 hover:text-red-300 font-medium">제거</button>
              </div>
            )}
            <p className="text-sm text-gray-500 mb-3">{popup.currentMember ? "다른 팀원으로 교체 (이미 배정된 팀원 선택 시 스왑):" : "배정할 팀원 선택:"}</p>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {(() => {
                // 참가 인원 + 현재 배정에 있는 팀원 합집합 (attendingIds가 있어도 배정된 팀원 모두 포함)
                const assignedInResult = new Set(Object.values(assigned).filter(Boolean).map(m => m!.id));
                const popupPool = members.filter(m =>
                  (attendingIds.has(m.id) || assignedInResult.has(m.id)) && m.id !== popup.currentMember?.id
                );
                const allOthers = popupPool;
                if (allOthers.length === 0) return <p className="text-center text-gray-600 py-4 text-sm">교체할 팀원이 없어요</p>;
                const regular = allOthers.filter(m => !m.is_mercenary);
                const mercenary = allOthers.filter(m => m.is_mercenary);
                // 각 팀원이 현재 어느 슬롯에 배정됐는지 확인
                const memberSlotLabel = (memberId: string) => {
                  const slotId = Object.entries(assigned).find(([sid, m]) => m?.id === memberId && sid !== popup.slotId)?.[0];
                  if (!slotId) return null;
                  return formation.slots.find(s => s.id === slotId)?.label ?? slotId;
                };
                return (
                  <>
                    {regular.length > 0 && (
                      <>
                        <p className="text-xs font-bold text-gray-600 px-1">👥 정규팀원</p>
                        {regular.map(m => {
                          const currentSlot = memberSlotLabel(m.id);
                          return (
                          <button key={m.id} onClick={() => handleAssignMember(m.id)}
                            className="flex flex-col px-4 py-2.5 rounded-xl border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors text-left w-full">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-white">{m.name}</span>
                              {currentSlot && <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">{currentSlot}에서 스왑</span>}
                            </div>
                            {(m.position_1st || m.position_2nd) && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {m.position_1st && <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">1: {m.position_1st}</span>}
                                {m.position_2nd && <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">2: {m.position_2nd}</span>}
                              </div>
                            )}
                          </button>
                          );
                        })}
                      </>
                    )}
                    {mercenary.length > 0 && (
                      <>
                        <p className="text-xs font-bold text-amber-400 px-1 mt-1">⚡ 용병</p>
                        {mercenary.map(m => {
                          const currentSlot = memberSlotLabel(m.id);
                          return (
                          <button key={m.id} onClick={() => handleAssignMember(m.id)}
                            className="flex flex-col px-4 py-2.5 rounded-xl border border-amber-500/20 hover:border-amber-400/50 hover:bg-amber-500/5 transition-colors text-left w-full">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-amber-300">{m.name}</span>
                              {m.is_cafe_mercenary ? <span className="text-xs text-sky-400">☕카페</span> : m.referrer ? <span className="text-xs text-amber-400">{m.referrer}지인</span> : null}
                              {currentSlot && <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">{currentSlot}에서 스왑</span>}
                            </div>
                            {(m.position_1st || m.position_2nd) && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {m.position_1st && <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">1: {m.position_1st}</span>}
                                {m.position_2nd && <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">2: {m.position_2nd}</span>}
                              </div>
                            )}
                          </button>
                          );
                        })}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
            <button onClick={() => setPopup(null)} className="w-full mt-4 bg-white/5 hover:bg-white/10 text-gray-400 py-2 rounded-xl font-medium transition-colors">닫기</button>
          </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function AssignPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-950"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>}>
      <AssignContent />
    </Suspense>
  );
}

function FormationSelect({ value, onChange, customFormations }: { value: string; onChange: (v: string) => void; customFormations: CustomFormation[] }) {
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ "⚽ 축구": true });
  const [expandedFutsal, setExpandedFutsal] = useState<Record<string, boolean>>({});
  const [futsalOpen, setFutsalOpen] = useState(false);

  const groups: { label: string; keys: string[] }[] = [
    { label: "⚽ 축구", keys: SOCCER_FORMATIONS },
    ...(customFormations.length > 0 ? [{ label: "✏️ 내 커스텀 포메이션", keys: customFormations.map(f => f.id) }] : []),
  ];

  const displayName = (key: string) => customFormations.find(f => f.id === key)?.name ?? key;
  const toggleGroup = (label: string) => setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  const currentGroup = groups.find(g => g.keys.includes(value));

  return (
    <div className="relative mb-4">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-gray-800 border border-white/10 hover:border-emerald-500/50 focus:border-emerald-500 rounded-xl px-4 py-3 transition-colors">
        <div className="text-left">
          {currentGroup && <p className="text-xs text-gray-500 leading-none mb-0.5">{currentGroup.label}</p>}
          <p className="font-bold text-white text-base leading-none">{displayName(value)}</p>
        </div>
        <span className={`text-gray-500 text-sm transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden max-h-80 overflow-y-auto">
            {/* 축구 + 커스텀 그룹 */}
            {groups.map(group => (
              <div key={group.label}>
                <button type="button" onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-900/50 hover:bg-gray-900 transition-colors">
                  <span className="text-sm font-bold text-gray-400">{group.label}</span>
                  <span className={`text-xs text-gray-600 transition-transform ${expandedGroups[group.label] ? "rotate-180" : ""}`}>▼</span>
                </button>
                {expandedGroups[group.label] && (
                  <div>
                    {group.keys.map(key => (
                      <button key={key} type="button" onClick={() => { onChange(key); setOpen(false); }}
                        className={`w-full text-left px-6 py-2.5 text-sm transition-colors flex items-center gap-2 ${value === key ? "bg-emerald-500/10 text-emerald-400 font-semibold" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>
                        {value === key && <span className="text-emerald-400 text-xs">✓</span>}
                        <span className={value === key ? "" : "pl-4"}>{displayName(key)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* 풋살 그룹 (2단계 아코디언) */}
            <div>
              <button type="button" onClick={() => setFutsalOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-900/50 hover:bg-gray-900 transition-colors">
                <span className="text-sm font-bold text-gray-400">🏃 풋살</span>
                <span className={`text-xs text-gray-600 transition-transform ${futsalOpen ? "rotate-180" : ""}`}>▼</span>
              </button>
              {futsalOpen && Object.entries(FUTSAL_FORMATIONS).map(([size, keys]) => (
                <div key={size}>
                  <button type="button" onClick={() => setExpandedFutsal(prev => ({ ...prev, [size]: !prev[size] }))}
                    className="w-full flex items-center justify-between px-6 py-2 bg-gray-800/80 hover:bg-gray-700/50 transition-colors">
                    <span className="text-xs font-bold text-gray-500">{size}</span>
                    <span className={`text-xs text-gray-600 transition-transform ${expandedFutsal[size] ? "rotate-180" : ""}`}>▼</span>
                  </button>
                  {expandedFutsal[size] && keys.map(key => (
                    <button key={key} type="button" onClick={() => { onChange(key); setOpen(false); }}
                      className={`w-full text-left px-8 py-2 text-sm transition-colors flex items-center gap-2 ${value === key ? "bg-emerald-500/10 text-emerald-400 font-semibold" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>
                      {value === key && <span className="text-emerald-400 text-xs">✓</span>}
                      <span className={value === key ? "" : "pl-4"}>{key.replace(/^풋살 \d+vs\d+ /, "")}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getPositionStyle(label: string, member: Member | null, isMercenary: boolean): React.CSSProperties {
  if (!member) {
    return {
      backgroundColor: "rgba(255,255,255,0.12)",
      border: "1.5px solid rgba(255,255,255,0.25)",
      color: "#6b7280",
      boxShadow: "none",
    };
  }
  const pos = label.toUpperCase();
  const isGK  = pos === "GK";
  const isDef = /^(CB|LB|RB|LWB|RWB|SW|DC|DL|DR|WB|FB)/.test(pos);
  const isAtt = /^(ST|CF|SS|LW|RW|LF|RF|FW|ATT|WG|CW)/.test(pos);

  let bg: string, borderBase: string, color: string;
  if (isGK)       { bg = "#f59e0b"; borderBase = "#fbbf24"; color = "#111827"; }
  else if (isDef) { bg = "#3b82f6"; borderBase = "#60a5fa"; color = "#ffffff"; }
  else if (isAtt) { bg = "#ef4444"; borderBase = "#f87171"; color = "#ffffff"; }
  else            { bg = "#10b981"; borderBase = "#34d399"; color = "#111827"; }

  return {
    backgroundColor: bg,
    border: isMercenary ? "2.5px solid #ffffff" : `2px solid ${borderBase}`,
    color,
    boxShadow: `0 4px 12px ${bg}50`,
  };
}

function FieldView({ formation, assigned, preview = false, onSlotClick, mercenaryIds = new Set() }: {
  formation: Formation;
  assigned: Record<string, Member | null>;
  preview?: boolean;
  onSlotClick?: (slot: PositionSlot) => void;
  teamColor?: string;
  mercenaryIds?: Set<string>;
}) {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{ paddingBottom: "110%", background: "linear-gradient(180deg, #166534 0%, #14532d 40%, #15803d 60%, #166534 100%)" }}>
      {/* 필드 라인 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute border border-white/20 inset-[3%] rounded-sm" />
        <div className="absolute w-[94%] left-[3%] border-t border-white/20" style={{ top: "50%" }} />
        <div className="absolute border border-white/20 rounded-full" style={{ width: "20%", height: "15%", top: "42.5%", left: "40%" }} />
        <div className="absolute w-1.5 h-1.5 bg-white/30 rounded-full" style={{ top: "calc(50% - 3px)", left: "calc(50% - 3px)" }} />
        <div className="absolute border border-white/20" style={{ width: "46%", height: "13%", top: "3%", left: "27%" }} />
        <div className="absolute border border-white/20" style={{ width: "46%", height: "13%", bottom: "3%", left: "27%" }} />
        <div className="absolute border border-white/20" style={{ width: "22%", height: "6%", top: "3%", left: "39%" }} />
        <div className="absolute border border-white/20" style={{ width: "22%", height: "6%", bottom: "3%", left: "39%" }} />
      </div>

      {formation.slots.map(slot => {
        const member = assigned[slot.id];
        const isClickable = !preview && !!onSlotClick;
        const isMercenary = member ? mercenaryIds.has(member.id) : false;
        const slotStyle = getPositionStyle(slot.label, member, isMercenary);

        return (
          <div key={slot.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 ${isClickable ? "cursor-pointer" : ""}`}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            onClick={() => isClickable && onSlotClick(slot)}
          >
            <div
              className={`w-11 h-11 rounded-full flex flex-col items-center justify-center font-bold shadow-lg transition-transform ${isClickable ? "hover:scale-110 active:scale-95" : ""}`}
              style={slotStyle}
            >
              <span className="text-[10px] font-black leading-none">{slot.label}</span>
              {member && <span className="text-[9px] leading-none mt-0.5 truncate max-w-[40px] text-center font-semibold">{member.name}</span>}
            </div>
            {!member && !preview && (
              <span className="text-white/40 text-[9px]">미배정</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
