"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import PositionSelect from "@/components/PositionSelect";
import AppLayout from "@/components/AppLayout";
import { PositionSlot } from "@/lib/formations";
import { parseFormation } from "@/lib/formationParser";

interface CustomFormation {
  id: string;
  name: string;
  slots: PositionSlot[];
}

export default function FormationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [formations, setFormations] = useState<CustomFormation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [formationInput, setFormationInput] = useState("");
  const [slots, setSlots] = useState<PositionSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [parseError, setParseError] = useState("");
  const fieldRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") fetchFormations();
  }, [status]);

  async function fetchFormations() {
    const res = await fetch("/api/formations");
    const data = await res.json();
    setFormations(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  function handleGenerate() {
    if (!formationInput.trim()) return;
    const result = parseFormation(formationInput.trim());
    if (!result) { setParseError("올바른 형식으로 입력해주세요 (예: 4-3-3, 4-2-3-1)"); return; }
    setParseError(""); setSlots(result); setSelectedSlotId(null);
  }

  function updateSlotLabel(id: string, label: string) {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, label } : s));
  }

  function removeSlot(id: string) {
    if (id === "GK") return;
    setSlots(prev => prev.filter(s => s.id !== id));
    setSelectedSlotId(null);
  }

  function handleDragStart(e: React.MouseEvent, id: string) {
    e.preventDefault();
    draggingId.current = id;
    setSelectedSlotId(id);
    function onMouseMove(ev: MouseEvent) {
      if (!fieldRef.current || !draggingId.current) return;
      const rect = fieldRef.current.getBoundingClientRect();
      const x = Math.min(95, Math.max(5, ((ev.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(95, Math.max(5, ((ev.clientY - rect.top) / rect.height) * 100));
      setSlots(prev => prev.map(s => s.id === draggingId.current ? { ...s, x: Math.round(x), y: Math.round(y) } : s));
    }
    function onMouseUp() {
      draggingId.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleTouchStart(e: React.TouchEvent, id: string) {
    draggingId.current = id;
    setSelectedSlotId(id);
    function onTouchMove(ev: TouchEvent) {
      if (!fieldRef.current || !draggingId.current) return;
      ev.preventDefault();
      const rect = fieldRef.current.getBoundingClientRect();
      const x = Math.min(95, Math.max(5, ((ev.touches[0].clientX - rect.left) / rect.width) * 100));
      const y = Math.min(95, Math.max(5, ((ev.touches[0].clientY - rect.top) / rect.height) * 100));
      setSlots(prev => prev.map(s => s.id === draggingId.current ? { ...s, x: Math.round(x), y: Math.round(y) } : s));
    }
    function onTouchEnd() {
      draggingId.current = null;
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    }
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
  }

  async function saveFormation() {
    if (!formationInput.trim()) return alert("포메이션 이름을 입력해주세요");
    if (slots.length === 0) return alert("먼저 포메이션을 생성해주세요");
    const res = await fetch("/api/formations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formationInput.trim(), slots }),
    });
    if (res.ok) { setShowEditor(false); setFormationInput(""); setSlots([]); setSelectedSlotId(null); fetchFormations(); }
  }

  async function deleteFormation(id: string) {
    if (!confirm("삭제할까요?")) return;
    await fetch(`/api/formations/${id}`, { method: "DELETE" });
    fetchFormations();
  }

  const selectedSlot = slots.find(s => s.id === selectedSlotId);

  return (
    <AppLayout title="포메이션 관리">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {!showEditor ? (
          <>
            <div className="flex justify-between items-center mb-5">
              <p className="text-xs text-gray-600 uppercase tracking-widest">커스텀 포메이션 {formations.length}개</p>
              <button onClick={() => setShowEditor(true)} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors">
                + 포메이션 만들기
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>
            ) : formations.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-3 opacity-30">🟩</div>
                <p className="text-gray-600">아직 커스텀 포메이션이 없어요</p>
                <p className="text-sm text-gray-700 mt-1">직접 만들어보세요!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {formations.map(f => (
                  <div key={f.id} className="bg-gray-900 border border-white/5 rounded-2xl px-5 py-4 flex items-center justify-between hover:border-white/10 transition-colors">
                    <div>
                      <p className="font-bold text-white">{f.name}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{f.slots.length}명 · {f.slots.map(s => s.label).join(" - ")}</p>
                    </div>
                    <button onClick={() => deleteFormation(f.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors">삭제</button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* 포메이션 입력 */}
            <div className="bg-gray-900 border border-white/5 rounded-2xl p-5 mb-5">
              <label className="text-xs text-gray-500 mb-2 block uppercase tracking-widest font-bold">포메이션 입력</label>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={formationInput}
                  onChange={e => { setFormationInput(e.target.value); setParseError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleGenerate()}
                  placeholder="예: 4-3-3, 4-2-3-1, 3-5-2"
                  className="w-full bg-gray-800 border-2 border-white/10 focus:border-emerald-500 rounded-xl px-4 py-2.5 font-bold text-lg text-white focus:outline-none placeholder-gray-600"
                />
                <button onClick={handleGenerate} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-2.5 rounded-xl font-bold transition-colors">
                  생성
                </button>
              </div>
              {parseError && <p className="text-red-400 text-xs mt-2">{parseError}</p>}
              <p className="text-xs text-gray-600 mt-2">숫자를 - 로 구분해 입력 · GK는 자동 포함 · 생성 후 포지션 수정 가능</p>
            </div>

            {/* 그라운드 미리보기 */}
            {slots.length > 0 && (
              <>
                <div
                  ref={fieldRef}
                  className="relative w-full rounded-2xl overflow-hidden mb-4 select-none"
                  style={{ paddingBottom: "130%", background: "linear-gradient(180deg, #166534 0%, #14532d 40%, #15803d 60%, #166534 100%)" }}
                >
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute border border-white/20 inset-[3%] rounded-sm" />
                    <div className="absolute w-full border-t border-white/20" style={{ top: "50%" }} />
                    <div className="absolute border border-white/20 rounded-full" style={{ width: "20%", height: "14%", top: "43%", left: "40%" }} />
                    <div className="absolute border border-white/20" style={{ width: "50%", height: "13%", top: "2%", left: "25%" }} />
                    <div className="absolute border border-white/20" style={{ width: "50%", height: "13%", bottom: "2%", left: "25%" }} />
                  </div>

                  {slots.map(slot => (
                    <div
                      key={slot.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
                      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                      onMouseDown={e => handleDragStart(e, slot.id)}
                      onTouchStart={e => handleTouchStart(e, slot.id)}
                      onClick={() => setSelectedSlotId(slot.id === selectedSlotId ? null : slot.id)}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-lg border-2 transition-transform ${
                        selectedSlotId === slot.id
                          ? "bg-yellow-400 border-yellow-300 text-gray-900 scale-110"
                          : slot.id === "GK"
                          ? "bg-amber-400 border-amber-300 text-gray-900"
                          : "bg-emerald-400 border-emerald-300 text-gray-900"
                      }`}>
                        {slot.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 선택된 슬롯 편집 */}
                {selectedSlot && (
                  <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 mb-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${selectedSlot.id === "GK" ? "bg-amber-400 text-gray-900" : "bg-yellow-400 text-gray-900"}`}>
                      {selectedSlot.label}
                    </div>
                    <PositionSelect value={selectedSlot.label} onChange={v => updateSlotLabel(selectedSlot.id, v)} />
                    {selectedSlot.id !== "GK" && (
                      <button onClick={() => removeSlot(selectedSlot.id)} className="text-red-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-500/10 text-sm transition-colors">
                        제거
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={saveFormation} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-3 rounded-xl font-bold transition-colors">저장</button>
                  <button onClick={() => { setShowEditor(false); setSlots([]); setFormationInput(""); setSelectedSlotId(null); }}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-3 rounded-xl font-semibold transition-colors">취소</button>
                </div>
              </>
            )}

            {slots.length === 0 && (
              <button onClick={() => { setShowEditor(false); setFormationInput(""); }}
                className="w-full bg-white/5 hover:bg-white/10 text-gray-400 py-3 rounded-xl font-semibold transition-colors">취소</button>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
