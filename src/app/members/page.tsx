"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { POSITION_MAP } from "@/lib/positions";
import PositionSelect from "@/components/PositionSelect";

interface Member {
  id: string;
  name: string;
  position_1st: string | null;
  position_2nd: string | null;
  is_mercenary: boolean;
  is_cafe_mercenary: boolean;
  referrer: string | null;
}

interface FormData {
  name: string;
  position_1st: string;
  position_2nd: string;
  is_mercenary: boolean;
  is_cafe_mercenary: boolean;
  referrer: string;
}

export default function MembersPage() {
  const { status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ name: "", position_1st: "", position_2nd: "", is_mercenary: false, is_cafe_mercenary: false, referrer: "" });
  const [tab, setTab] = useState<"regular" | "mercenary">("regular");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") fetchMembers();
  }, [status]);

  async function fetchMembers() {
    const res = await fetch("/api/members");
    const data = await res.json();
    setMembers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      await fetch(`/api/members/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: false, is_cafe_mercenary: false, referrer: "" });
    setShowForm(false);
    setEditId(null);
    fetchMembers();
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    fetchMembers();
  }

  function handleEdit(member: Member) {
    setForm({
      name: member.name,
      position_1st: member.position_1st || "",
      position_2nd: member.position_2nd || "",
      is_mercenary: member.is_mercenary,
      is_cafe_mercenary: member.is_cafe_mercenary,
      referrer: member.referrer || "",
    });
    setEditId(member.id);
    setShowForm(true);
  }

  function openAdd() {
    setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: false, is_cafe_mercenary: false, referrer: "" });
    setEditId(null);
    setShowForm(true);
  }

  const regularMembers = members.filter(m => !m.is_mercenary);
  const mercenaryMembers = members.filter(m => m.is_mercenary);
  const allDisplayed = tab === "regular" ? regularMembers : mercenaryMembers;
  const totalPages = Math.ceil(allDisplayed.length / PAGE_SIZE);
  const displayedMembers = allDisplayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-white hover:text-green-200">← 뒤로</button>
          <div className="flex items-center gap-2">
            <span className="text-xl">👥</span>
            <h1 className="text-lg font-bold">팀원 관리</h1>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="bg-white text-green-700 font-bold px-3 py-1.5 rounded-xl text-sm"
        >
          + 추가
        </button>
      </header>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => { setTab("regular"); setPage(1); }}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === "regular" ? "text-green-600 border-b-2 border-green-600" : "text-gray-400"}`}
        >
          정규 팀원 <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${tab === "regular" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>{regularMembers.length}</span>
        </button>
        <button
          onClick={() => { setTab("mercenary"); setPage(1); }}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === "mercenary" ? "text-orange-500 border-b-2 border-orange-500" : "text-gray-400"}`}
        >
          ⚡ 용병 <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${tab === "mercenary" ? "bg-orange-100 text-orange-500" : "bg-gray-100 text-gray-400"}`}>{mercenaryMembers.length}</span>
        </button>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col" style={{ minHeight: "calc(100vh - 112px)" }}>
        {loading ? (
          <p className="text-center text-gray-400 py-16">로딩 중...</p>
        ) : displayedMembers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">{tab === "regular" ? "👥" : "⚡"}</div>
            <p>{tab === "regular" ? "정규 팀원이 없어요" : "용병이 없어요"}</p>
            <button onClick={openAdd} className="mt-4 text-sm text-green-600 font-bold">+ 추가하기</button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              {displayedMembers.map((member, idx) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isLast={idx === displayedMembers.length - 1}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isMercenary={member.is_mercenary}
                />
              ))}
            </div>

            {/* 페이지네이션 - 항상 하단 고정 */}
            <div className="mt-auto pt-6">
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white shadow disabled:opacity-30 hover:bg-gray-50 transition-colors"
                >
                  ← 이전
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                        p === page
                          ? "bg-green-600 text-white"
                          : "bg-white shadow text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white shadow disabled:opacity-30 hover:bg-gray-50 transition-colors"
                >
                  다음 →
                </button>
              </div>
            )}

            <p className="text-center text-xs text-gray-400 mt-2">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, allDisplayed.length)} / 총 {allDisplayed.length}명
            </p>
            </div>
          </>
        )}
      </main>

      {/* 모달 폼 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowForm(false); setEditId(null); }} />
          <form
            onSubmit={handleSubmit}
            className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl p-6 z-10"
          >
            <h2 className="font-bold text-gray-800 text-lg mb-5">{editId ? "팀원 수정" : "팀원 추가"}</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">이름 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="팀원 이름"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">1순위 포지션</label>
                <PositionSelect value={form.position_1st} onChange={v => setForm({ ...form, position_1st: v })} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">2순위 포지션</label>
                <PositionSelect value={form.position_2nd} onChange={v => setForm({ ...form, position_2nd: v })} />
              </div>

              {/* 용병 토글 */}
              <div
                className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${form.is_mercenary ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-gray-50"}`}
                onClick={() => setForm({ ...form, is_mercenary: !form.is_mercenary, is_cafe_mercenary: false, referrer: "" })}
              >
                <div>
                  <p className={`font-medium text-sm ${form.is_mercenary ? "text-orange-600" : "text-gray-600"}`}>⚡ 용병</p>
                  <p className="text-xs text-gray-400">정규 팀원이 아닌 용병</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.is_mercenary ? "bg-orange-400" : "bg-gray-300"}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_mercenary ? "translate-x-6" : "translate-x-1"}`} />
                </div>
              </div>

              {/* 용병일 때만 추가 옵션 */}
              {form.is_mercenary && (
                <>
                  {/* 카페용병 토글 */}
                  <div
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${form.is_cafe_mercenary ? "border-sky-400 bg-sky-50" : "border-gray-200 bg-gray-50"}`}
                    onClick={() => setForm({ ...form, is_cafe_mercenary: !form.is_cafe_mercenary, referrer: form.is_cafe_mercenary ? form.referrer : "" })}
                  >
                    <div>
                      <p className={`font-medium text-sm ${form.is_cafe_mercenary ? "text-sky-600" : "text-gray-600"}`}>☕ 카페용병</p>
                      <p className="text-xs text-gray-400">카페를 통해 구한 용병</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.is_cafe_mercenary ? "bg-sky-400" : "bg-gray-300"}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_cafe_mercenary ? "translate-x-6" : "translate-x-1"}`} />
                    </div>
                  </div>

                  {/* 카페용병이 아닐 때만 지인 입력칸 */}
                  {!form.is_cafe_mercenary && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">누구 지인? (선택)</label>
                      <input
                        type="text"
                        value={form.referrer}
                        onChange={e => setForm({ ...form, referrer: e.target.value })}
                        className="w-full border border-orange-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50"
                        placeholder="예: 김철수"
                      />
                      {form.referrer && (
                        <p className="text-xs text-orange-500 mt-1">표시: <b>{form.name || "이름"} ({form.referrer}지인)</b></p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold transition-colors">
                  {editId ? "수정 완료" : "추가"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: false, is_cafe_mercenary: false, referrer: "" }); }} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold transition-colors">
                  취소
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, isLast, onEdit, onDelete, isMercenary = false }: {
  member: Member;
  isLast: boolean;
  onEdit: (m: Member) => void;
  onDelete: (id: string) => void;
  isMercenary?: boolean;
}) {
  return (
    <div className={`px-4 py-2.5 ${!isLast ? "border-b border-gray-100" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-sm font-semibold ${isMercenary ? "text-orange-600" : "text-gray-800"}`}>
            {member.name}{isMercenary && <span className="ml-1 text-xs">⚡</span>}
          </span>
          {isMercenary && member.is_cafe_mercenary && (
            <span className="text-xs text-sky-500 bg-sky-50 px-1.5 py-0.5 rounded-full">☕ 카페용병</span>
          )}
          {isMercenary && !member.is_cafe_mercenary && member.referrer && (
            <span className="text-xs text-orange-400 bg-orange-50 px-1.5 py-0.5 rounded-full">
              {member.referrer}지인
            </span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(member)} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50">수정</button>
          <button onClick={() => onDelete(member.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">삭제</button>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {member.position_1st ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            1️⃣ {member.position_1st} · {POSITION_MAP[member.position_1st]?.description}
          </span>
        ) : (
          <span className="text-xs text-gray-300">1순위 미설정</span>
        )}
        {member.position_2nd && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            2️⃣ {member.position_2nd} · {POSITION_MAP[member.position_2nd]?.description}
          </span>
        )}
      </div>
    </div>
  );
}
