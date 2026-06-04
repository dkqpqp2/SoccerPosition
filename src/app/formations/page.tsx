"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import PositionSelect from "@/components/PositionSelect";
import SpmLogo from "@/components/SpmLogo";
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
    if (!result) {
      setParseError("올바른 형식으로 입력해주세요 (예: 4-3-3, 4-2-3-1)");
      return;
    }
    setParseError("");
    setSlots(result);
    setSelectedSlotId(null);
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formationInput.trim(), slots }),
    });

    if (res.ok) {
      setShowEditor(false);
      setFormationInput("");
      setSlots([]);
      setSelectedSlotId(null);
      fetchFormations();
    }
  }

  async function deleteFormation(id: string) {
    if (!confirm("삭제할까요?")) return;
    await fetch(`/api/formations/${id}`, { method: "DELETE" });
    fetchFormations();
  }

  const selectedSlot = slots.find(s => s.id === selectedSlotId);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white px-4 py-3 flex items-center gap-3">
        <SpmLogo size="sm" showText={false} clickable />
        <button onClick={() => router.push("/dashboard")} className="hover:text-green-200 text-sm shrink-0">← 뒤로</button>
        <div className="flex items-center gap-2">
          <span className="text-xl">🟩</span>
          <h1 className="text-lg font-bold">포메이션 관리</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">

        {!showEditor ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <p className="text-sm text-gray-500">커스텀 포메이션 {formations.length}개</p>
              <button
                onClick={() => setShowEditor(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition-colors"
              >
                + 포메이션 만들기
              </button>
            </div>

            {loading ? (
              <p className="text-center text-gray-400 py-10">로딩 중...</p>
            ) : formations.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <div className="text-5xl mb-3">🟩</div>
                <p>아직 커스텀 포메이션이 없어요</p>
                <p className="text-sm mt-1">직접 만들어보세요!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {formations.map(f => (
                  <div key={f.id} className="bg-white rounded-2xl shadow px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800 text-lg">{f.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{f.slots.length}명 · {f.slots.map(s => s.label).join(" - ")}</p>
                    </div>
                    <button onClick={() => deleteFormation(f.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* 포메이션 입력 */}
            <div className="bg-white rounded-2xl shadow p-5 mb-5">
              <label className="text-sm font-semibold text-gray-700 mb-2 block">포메이션 입력</label>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={formationInput}
                  onChange={e => { setFormationInput(e.target.value); setParseError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleGenerate()}
                  placeholder="예: 4-3-3, 4-2-3-1, 3-5-2"
                  className="w-full border-2 border-gray-200 focus:border-green-500 rounded-xl px-4 py-2 font-bold text-lg focus:outline-none"
                />
                <button
                  onClick={handleGenerate}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-semibold transition-colors"
                >
                  생성
                </button>
              </div>
              {parseError && <p className="text-red-500 text-xs mt-2">{parseError}</p>}
              <p className="text-xs text-gray-400 mt-2">숫자를 - 로 구분해 입력 · GK는 자동 포함 · 생성 후 포지션 수정 가능</p>
            </div>

            {/* 그라운드 미리보기 */}
            {slots.length > 0 && (
              <>
                <div
                  ref={fieldRef}
                  className="relative w-full rounded-2xl overflow-hidden mb-4 select-none"
                  style={{ paddingBottom: "140%", background: "linear-gradient(180deg, #2d7a2d 0%, #1a5c1a 100%)" }}
                >
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute w-full border-t-2 border-white/30" style={{ top: "50%" }} />
                    <div className="absolute border-2 border-white/30 rounded-full" style={{ width: "20%", height: "14%", top: "43%", left: "40%" }} />
                    <div className="absolute border-2 border-white/30" style={{ width: "50%", height: "13%", top: "2%", left: "25%" }} />
                    <div className="absolute border-2 border-white/30" style={{ width: "50%", height: "13%", bottom: "2%", left: "25%" }} />
                    <div className="absolute border-2 border-white/40 inset-2 rounded" />
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
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-lg border-2 ${selectedSlotId === slot.id ? "bg-yellow-400 border-yellow-300 text-gray-900 scale-110" : slot.id === "GK" ? "bg-orange-300 border-orange-200 text-gray-900" : "bg-white/90 border-white text-gray-700"}`}>
                        {slot.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 선택된 슬롯 편집 */}
                {selectedSlot && (
                  <div className="bg-white rounded-2xl shadow p-4 mb-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${selectedSlot.id === "GK" ? "bg-orange-300" : "bg-yellow-400"}`}>
                      {selectedSlot.label}
                    </div>
                    <PositionSelect
                      value={selectedSlot.label}
                      onChange={v => updateSlotLabel(selectedSlot.id, v)}
                    />
                    {selectedSlot.id !== "GK" && (
                      <button
                        onClick={() => removeSlot(selectedSlot.id)}
                        className="text-red-400 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 text-sm"
                      >
                        제거
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={saveFormation} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-colors">
                    저장
                  </button>
                  <button onClick={() => { setShowEditor(false); setSlots([]); setFormationInput(""); setSelectedSlotId(null); }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition-colors">
                    취소
                  </button>
                </div>
              </>
            )}

            {slots.length === 0 && (
              <button onClick={() => { setShowEditor(false); setFormationInput(""); }} className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition-colors">
                취소
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
