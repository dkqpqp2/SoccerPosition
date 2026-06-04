"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { FORMATIONS, Formation, PositionSlot, SOCCER_FORMATIONS, FUTSAL_FORMATIONS } from "@/lib/formations";
import KakaoShare from "@/components/KakaoShare";
import SpmLogo from "@/components/SpmLogo";

interface Member {
  id: string;
  name: string;
  position_1st: string | null;
  position_2nd: string | null;
  is_mercenary?: boolean;
  is_cafe_mercenary?: boolean;
  referrer?: string | null;
}

type Step = "setup" | "conflict" | "result";

interface Conflict {
  label: string; // 포지션 라벨 (CB, GK 등)
  slotIds: string[]; // 해당 라벨의 슬롯들
  candidates: Member[]; // 희망자들
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
  const [teamColor, setTeamColor] = useState("#facc15");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [matchInfo, setMatchInfo] = useState<{ match_date: string; match_time: string | null; match_end_time: string | null; location: string | null; title: string | null; uniform_info: string | null } | null>(null);
  const [savedAssignments, setSavedAssignments] = useState<SavedAssignment[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSessionName, setSaveSessionName] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [attendingIds, setAttendingIds] = useState<Set<string>>(new Set());
  const [showAttendModal, setShowAttendModal] = useState(false);
  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const canManage = userRole === "owner" || userRole === "manager" || userRole === "coach" || userRole === "president";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") {
      fetchMembers();
      fetchCustomFormations();
      fetchTeamColor();
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
    const match = data.find((m: { id: string; match_date: string; title: string | null }) => m.id === matchId);
    if (match) setMatchInfo({ match_date: match.match_date, match_time: match.match_time ?? null, match_end_time: match.match_end_time ?? null, location: match.location ?? null, title: match.title, uniform_info: match.uniform_info ?? null });
  }

  async function saveAssignment() {
    if (!saveSessionName.trim()) return;

    if (loadedAssignmentId) {
      // 불러온 쿼터 덮어쓰기
      await fetch(`/api/assignments/${loadedAssignmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result: assigned,
          formation_name: formation.name,
          formation_id: selectedFormation,
          formation_slots: formation.slots,
        }),
      });
    } else {
      // 새 쿼터 저장
      await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_name: saveSessionName,
          formation_name: formation.name,
          formation_id: selectedFormation,
          formation_slots: formation.slots,
          result: assigned,
          match_id: matchId || null,
        }),
      });
    }
    setShowSaveModal(false);
    setSaveSessionName("");
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
    setStep("result");
  }

  async function fetchUserRole() {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    setUserRole(data.role ?? null);
  }

  async function fetchTeamColor() {
    const res = await fetch("/api/user/color");
    const data = await res.json();
    setTeamColor(data.team_color || "#facc15");
  }

  async function saveTeamColor(color: string) {
    setTeamColor(color);
    await fetch("/api/user/color", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_color: color }),
    });
  }

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

    // 경기별 저장된 참가자 불러오기
    if (matchId) {
      const attRes = await fetch(`/api/matches/attendees?matchId=${matchId}`);
      const attData = await attRes.json();
      if (attData.member_ids && attData.member_ids.length > 0) {
        setAttendingIds(new Set(attData.member_ids));
      } else {
        setAttendingIds(new Set());
      }
    } else {
      setAttendingIds(new Set());
    }

    setLoading(false);
  }

  async function saveAttendees(ids: Set<string>) {
    if (!matchId) return;
    await fetch("/api/matches/attendees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: matchId, member_ids: [...ids] }),
    });
  }

  function toggleAttending(id: string) {
    setAttendingIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllAttending(all: boolean) {
    const next = all ? new Set(members.map(m => m.id)) : new Set<string>();
    setAttendingIds(next);
  }

  // 참가 확인 버튼 클릭 시 저장
  async function confirmAttendees(ids: Set<string>) {
    setAttendingIds(ids);
    setShowAttendModal(false);
    await saveAttendees(ids);
  }

  // 참가자 중 미배정 팀원
  function getUnassignedMembers(currentAssigned: Record<string, Member | null>, excludeSlotId?: string) {
    const assignedIds = new Set(
      Object.entries(currentAssigned)
        .filter(([slotId, m]) => m && slotId !== excludeSlotId)
        .map(([, m]) => m!.id)
    );
    return members.filter(m => attendingIds.has(m.id) && !assignedIds.has(m.id));
  }

  const attendingMembers = members.filter(m => attendingIds.has(m.id));

  async function shareAttendees(attending: Member[]) {
    setShareToast(true);

    const res = await fetch("/api/share/attendees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: attending, match_info: matchInfo }),
    });

    if (!res.ok) {
      setShareToast(false);
      alert("공유 링크 생성에 실패했어요");
      return;
    }

    const { id } = await res.json();
    const url = `${window.location.origin}/share/attendees/${id}`;

    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      await navigator.share({ url });
    } else {
      await navigator.clipboard.writeText(url);
    }

    setTimeout(() => setShareToast(false), 2500);
  }

  function autoAssign() {
    const cf = customFormations.find(f => f.id === selectedFormation);
    const formation = cf ? { name: cf.name, slots: cf.slots } : FORMATIONS[selectedFormation] ?? FORMATIONS["4-3-3"];
    const slots = formation.slots;
    const result: Record<string, Member | null> = {};
    slots.forEach(s => result[s.id] = null);

    const assignedMemberIds = new Set<string>();

    // 참가자만 대상으로
    const pool = attendingMembers;

    // 라벨별 슬롯 그룹화
    const labelSlots: Record<string, string[]> = {};
    for (const slot of slots) {
      if (!labelSlots[slot.label]) labelSlots[slot.label] = [];
      labelSlots[slot.label].push(slot.id);
    }

    // 라벨별 1순위 희망자 수집
    const labelWanters: Record<string, Member[]> = {};
    for (const m of pool) {
      if (m.position_1st) {
        if (!labelWanters[m.position_1st]) labelWanters[m.position_1st] = [];
        labelWanters[m.position_1st].push(m);
      }
    }

    const conflictList: Conflict[] = [];

    // 라벨별로 처리: 희망자 수 vs 슬롯 수 비교
    for (const [label, slotIds] of Object.entries(labelSlots)) {
      const wanters = (labelWanters[label] || []).filter(m => !assignedMemberIds.has(m.id));
      if (wanters.length === 0) continue;

      if (wanters.length <= slotIds.length) {
        // 희망자 수 ≤ 슬롯 수 → 전원 바로 배정
        wanters.forEach((m, i) => {
          result[slotIds[i]] = m;
          assignedMemberIds.add(m.id);
        });
      } else {
        // 희망자 수 > 슬롯 수 → 충돌: 라벨당 1개 카드
        conflictList.push({ label, slotIds, candidates: wanters });
      }
    }

    // 충돌 대기 중인 팀원 ID (2순위 배정에서 제외)
    const conflictMemberIds = new Set(conflictList.flatMap(c => c.candidates.map(m => m.id)));

    // 2순위 배정
    for (const slot of slots) {
      if (result[slot.id]) continue;
      const inConflict = conflictList.some(c => c.slotIds.includes(slot.id));
      if (inConflict) continue;
      const wants = pool.filter(
        m => m.position_2nd === slot.label
          && !assignedMemberIds.has(m.id)
          && !conflictMemberIds.has(m.id)
      );
      if (wants.length >= 1) {
        result[slot.id] = wants[0];
        assignedMemberIds.add(wants[0].id);
      }
    }

    setAssigned(result);
    if (conflictList.length > 0) {
      setConflicts(conflictList);
      setStep("conflict");
    } else {
      setStep("result");
    }
  }

  function resolveConflicts() {
    const updated = { ...assigned };
    const assignedMemberIds = new Set(
      Object.values(updated).filter(Boolean).map(m => m!.id)
    );

    for (const conflict of conflicts) {
      const chosenId = conflictChoices[conflict.label];
      if (!chosenId) return;

      // 선택된 사람을 첫 번째 슬롯에
      const chosenMember = conflict.candidates.find(m => m.id === chosenId)!;
      updated[conflict.slotIds[0]] = chosenMember;
      assignedMemberIds.add(chosenMember.id);

      // 나머지 희망자들을 남은 슬롯에 순서대로 배정
      const remaining = conflict.candidates.filter(m => m.id !== chosenId);
      remaining.forEach((m, i) => {
        const slotId = conflict.slotIds[i + 1];
        if (slotId) {
          updated[slotId] = m;
          assignedMemberIds.add(m.id);
        }
      });
    }

    const cf = customFormations.find(f => f.id === selectedFormation);
    const curFormation: Formation = cf ? { name: cf.name, slots: cf.slots } : FORMATIONS[selectedFormation] ?? FORMATIONS["4-3-3"];
    for (const slot of curFormation.slots) {
      if (updated[slot.id]) continue;
      const wants = attendingMembers.filter(
        m => m.position_2nd === slot.label && !assignedMemberIds.has(m.id)
      );
      if (wants.length > 0) {
        updated[slot.id] = wants[0];
        assignedMemberIds.add(wants[0].id);
      }
    }

    // 중복 배정 최종 검증
    const seen = new Set<string>();
    for (const slotId of Object.keys(updated)) {
      const m = updated[slotId];
      if (!m) continue;
      if (seen.has(m.id)) {
        updated[slotId] = null;
      } else {
        seen.add(m.id);
      }
    }

    setAssigned(updated);
    setStep("result");
  }

  function handleSlotClick(slot: PositionSlot) {
    setPopup({
      slotId: slot.id,
      label: slot.label,
      currentMember: assigned[slot.id] ?? null,
    });
  }

  function handleAssignMember(memberId: string) {
    if (!popup) return;
    const member = members.find(m => m.id === memberId)!;

    const updated = { ...assigned };
    updated[popup.slotId] = member;
    setAssigned(updated);
    setPopup(null);
  }

  function handleRemoveMember() {
    if (!popup) return;
    setAssigned(prev => ({ ...prev, [popup.slotId]: null }));
    setPopup(null);
  }

  function reset() {
    setStep("setup");
    setAssigned({});
    setConflicts([]);
    setConflictChoices({});
    setPopup(null);
    setLoadedFormationSlots(null);
    setLoadedAssignmentId(null);
    setSaveSessionName("");
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
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>;
  }

  const unassignedInResult = step === "result"
    ? members.filter(m => !Object.values(assigned).some(a => a?.id === m.id))
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => matchId ? router.push("/matches") : router.push("/dashboard")} className="hover:text-green-200 shrink-0 text-sm">← 뒤로</button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base shrink-0">🎯</span>
              <h1 className="text-base font-bold leading-none truncate">포지션 배정</h1>
            </div>
            {matchInfo && (
              <p className="text-xs text-green-200 mt-0.5 truncate">
                📅 {new Date(matchInfo.match_date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" })}
                {matchInfo.title && ` · ${matchInfo.title}`}
              </p>
            )}
          </div>
        </div>
        {/* 로고 + 팀 색상 피커 */}
        <div className="flex items-center gap-2 shrink-0">
        <SpmLogo size="sm" showText={false} clickable />
        <div className="relative flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-green-200 hidden sm:block">팀 색상</span>
          <button
            onClick={() => setShowColorPicker(p => !p)}
            className="w-7 h-7 rounded-full border-2 border-white shadow-lg transition-transform hover:scale-110"
            style={{ backgroundColor: teamColor }}
          />
          {showColorPicker && (
            <div className="absolute right-0 top-10 bg-white rounded-xl shadow-xl p-3 z-50 w-48" onClick={e => e.stopPropagation()}>
              <p className="text-xs font-semibold text-gray-500 mb-2">팀 색상 선택</p>
              <div className="grid grid-cols-6 gap-1.5 mb-2">
                {["#facc15","#f97316","#ef4444","#ec4899","#a855f7","#3b82f6","#06b6d4","#10b981","#84cc16","#ffffff","#000000","#6b7280"].map(c => (
                  <button
                    key={c}
                    onClick={() => { saveTeamColor(c); setShowColorPicker(false); }}
                    className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${teamColor === c ? "border-gray-800 scale-110 ring-1 ring-gray-400" : "border-gray-200"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
                <label className="text-xs text-gray-400">직접 선택</label>
                <input
                  type="color"
                  value={teamColor}
                  onChange={e => saveTeamColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                />
              </div>
            </div>
          )}
        </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 lg:px-6 lg:py-8">

        {/* STEP 1: 포메이션 선택 */}
        {step === "setup" && (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">

            {/* 왼쪽: 저장된 배정 이력 - 모바일에서는 접을 수 있게 */}
            <div className="w-full lg:w-56 lg:shrink-0 lg:sticky lg:top-6 flex flex-col gap-4">
              {/* 모바일: 이력 토글 */}
              <button
                className="lg:hidden flex items-center justify-between bg-white rounded-xl shadow px-4 py-3"
                onClick={() => setShowHistoryMobile(p => !p)}
              >
                <span className="text-sm font-bold text-gray-700">📋 저장된 배정 이력 ({savedAssignments.length})</span>
                <span className="text-gray-400 text-sm">{showHistoryMobile ? "▲" : "▼"}</span>
              </button>

              <div className={`${showHistoryMobile ? "flex" : "hidden"} lg:flex flex-col gap-4`}>
                {/* 쿼터 이력 */}
                <div>
                  <p className="hidden lg:block text-xs font-semibold text-gray-400 mb-2">📋 저장된 배정 이력</p>
                  {savedAssignments.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow p-4 text-center text-gray-300 text-xs">저장된 이력 없음</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {savedAssignments.map(s => (
                        <div key={s.id} className="bg-white rounded-xl shadow px-3 py-2.5">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="font-bold text-gray-800 text-sm">{s.session_name}</p>
                            <button onClick={() => deleteAssignment(s.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                          </div>
                          <p className="text-xs text-gray-400 mb-2">{s.formation_name}</p>
                          <button
                            onClick={() => loadAssignment(s)}
                            className="w-full text-xs bg-green-50 hover:bg-green-100 text-green-700 font-semibold py-1.5 rounded-lg transition-colors"
                          >
                            불러오기
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 참여 현황 버튼 */}
                {savedAssignments.length > 0 && (
                  <button
                    onClick={() => setShowStatsModal(true)}
                    className="w-full flex items-center justify-between bg-white rounded-2xl shadow px-4 py-3 hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">📊</span>
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-700">참여 현황</p>
                        <p className="text-xs text-gray-400">{savedAssignments.length}쿼터 저장됨</p>
                      </div>
                    </div>
                    <span className="text-xs text-green-600 font-semibold group-hover:underline">보기 →</span>
                  </button>
                )}
              </div>
            </div>

            {/* 가운데 + 오른쪽: 모바일에선 세로 스택 */}
            <div className="flex-1 min-w-0 w-full flex flex-col lg:flex-row gap-4 lg:gap-6">

              {/* 가운데: 그라운드 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-800">포메이션 선택</h2>
                  {canManage && <button onClick={() => router.push("/formations")} className="text-xs text-green-600 hover:underline">+ 포메이션 만들기</button>}
                </div>
                <FormationSelect
                  value={selectedFormation}
                  onChange={setSelectedFormation}
                  customFormations={customFormations}
                />
                <FieldView formation={formation} assigned={{}} preview teamColor={teamColor} mercenaryIds={new Set()} />
              </div>

              {/* 오른쪽: 참가자 + 배정 버튼 */}
              <div className="w-full lg:w-64 lg:shrink-0 flex flex-col gap-3 lg:sticky lg:top-6">
                {members.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow p-5 text-center text-gray-400">
                    <p className="text-sm">팀원이 없어요!</p>
                    <button onClick={() => router.push("/members")} className="mt-2 text-green-600 underline text-sm">팀원 추가하러 가기</button>
                  </div>
                ) : (
                  <>
                    {/* 참가 인원 카드 */}
                    <div className="bg-white rounded-2xl shadow overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-800">오늘 참가 인원</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            <span className="text-green-600 font-bold">{attendingIds.size}명</span> 참가
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          {attendingIds.size > 0 && (
                            <button
                              onClick={() => shareAttendees(attendingMembers)}
                              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              공유
                            </button>
                          )}
                        {canManage && (
                          <button
                            onClick={() => setShowAttendModal(true)}
                            className="text-xs bg-green-500 hover:bg-green-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            ✏️ 설정
                          </button>
                        )}
                        </div>
                      </div>

                      {attendingIds.size === 0 ? (
                        <div className="px-4 py-5 text-center">
                          <p className="text-xs text-gray-400">참가 인원을 설정해주세요</p>
                          {canManage && (
                            <button
                              onClick={() => setShowAttendModal(true)}
                              className="mt-2 text-xs text-green-600 font-semibold hover:underline"
                            >
                              + 참가자 선택하기
                            </button>
                          )}
                        </div>
                      ) : (
                        <div>
                          {(() => {
                            const regular = attendingMembers.filter((m: Member & { is_mercenary?: boolean }) => !m.is_mercenary);
                            return regular.length > 0 ? (
                              <div>
                                <p className="text-xs font-semibold text-gray-400 px-4 pt-3 pb-1">정규 팀원 ({regular.length}명)</p>
                                <div className="flex flex-col px-3 pb-2 gap-0.5">
                                  {regular.map((m: Member & { is_mercenary?: boolean }) => (
                                    <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-gray-50">
                                      <span className="text-sm font-medium text-gray-800">{m.name}</span>
                                      <div className="flex gap-1">
                                        {m.position_1st && <span className="text-xs bg-green-100 text-green-700 px-1.5 rounded-full">{m.position_1st}</span>}
                                        {m.position_2nd && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded-full">{m.position_2nd}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          })()}
                          {(() => {
                            const mercenary = attendingMembers.filter((m: Member & { is_mercenary?: boolean }) => m.is_mercenary);
                            return mercenary.length > 0 ? (
                              <div className="border-t border-orange-100">
                                <p className="text-xs font-semibold text-orange-400 px-4 pt-3 pb-1">⚡ 용병 ({mercenary.length}명)</p>
                                <div className="flex flex-col px-3 pb-3 gap-0.5">
                                  {mercenary.map((m: Member) => (
                                    <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-orange-50">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-sm font-medium text-orange-700">{m.name}</span>
                                        {m.is_cafe_mercenary
                                          ? <span className="text-xs text-sky-500 bg-sky-50 px-1.5 py-0.5 rounded-full">☕카페</span>
                                          : m.referrer
                                          ? <span className="text-xs text-orange-400 bg-white px-1.5 py-0.5 rounded-full">{m.referrer}지인</span>
                                          : null}
                                      </div>
                                      <div className="flex gap-1">
                                        {m.position_1st && <span className="text-xs bg-green-100 text-green-700 px-1.5 rounded-full">{m.position_1st}</span>}
                                        {m.position_2nd && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded-full">{m.position_2nd}</span>}
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
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-4 rounded-2xl font-bold text-lg transition-colors"
                      >
                        🎲 자동 배정 시작
                        {attendingIds.size > 0 && <span className="text-sm font-normal ml-1 opacity-80">({attendingIds.size}명)</span>}
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
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
              <h2 className="font-bold text-orange-700 text-sm mb-0.5">⚠️ 포지션 겹침!</h2>
              <p className="text-orange-600 text-xs">슬롯보다 희망자가 많아요. 우선순위 1명만 선택해주세요. 나머지는 자동 배정돼요.</p>
            </div>

            <div className="flex flex-col gap-3">
              {conflicts.map(conflict => (
                <div key={conflict.label} className="bg-white rounded-2xl shadow p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-lg text-sm font-bold">{conflict.label}</span>
                    <span className="text-sm text-gray-500">슬롯 {conflict.slotIds.length}개 · 희망자 {conflict.candidates.length}명</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {conflict.candidates.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setConflictChoices(prev => ({ ...prev, [conflict.label]: m.id }))}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${conflictChoices[conflict.label] === m.id ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 hover:border-green-300 text-gray-700"}`}
                      >
                        {m.name}
                        {conflictChoices[conflict.label] === m.id && <span className="ml-1">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={resolveConflicts}
              disabled={conflicts.some(c => !conflictChoices[c.label])}
              className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              배정 완료
            </button>
          </div>
        )}

        {/* STEP 3: 결과 */}
        {step === "result" && (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">

            {/* 왼쪽: 이력 - 모바일에서는 접기 */}
            <div className="w-full lg:w-56 lg:shrink-0 lg:sticky lg:top-6 flex flex-col gap-4">
              <button onClick={reset} className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-800">
                ← 배정으로 돌아가기
              </button>

              <button
                className="lg:hidden flex items-center justify-between bg-white rounded-xl shadow px-4 py-3"
                onClick={() => setShowHistoryMobile(p => !p)}
              >
                <span className="text-sm font-bold text-gray-700">📋 저장된 배정 이력 ({savedAssignments.length})</span>
                <span className="text-gray-400 text-sm">{showHistoryMobile ? "▲" : "▼"}</span>
              </button>

              <div className={`${showHistoryMobile ? "flex" : "hidden"} lg:flex flex-col gap-4`}>
                <div>
                  <p className="hidden lg:block text-xs font-semibold text-gray-400 mb-2">📋 저장된 배정 이력</p>
                  {savedAssignments.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow p-4 text-center text-gray-300 text-xs">저장된 이력 없음</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {savedAssignments.map(s => (
                        <div key={s.id} className="bg-white rounded-xl shadow px-3 py-2.5">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="font-bold text-gray-800 text-sm">{s.session_name}</p>
                            <button onClick={() => deleteAssignment(s.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                          </div>
                          <p className="text-xs text-gray-400 mb-2">{s.formation_name}</p>
                          <button onClick={() => loadAssignment(s)} className="w-full text-xs bg-green-50 hover:bg-green-100 text-green-700 font-semibold py-1.5 rounded-lg transition-colors">
                            불러오기
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {savedAssignments.length > 0 && (
                  <button
                    onClick={() => setShowStatsModal(true)}
                    className="w-full flex items-center justify-between bg-white rounded-2xl shadow px-4 py-3 hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">📊</span>
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-700">참여 현황</p>
                        <p className="text-xs text-gray-400">{savedAssignments.length}쿼터 저장됨</p>
                      </div>
                    </div>
                    <span className="text-xs text-green-600 font-semibold group-hover:underline">보기 →</span>
                  </button>
                )}
              </div>
            </div>

            {/* 가운데 + 오른쪽 */}
            <div className="flex-1 min-w-0 w-full flex flex-col lg:flex-row gap-4 lg:gap-6">
              {/* 그라운드 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-800 text-lg">🏆 배정 결과 — {formation.name}</h2>
                  <span className="text-xs text-gray-400">슬롯을 눌러 수정</span>
                </div>
                <FieldView
                  formation={formation}
                  assigned={assigned}
                  onSlotClick={handleSlotClick}
                  teamColor={teamColor}
                  mercenaryIds={new Set(members.filter((m: Member & { is_mercenary?: boolean }) => m.is_mercenary).map(m => m.id))}
                />
              </div>

              {/* 오른쪽: 참가자 현황 + 버튼 */}
              <div className="w-full lg:w-64 lg:shrink-0 flex flex-col gap-4 lg:sticky lg:top-6">
                {(() => {
                  const regular = attendingMembers.filter((m: Member & { is_mercenary?: boolean }) => !m.is_mercenary);
                  const mercenary = attendingMembers.filter((m: Member & { is_mercenary?: boolean }) => m.is_mercenary);
                  const assignedIds = new Set(Object.values(assigned).filter(Boolean).map(m => m!.id));
                  return (
                    <>
                      {regular.length > 0 && (
                        <div className="bg-white rounded-2xl shadow p-4">
                          <p className="text-xs font-semibold text-gray-400 mb-2">정규 팀원 ({regular.length}명)</p>
                          <div className="flex flex-col gap-1">
                            {regular.map((m: Member & { is_mercenary?: boolean }) => (
                              <div key={m.id} className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${assignedIds.has(m.id) ? "bg-green-50" : "bg-yellow-50"}`}>
                                <span className={`text-sm font-medium ${assignedIds.has(m.id) ? "text-gray-800" : "text-yellow-600"}`}>{m.name}</span>
                                {assignedIds.has(m.id)
                                  ? <span className="text-xs text-green-500">✓</span>
                                  : <span className="text-xs text-yellow-500">미배정</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {mercenary.length > 0 && (
                        <div className="bg-white rounded-2xl shadow p-4 border-2 border-orange-200">
                          <p className="text-xs font-semibold text-orange-400 mb-2">⚡ 용병 ({mercenary.length}명)</p>
                          <div className="flex flex-col gap-1">
                            {mercenary.map((m: Member & { is_mercenary?: boolean }) => (
                              <div key={m.id} className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${assignedIds.has(m.id) ? "bg-green-50" : "bg-yellow-50"}`}>
                                <span className={`text-sm font-medium ${assignedIds.has(m.id) ? "text-orange-700" : "text-yellow-600"}`}>{m.name}</span>
                                {assignedIds.has(m.id)
                                  ? <span className="text-xs text-green-500">✓</span>
                                  : <span className="text-xs text-yellow-500">미배정</span>}
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
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-colors"
                  >
                    💾 이 배정 저장
                  </button>
                )}

                {loadedAssignmentId && (
                  <KakaoShare
                    assignmentId={loadedAssignmentId}
                    sessionName={saveSessionName}
                    formationName={formation.name}
                    matchTitle={matchInfo?.title}
                    matchDate={matchInfo?.match_date}
                  />
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* 참여 현황 모달 */}
      {showStatsModal && (() => {
        const memberQuarters: Record<string, { name: string; isMercenary: boolean; quarters: boolean[] }> = {};
        savedAssignments.forEach((s, qIdx) => {
          for (const member of Object.values(s.result)) {
            if (!member) continue;
            if (!memberQuarters[member.id]) {
              const m = members.find(x => x.id === member.id);
              memberQuarters[member.id] = {
                name: member.name,
                isMercenary: (m as Member & { is_mercenary?: boolean })?.is_mercenary || false,
                quarters: Array(savedAssignments.length).fill(false),
              };
            }
            memberQuarters[member.id].quarters[qIdx] = true;
          }
        });
        const sorted = Object.values(memberQuarters).sort((a, b) => b.quarters.filter(Boolean).length - a.quarters.filter(Boolean).length);
        const total = savedAssignments.length;
        const quarterLabels = savedAssignments.map((s, i) => s.session_name.replace(/[^0-9]/g, "") || String(i + 1));

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowStatsModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              {/* 모달 헤더 */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">📊 참여 현황</h3>
                  <p className="text-xs text-gray-400 mt-0.5">총 {total}쿼터 · {sorted.length}명</p>
                </div>
                <button onClick={() => setShowStatsModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
              </div>

              {/* 쿼터 헤더 */}
              <div className="px-6 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-24 shrink-0">이름</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {quarterLabels.map((label, i) => (
                      <span key={i} className="text-xs font-bold bg-gray-100 text-gray-500 rounded px-2 py-0.5 min-w-[24px] text-center">
                        {label}Q
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 ml-auto shrink-0">합계</span>
                </div>
              </div>

              {/* 팀원 목록 */}
              <div className="overflow-y-auto flex-1 px-6 pb-6">
                <div className="flex flex-col gap-1">
                  {sorted.map((p, idx) => {
                    const count = p.quarters.filter(Boolean).length;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={idx} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                        {/* 이름 */}
                        <span className={`text-sm font-medium w-24 shrink-0 truncate ${p.isMercenary ? "text-orange-600" : "text-gray-800"}`}>
                          {p.name}{p.isMercenary && <span className="text-xs ml-0.5">⚡</span>}
                        </span>

                        {/* 쿼터 뱃지 */}
                        <div className="flex gap-1.5 flex-wrap flex-1">
                          {p.quarters.map((played, i) => (
                            played ? (
                              <span key={i} className="text-xs font-bold bg-green-500 text-white rounded px-1.5 py-0.5 min-w-[24px] text-center leading-none">
                                {quarterLabels[i]}
                              </span>
                            ) : (
                              <span key={i} className="text-xs bg-gray-100 text-gray-300 rounded px-1.5 py-0.5 min-w-[24px] text-center leading-none">
                                {quarterLabels[i]}
                              </span>
                            )
                          ))}
                        </div>

                        {/* 합계 + 바 */}
                        <div className="shrink-0 text-right w-16">
                          <span className="text-xs font-bold text-gray-700">{count}<span className="text-gray-300 font-normal">/{total}</span></span>
                          <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#10b981" : pct >= 50 ? "#facc15" : "#f87171" }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 닫기 버튼 */}
              <div className="px-6 pb-5">
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 참가 인원 선택 모달 */}
      {showAttendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowAttendModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800 text-base">오늘 참가 인원 선택</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="text-green-600 font-bold">{attendingIds.size}명</span> / {members.length}명 선택됨
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleAllAttending(true)} className="text-xs bg-green-50 hover:bg-green-100 text-green-700 font-semibold px-2.5 py-1.5 rounded-lg">전체</button>
                <button onClick={() => toggleAllAttending(false)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-500 font-semibold px-2.5 py-1.5 rounded-lg">해제</button>
              </div>
            </div>

            {/* 팀원 목록 */}
            <div className="overflow-y-auto flex-1">
              {/* 정규 팀원 */}
              {(() => {
                const regular = members.filter((m: Member & { is_mercenary?: boolean }) => !m.is_mercenary);
                return regular.length > 0 ? (
                  <div>
                    <p className="text-xs font-bold text-gray-400 px-5 pt-4 pb-2 uppercase tracking-wide">정규 팀원 ({regular.length}명)</p>
                    {regular.map((m: Member & { is_mercenary?: boolean }) => {
                      const checked = attendingIds.has(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleAttending(m.id)}
                          className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50 ${checked ? "bg-green-50/60" : ""}`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${checked ? "bg-green-500 border-green-500" : "border-gray-300"}`}>
                            {checked && <span className="text-white text-xs font-bold leading-none">✓</span>}
                          </div>
                          <span className={`text-sm font-medium flex-1 ${checked ? "text-gray-800" : "text-gray-400"}`}>{m.name}</span>
                          <div className="flex gap-1 shrink-0">
                            {m.position_1st && <span className={`text-xs px-1.5 py-0.5 rounded-full ${checked ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>{m.position_1st}</span>}
                            {m.position_2nd && <span className={`text-xs px-1.5 py-0.5 rounded-full ${checked ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"}`}>{m.position_2nd}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null;
              })()}

              {/* 용병 */}
              {(() => {
                const mercenary = members.filter((m: Member & { is_mercenary?: boolean }) => m.is_mercenary);
                return mercenary.length > 0 ? (
                  <div className="border-t border-gray-100 mt-1">
                    <p className="text-xs font-bold text-orange-400 px-5 pt-4 pb-2 uppercase tracking-wide">⚡ 용병 ({mercenary.length}명)</p>
                    {mercenary.map((m: Member) => {
                      const checked = attendingIds.has(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleAttending(m.id)}
                          className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-orange-50/60 ${checked ? "bg-orange-50/60" : ""}`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${checked ? "bg-orange-400 border-orange-400" : "border-gray-300"}`}>
                            {checked && <span className="text-white text-xs font-bold leading-none">✓</span>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className={`text-sm font-medium ${checked ? "text-orange-700" : "text-gray-400"}`}>{m.name}</span>
                            {m.is_cafe_mercenary
                              ? <span className="text-xs text-sky-500 bg-sky-50 px-1.5 py-0.5 rounded-full shrink-0">☕카페</span>
                              : m.referrer
                              ? <span className="text-xs text-orange-400 bg-orange-50 px-1.5 py-0.5 rounded-full shrink-0">{m.referrer}지인</span>
                              : null}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {m.position_1st && <span className={`text-xs px-1.5 py-0.5 rounded-full ${checked ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>{m.position_1st}</span>}
                            {m.position_2nd && <span className={`text-xs px-1.5 py-0.5 rounded-full ${checked ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"}`}>{m.position_2nd}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null;
              })()}
            </div>

            {/* 확인 버튼 */}
            <div className="px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => confirmAttendees(attendingIds)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                확인 ({attendingIds.size}명 선택됨)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공유 토스트 */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg">
          🔗 공유 링크가 복사됐어요!
        </div>
      )}

      {/* 저장 모달 */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6" onClick={() => setShowSaveModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-4">
              {loadedAssignmentId ? `"${saveSessionName}" 업데이트` : "배정 저장"}
            </h3>
            {loadedAssignmentId ? (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <p className="text-sm text-blue-700">
                  <b>{saveSessionName}</b>에 현재 배정을 덮어씌웁니다.
                </p>
              </div>
            ) : (
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">저장 이름</label>
              <input
                type="text"
                value={saveSessionName}
                onChange={e => setSaveSessionName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveAssignment()}
                placeholder="예: 1쿼터, 2쿼터..."
                className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
            </div>
            )}
            <div className="flex gap-3">
              <button onClick={saveAssignment} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-semibold">저장</button>
              <button onClick={() => setShowSaveModal(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-xl font-semibold">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 슬롯 클릭 팝업 */}
      {popup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6" onClick={() => setPopup(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-1">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg mr-2">{popup.label}</span>
              포지션
            </h3>

            {popup.currentMember && (
              <div className="mt-3 mb-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-green-600 mb-0.5">현재 배정</p>
                  <p className="font-semibold text-gray-800">{popup.currentMember.name}</p>
                </div>
                <button
                  onClick={handleRemoveMember}
                  className="text-sm text-red-500 hover:text-red-700 font-medium"
                >
                  제거
                </button>
              </div>
            )}

            <p className="text-sm text-gray-500 mb-3">
              {popup.currentMember ? "다른 팀원으로 교체:" : "배정할 팀원 선택:"}
            </p>

            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {(() => {
                const unassigned = getUnassignedMembers(assigned, popup.slotId);
                if (unassigned.length === 0) {
                  return <p className="text-center text-gray-400 py-4 text-sm">미배정 팀원이 없어요</p>;
                }
                const regular = unassigned.filter(m => !m.is_mercenary);
                const mercenary = unassigned.filter(m => m.is_mercenary);
                return (
                  <>
                    {regular.length > 0 && (
                      <>
                        <p className="text-xs font-bold text-gray-400 px-1">👥 정규팀원</p>
                        {regular.map(m => (
                          <button key={m.id} onClick={() => handleAssignMember(m.id)}
                            className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-colors text-left">
                            <span className="font-medium text-gray-800">{m.name}</span>
                            <div className="flex gap-1">
                              {m.position_1st && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">1순위: {m.position_1st}</span>}
                              {m.position_2nd && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">2순위: {m.position_2nd}</span>}
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                    {mercenary.length > 0 && (
                      <>
                        <p className="text-xs font-bold text-orange-400 px-1 mt-1">⚡ 용병</p>
                        {mercenary.map(m => (
                          <button key={m.id} onClick={() => handleAssignMember(m.id)}
                            className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-orange-100 hover:border-orange-400 hover:bg-orange-50 transition-colors text-left">
                            <div>
                              <span className="font-medium text-orange-700">{m.name}</span>
                              {m.is_cafe_mercenary
                                ? <span className="ml-2 text-xs text-sky-500">☕카페</span>
                                : m.referrer
                                ? <span className="ml-2 text-xs text-orange-400">{m.referrer}지인</span>
                                : null}
                            </div>
                            <div className="flex gap-1">
                              {m.position_1st && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">1순위: {m.position_1st}</span>}
                              {m.position_2nd && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">2순위: {m.position_2nd}</span>}
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </div>

            <button onClick={() => setPopup(null)} className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded-xl font-medium transition-colors">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssignPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>}>
      <AssignContent />
    </Suspense>
  );
}

function FormationSelect({ value, onChange, customFormations }: {
  value: string;
  onChange: (v: string) => void;
  customFormations: CustomFormation[];
}) {
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ "⚽ 축구": true });

  const groups: { label: string; keys: string[] }[] = [
    { label: "⚽ 축구", keys: SOCCER_FORMATIONS },
    ...Object.entries(FUTSAL_FORMATIONS).map(([size, keys]) => ({
      label: `🏃 풋살 ${size}`,
      keys,
    })),
    ...(customFormations.length > 0
      ? [{ label: "✏️ 내 커스텀 포메이션", keys: customFormations.map(f => f.id) }]
      : []),
  ];

  const displayName = (key: string) => {
    const cf = customFormations.find(f => f.id === key);
    return cf ? cf.name : key;
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const currentGroup = groups.find(g => g.keys.includes(value));

  return (
    <div className="relative mb-4">
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border-2 border-green-400 focus:border-green-600 rounded-xl px-4 py-3 bg-white transition-colors hover:border-green-500"
      >
        <div className="text-left">
          {currentGroup && (
            <p className="text-xs text-gray-400 leading-none mb-0.5">{currentGroup.label}</p>
          )}
          <p className="font-bold text-gray-800 text-base leading-none">{displayName(value)}</p>
        </div>
        <span className={`text-gray-400 text-sm transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-2xl border border-gray-100 z-40 overflow-hidden max-h-80 overflow-y-auto">
            {groups.map(group => (
              <div key={group.label}>
                {/* 그룹 헤더 */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-bold text-gray-600">{group.label}</span>
                  <span className={`text-xs text-gray-400 transition-transform ${expandedGroups[group.label] ? "rotate-180" : ""}`}>▼</span>
                </button>

                {/* 그룹 아이템 */}
                {expandedGroups[group.label] && (
                  <div>
                    {group.keys.map(key => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { onChange(key); setOpen(false); }}
                        className={`w-full text-left px-6 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                          value === key
                            ? "bg-green-50 text-green-700 font-semibold"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {value === key && <span className="text-green-500 text-xs">✓</span>}
                        <span className={value === key ? "" : "pl-4"}>{displayName(key)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FieldView({ formation, assigned, preview = false, onSlotClick, teamColor = "#facc15", mercenaryIds = new Set() }: {
  formation: Formation;
  assigned: Record<string, Member | null>;
  preview?: boolean;
  onSlotClick?: (slot: PositionSlot) => void;
  teamColor?: string;
  mercenaryIds?: Set<string>;
}) {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{ paddingBottom: "140%", background: "linear-gradient(180deg, #2d7a2d 0%, #1a5c1a 100%)" }}>
      <div className="absolute inset-0">
        <div className="absolute w-full border-t-2 border-white/30" style={{ top: "50%" }} />
        <div className="absolute border-2 border-white/30 rounded-full" style={{ width: "20%", height: "14%", top: "43%", left: "40%" }} />
        <div className="absolute border-2 border-white/30" style={{ width: "50%", height: "13%", top: "2%", left: "25%" }} />
        <div className="absolute border-2 border-white/30" style={{ width: "50%", height: "13%", bottom: "2%", left: "25%" }} />
        <div className="absolute border-2 border-white/40 inset-2 rounded" />
      </div>

      {formation.slots.map(slot => {
        const member = assigned[slot.id];
        const isClickable = !preview && !!onSlotClick;
        const isMercenary = member ? mercenaryIds.has(member.id) : false;

        // 텍스트 색상: 밝은 배경이면 어두운 글씨
        const isLight = teamColor === "#ffffff" || teamColor === "#facc15" || teamColor === "#84cc16";
        const textColor = member ? (isLight ? "#1a1a1a" : "#ffffff") : "#4b5563";

        return (
          <div
            key={slot.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 ${isClickable ? "cursor-pointer" : ""}`}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            onClick={() => isClickable && onSlotClick(slot)}
          >
            <div
              className={`w-12 h-12 rounded-full flex flex-col items-center justify-center font-bold shadow-lg transition-transform ${isClickable ? "hover:scale-110" : ""}`}
              style={{
                backgroundColor: member ? teamColor : "rgba(255,255,255,0.8)",
                border: member
                  ? isMercenary
                    ? "3px solid #ffffff"
                    : `2px solid ${teamColor}cc`
                  : "2px solid white",
                color: textColor,
              }}
            >
              <span className="text-xs font-bold leading-none">{slot.label}</span>
              {member && <span className="text-xs leading-none mt-0.5 truncate max-w-[44px] text-center">{member.name}</span>}
            </div>
            {!member && !preview && (
              <span className="text-white/60 text-xs">미배정</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
