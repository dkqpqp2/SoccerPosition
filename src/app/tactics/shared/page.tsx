"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PenTool, Share2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";

interface SharedBoard {
  id: string;
  title: string;
  formation_name: string;
  updated_at: string;
}

export default function SharedTacticsPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<SharedBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/formations")
      .then(res => (res.ok ? res.json() : []))
      .then((list: { id: string; name: string }[]) => setCustomNames(Object.fromEntries((Array.isArray(list) ? list : []).map(f => [f.id, f.name]))));
    fetch("/api/tactics/published")
      .then(res => res.json())
      .then(data => { setBoards(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  return (
    <AppLayout title="전술 공유">
      <div className="max-w-lg mx-auto px-3 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : boards.length === 0 ? (
          <div className="text-center py-14 bg-gray-900 border border-white/5 rounded-lg">
            <Share2 size={28} strokeWidth={1.5} className="opacity-30 mx-auto mb-3" />
            <p className="text-sm text-gray-500">아직 공유된 전술판이 없어요</p>
            <p className="text-xs text-gray-600 mt-1">감독·코치가 전술판을 게시하면 여기에 보여요</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
            {boards.map((b, i) => (
              <button
                key={b.id}
                onClick={() => router.push(`/tactics/${b.id}`)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors ${i < boards.length - 1 ? "border-b border-white/[0.03]" : ""}`}
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <PenTool size={14} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{b.title}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">{customNames[b.formation_name] ?? b.formation_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
