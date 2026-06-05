"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { POSITION_MAP } from "@/lib/positions";
import AppLayout from "@/components/AppLayout";
import PositionSelect from "@/components/PositionSelect";

interface Member {
  id: string;
  name: string;
  position_1st: string | null;
  position_2nd: string | null;
  is_mercenary: boolean;
  is_cafe_mercenary: boolean;
  referrer: string | null;
  birth_year: number | null;
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const canManage = userRole === "owner" || userRole === "manager" || userRole === "coach" || userRole === "president";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") { fetchMembers(); fetchUserRole(); }
  }, [status]);

  async function fetchUserRole() {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    setUserRole(data.role ?? null);
  }

  async function fetchMembers() {
    const res = await fetch("/api/members");
    const data = await res.json();
    setMembers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      await fetch(`/api/members/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: false, is_cafe_mercenary: false, referrer: "" });
    setShowForm(false); setEditId(null); fetchMembers();
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    fetchMembers();
  }

  function handleEdit(member: Member) {
    setForm({ name: member.name, position_1st: member.position_1st || "", position_2nd: member.position_2nd || "", is_mercenary: member.is_mercenary, is_cafe_mercenary: member.is_cafe_mercenary, referrer: member.referrer || "" });
    setEditId(member.id); setShowForm(true);
  }

  const regularMembers = members.filter(m => !m.is_mercenary);
  const mercenaryMembers = members.filter(m => m.is_mercenary);
  const allDisplayed = tab === "regular" ? regularMembers : mercenaryMembers;
  const totalPages = Math.ceil(allDisplayed.length / PAGE_SIZE);
  const displayedMembers = allDisplayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppLayout title="팀원 관리">
      <div className="flex justify-end gap-2 px-4 pt-4">
        {canManage && (
          <>
            <button
              onClick={() => { setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: false, is_cafe_mercenary: false, referrer: "" }); setEditId(null); setShowForm(true); }}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3 py-1.5 rounded-xl text-sm transition-colors">
              + 정규팀원
            </button>
            <button
              onClick={() => { setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: true, is_cafe_mercenary: false, referrer: "" }); setEditId(null); setShowForm(true); }}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-xl text-sm transition-colors">
              + 용병
            </button>
          </>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b border-white/5 bg-gray-900/50 mt-2">
        <button onClick={() => { setTab("regular"); setPage(1); }}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === "regular" ? "text-emerald-400 border-b-2 border-emerald-400" : "text-gray-600 hover:text-gray-400"}`}>
          정규 팀원 <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${tab === "regular" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-gray-600"}`}>{regularMembers.length}</span>
        </button>
        <button onClick={() => { setTab("mercenary"); setPage(1); }}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === "mercenary" ? "text-amber-400 border-b-2 border-amber-400" : "text-gray-600 hover:text-gray-400"}`}>
          ⚡ 용병 <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${tab === "mercenary" ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-gray-600"}`}>{mercenaryMembers.length}</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col" style={{ minHeight: "calc(100vh - 140px)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : displayedMembers.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <div className="text-5xl mb-3 opacity-30">{tab === "regular" ? "👥" : "⚡"}</div>
            <p>{tab === "regular" ? "정규 팀원이 없어요" : "용병이 없어요"}</p>
            {canManage && <button onClick={() => { setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: tab === "mercenary", is_cafe_mercenary: false, referrer: "" }); setEditId(null); setShowForm(true); }} className="mt-4 text-sm text-emerald-400 font-bold hover:text-emerald-300">+ 추가하기</button>}
          </div>
        ) : (
          <>
            <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
              {displayedMembers.map((member, idx) => (
                <MemberRow key={member.id} member={member} isLast={idx === displayedMembers.length - 1}
                  onEdit={handleEdit} onDelete={handleDelete} isMercenary={member.is_mercenary}
                  canManage={canManage} onDetail={id => router.push(`/members/${id}`)} />
              ))}
            </div>

            <div className="mt-auto pt-6">
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 border border-white/5 text-gray-400 disabled:opacity-30 hover:bg-white/10 transition-colors">← 이전</button>
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${p === page ? "bg-emerald-500 text-black" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>{p}</button>
                    ))}
                  </div>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 border border-white/5 text-gray-400 disabled:opacity-30 hover:bg-white/10 transition-colors">다음 →</button>
                </div>
              )}
              <p className="text-center text-xs text-gray-600 mt-2">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, allDisplayed.length)} / 총 {allDisplayed.length}명
              </p>
            </div>
          </>
        )}
      </div>

      {/* 모달 폼 */}
      {showForm && canManage && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => { setShowForm(false); setEditId(null); }} />
          <form onSubmit={handleSubmit}
            className="relative bg-gray-900 border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 z-10 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-white text-lg mb-5">{editId ? "팀원 수정" : "팀원 추가"}</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">이름 *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600"
                  placeholder="팀원 이름" required autoFocus />
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
                className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${form.is_mercenary ? "border-amber-400/50 bg-amber-500/10" : "border-white/10 bg-white/3"}`}
                onClick={() => setForm({ ...form, is_mercenary: !form.is_mercenary, is_cafe_mercenary: false, referrer: "" })}
              >
                <div>
                  <p className={`font-medium text-sm ${form.is_mercenary ? "text-amber-400" : "text-gray-400"}`}>⚡ 용병</p>
                  <p className="text-xs text-gray-600">정규 팀원이 아닌 용병</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.is_mercenary ? "bg-amber-400" : "bg-gray-700"}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_mercenary ? "translate-x-6" : "translate-x-1"}`} />
                </div>
              </div>

              {form.is_mercenary && (
                <>
                  <div
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${form.is_cafe_mercenary ? "border-sky-400/50 bg-sky-500/10" : "border-white/10 bg-white/3"}`}
                    onClick={() => setForm({ ...form, is_cafe_mercenary: !form.is_cafe_mercenary, referrer: form.is_cafe_mercenary ? form.referrer : "" })}
                  >
                    <div>
                      <p className={`font-medium text-sm ${form.is_cafe_mercenary ? "text-sky-400" : "text-gray-400"}`}>☕ 카페용병</p>
                      <p className="text-xs text-gray-600">카페를 통해 구한 용병</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.is_cafe_mercenary ? "bg-sky-400" : "bg-gray-700"}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_cafe_mercenary ? "translate-x-6" : "translate-x-1"}`} />
                    </div>
                  </div>

                  {!form.is_cafe_mercenary && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">누구 지인? (선택)</label>
                      <input type="text" value={form.referrer} onChange={e => setForm({ ...form, referrer: e.target.value })}
                        className="w-full bg-gray-800 border border-amber-500/20 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-600"
                        placeholder="예: 김철수" />
                      {form.referrer && <p className="text-xs text-amber-400 mt-1">표시: <b>{form.name || "이름"} ({form.referrer}지인)</b></p>}
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-3 rounded-xl font-bold transition-colors">
                  {editId ? "수정 완료" : "추가"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: false, is_cafe_mercenary: false, referrer: "" }); }}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-3 rounded-xl font-bold transition-colors">취소</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </AppLayout>
  );
}

function MemberRow({ member, isLast, onEdit, onDelete, isMercenary = false, canManage = false, onDetail }: {
  member: Member; isLast: boolean; onEdit: (m: Member) => void; onDelete: (id: string) => void;
  canManage?: boolean; isMercenary?: boolean; onDetail?: (id: string) => void;
}) {
  const age = member.birth_year ? new Date().getFullYear() - member.birth_year : null;

  return (
    <div className={`px-4 py-3 ${!isLast ? "border-b border-white/5" : ""}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => !isMercenary && onDetail?.(member.id)}
            className={`text-sm font-semibold transition-colors ${
              isMercenary ? "text-amber-300 cursor-default" : "text-white hover:text-emerald-400"
            }`}
          >
            {member.name}{isMercenary && <span className="ml-1 text-xs">⚡</span>}
          </button>
          {!isMercenary && (
            age
              ? <span className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full">만 {age}세</span>
              : <span className="text-xs text-gray-700">나이 미설정</span>
          )}
          {isMercenary && member.is_cafe_mercenary && (
            <span className="text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-full">☕ 카페용병</span>
          )}
          {isMercenary && !member.is_cafe_mercenary && member.referrer && (
            <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">{member.referrer}지인</span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {!isMercenary && (
            <button onClick={() => onDetail?.(member.id)}
              className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors font-semibold">
              📝
            </button>
          )}
          {canManage && (
            <>
              <button onClick={() => onEdit(member)} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-blue-500/10 transition-colors">수정</button>
              <button onClick={() => onDelete(member.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors">삭제</button>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {member.position_1st ? (
          <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            1️⃣ {member.position_1st} · {POSITION_MAP[member.position_1st]?.description}
          </span>
        ) : (
          <span className="text-xs text-gray-700">1순위 미설정</span>
        )}
        {member.position_2nd && (
          <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
            2️⃣ {member.position_2nd} · {POSITION_MAP[member.position_2nd]?.description}
          </span>
        )}
      </div>
    </div>
  );
}
