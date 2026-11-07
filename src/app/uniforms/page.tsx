"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import AppLayout from "@/components/AppLayout";

interface Category { id: string; name: string; sort_order: number }
interface Member { id: string; name: string; jersey_number: number | null }

const keyOf = (memberId: string, categoryId: string) => `${memberId}:${categoryId}`;

export default function UniformsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [missingFilter, setMissingFilter] = useState(""); // 이 항목이 없는 팀원만 보기

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") load();
  }, [status]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/uniforms");
      if (res.status === 403) { setForbidden(true); return; }
      if (!res.ok) throw new Error();
      const data: { categories: Category[]; members: Member[]; records: { member_id: string; category_id: string }[] } = await res.json();
      setCategories(data.categories);
      setMembers(data.members);
      setOwned(new Set(data.records.map(r => keyOf(r.member_id, r.category_id))));
    } catch {
      setError("불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function toggle(memberId: string, categoryId: string) {
    const key = keyOf(memberId, categoryId);
    const next = !owned.has(key);
    setError("");
    const apply = (has: boolean) => setOwned(prev => {
      const s = new Set(prev);
      if (has) s.add(key); else s.delete(key);
      return s;
    });
    apply(next);
    try {
      const res = await fetch("/api/uniforms/records", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, category_id: categoryId, has_item: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      apply(!next);
      setError("저장하지 못했어요. 다시 눌러 주세요.");
    }
  }

  async function addCategory() {
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/uniforms/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "추가하지 못했어요."); return; }
      setCategories(prev => [...prev, data]);
      setNewName("");
    } catch {
      setError("추가하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setAdding(false);
    }
  }

  async function renameCategory() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    setError("");
    try {
      const res = await fetch(`/api/uniforms/categories/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "이름을 바꾸지 못했어요."); return; }
      setCategories(prev => prev.map(c => (c.id === data.id ? data : c)));
      setEditing(null);
    } catch {
      setError("이름을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }

  async function deleteCategory() {
    if (!deleting) return;
    const target = deleting;
    setError("");
    try {
      const res = await fetch(`/api/uniforms/categories/${target.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCategories(prev => prev.filter(c => c.id !== target.id));
      setOwned(prev => new Set([...prev].filter(k => !k.endsWith(`:${target.id}`))));
      if (missingFilter === target.id) setMissingFilter("");
      setDeleting(null);
    } catch {
      setError("삭제하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setDeleting(null);
    }
  }

  const countOf = (categoryId: string) => members.filter(m => owned.has(keyOf(m.id, categoryId))).length;
  const visibleMembers = useMemo(
    () => (missingFilter ? members.filter(m => !owned.has(keyOf(m.id, missingFilter))) : members),
    [members, owned, missingFilter]
  );

  const helpContent = {
    items: [
      { icon: "👕", title: "보유 여부 체크", desc: "팀원별로 하계·동계 같은 항목을 가지고 있으면 체크해요. 칸을 누르면 바로 저장돼요." },
      { icon: "➕", title: "항목 직접 추가", desc: "조끼, 신가드처럼 필요한 항목을 이름만 적어 추가할 수 있어요. 연필로 이름을 바꾸고, 휴지통으로 지워요." },
      { icon: "🔍", title: "없는 사람만 보기", desc: "'미보유만 보기'에서 항목을 고르면 그걸 아직 못 받은 팀원만 모아 볼 수 있어요." },
      { icon: "🔒", title: "볼 수 있는 사람", desc: "팀장·매니저·회장만 보고 고칠 수 있어요. 일반 팀원에게는 메뉴도 보이지 않아요." },
    ],
  };

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <AppLayout title="유니폼 관리" helpContent={helpContent}>
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (forbidden) {
    return (
      <AppLayout title="유니폼 관리" helpContent={helpContent}>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm text-gray-400">
          유니폼 관리는 팀장·매니저·회장만 볼 수 있어요.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="유니폼 관리" helpContent={helpContent}>
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {/* 항목 추가 + 필터 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addCategory(); }}
              maxLength={20}
              placeholder="항목 추가 (예: 조끼, 신가드)"
              className="flex-1 min-w-0 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
            />
            <button
              onClick={addCategory}
              disabled={adding || !newName.trim()}
              className="shrink-0 flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <Plus size={14} strokeWidth={2.5} /> 추가
            </button>
          </div>
          {categories.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <label htmlFor="missing-filter" className="shrink-0">미보유만 보기</label>
              <select
                id="missing-filter"
                value={missingFilter}
                onChange={e => setMissingFilter(e.target.value)}
                className="bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-gray-200 focus:outline-none"
              >
                <option value="">전체 팀원</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name} 없는 팀원</option>)}
              </select>
            </div>
          )}
        </div>

        {/* 팀원 × 항목 표 */}
        {members.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-12">등록된 팀원이 없어요.</div>
        ) : (
          <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-900 text-left text-xs font-bold text-gray-400 px-4 py-3 border-b border-white/5 whitespace-nowrap">
                    팀원 ({visibleMembers.length})
                  </th>
                  {categories.map(c => (
                    <th key={c.id} className="px-3 py-2 border-b border-white/5 align-top min-w-[84px]">
                      {editing?.id === c.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={editing.name}
                            maxLength={20}
                            onChange={e => setEditing({ id: c.id, name: e.target.value })}
                            onKeyDown={e => { if (e.key === "Enter") renameCategory(); if (e.key === "Escape") setEditing(null); }}
                            className="w-20 bg-gray-800 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none"
                          />
                          <button onClick={renameCategory} aria-label="이름 저장" className="text-emerald-400"><Check size={14} /></button>
                          <button onClick={() => setEditing(null)} aria-label="취소" className="text-gray-500"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-white whitespace-nowrap">{c.name}</span>
                          <span className="text-[10px] text-emerald-400 font-semibold">{countOf(c.id)}/{members.length}</span>
                          <span className="flex gap-2 text-gray-600">
                            <button onClick={() => setEditing({ id: c.id, name: c.name })} aria-label={`${c.name} 이름 바꾸기`} className="hover:text-gray-300"><Pencil size={12} /></button>
                            <button onClick={() => setDeleting(c)} aria-label={`${c.name} 삭제`} className="hover:text-red-400"><Trash2 size={12} /></button>
                          </span>
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map(m => (
                  <tr key={m.id}>
                    <td className="sticky left-0 z-10 bg-gray-900 px-4 py-2.5 border-b border-white/5 whitespace-nowrap text-white">
                      {m.name}
                      {m.jersey_number != null && <span className="ml-1.5 text-[11px] text-gray-500">#{m.jersey_number}</span>}
                    </td>
                    {categories.map(c => {
                      const has = owned.has(keyOf(m.id, c.id));
                      return (
                        <td key={c.id} className="px-3 py-2.5 border-b border-white/5 text-center">
                          <button
                            onClick={() => toggle(m.id, c.id)}
                            aria-pressed={has}
                            aria-label={`${m.name} ${c.name} ${has ? "보유" : "미보유"}`}
                            className={`w-8 h-8 rounded-lg border inline-flex items-center justify-center transition-colors ${
                              has
                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                : "bg-gray-800 border-white/10 text-transparent hover:border-white/30"
                            }`}
                          >
                            <Check size={16} strokeWidth={3} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {visibleMembers.length === 0 && (
                  <tr><td colSpan={categories.length + 1} className="text-center text-xs text-gray-500 py-8">모두 가지고 있어요 🎉</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 항목 삭제 확인 */}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-6" onClick={() => setDeleting(null)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <p className="text-white font-bold mb-1">&quot;{deleting.name}&quot; 항목을 지울까요?</p>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">팀원별로 체크해 둔 {deleting.name} 기록도 모두 사라지고 되돌릴 수 없어요.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleting(null)} className="flex-1 bg-gray-800 text-gray-300 font-medium py-2.5 rounded-xl text-sm">취소</button>
              <button onClick={deleteCategory} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-2.5 rounded-xl text-sm">삭제</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
