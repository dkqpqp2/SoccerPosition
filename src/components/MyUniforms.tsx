"use client";

import { useEffect, useState } from "react";
import { Check, Shirt } from "lucide-react";

interface Category { id: string; name: string }

/** 마이페이지: 내가 가진 유니폼(하계·동계 등)을 직접 체크한다. 항목은 팀 관리자가 만든 것이 그대로 나오고, 체크하면 관리자 화면에도 반영된다. */
export default function MyUniforms() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/uniforms/me")
      .then(r => (r.ok ? r.json() : null))
      .then((data: { categories: Category[]; owned: string[] } | null) => {
        if (!data) return;
        setCategories(data.categories);
        setOwned(new Set(data.owned));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function toggle(categoryId: string) {
    const next = !owned.has(categoryId);
    setError("");
    const apply = (has: boolean) => setOwned(prev => {
      const s = new Set(prev);
      if (has) s.add(categoryId); else s.delete(categoryId);
      return s;
    });
    apply(next);
    try {
      const res = await fetch("/api/uniforms/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, has_item: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      apply(!next);
      setError("저장하지 못했어요. 다시 눌러 주세요.");
    }
  }

  // 팀이 없거나 팀원 정보가 없으면 보여줄 게 없다
  if (!loaded || categories.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
      <h2 className="font-bold text-white mb-1 text-sm flex items-center gap-2"><Shirt size={15} strokeWidth={2} /> 내 유니폼</h2>
      <p className="text-xs text-gray-500 mb-3">가지고 있는 것을 눌러 체크해 주세요. 팀 관리자도 볼 수 있어요.</p>
      <div className="flex flex-wrap gap-2">
        {categories.map(c => {
          const has = owned.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              aria-pressed={has}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors ${
                has
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                  : "bg-gray-800 border-white/10 text-gray-400 hover:border-white/30"
              }`}
            >
              {has && <Check size={14} strokeWidth={3} />}
              {c.name}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
