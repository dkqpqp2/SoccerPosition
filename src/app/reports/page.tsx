"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";

interface Item {
  key: string;
  target_type: "gallery_photo" | "vote_comment";
  target_ids: string[];
  team_name: string | null;
  author_name: string | null;
  image_urls: string[];
  content: string | null;
  vote_title: string | null;
  reasons: string[];
  report_count: number;
  first_reported_at: string;
}

function ago(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

/** 서비스 운영자 전용: 들어온 신고를 확인하고 삭제하거나 기각한다. 운영자가 아니면 홈으로 보낸다. */
export default function ReportsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/operator/reports");
    if (res.status === 403 || res.status === 401) { router.replace("/dashboard"); return; }
    const data = await res.json().catch(() => []);
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
    if (status === "authenticated") load().catch(() => setLoading(false));
  }, [status, router, load]);

  async function resolve(item: Item, action: "remove" | "dismiss") {
    if (action === "remove" && !confirm("이 내용을 삭제할까요? 되돌릴 수 없어요.")) return;
    setBusyKey(item.key);
    setError("");
    try {
      const res = await fetch("/api/operator/reports/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: item.target_type, target_ids: item.target_ids, action }),
      });
      if (!res.ok) throw new Error();
      setItems(prev => prev.filter(i => i.key !== item.key));
    } catch {
      setError("처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <AppLayout title="신고 관리">
      <div className="max-w-2xl mx-auto space-y-4">
        <p className="text-sm text-gray-400">처리하지 않은 신고 {items.length}건 · 오래된 순서예요. 신고는 24시간 안에 확인한다고 안내했어요.</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {loading && <p className="text-sm text-gray-500">불러오는 중...</p>}
        {!loading && items.length === 0 && (
          <div className="bg-gray-900 border border-white/5 rounded-2xl p-8 text-center text-sm text-gray-500">처리할 신고가 없어요.</div>
        )}
        {items.map(item => (
          <div key={item.key} className="bg-gray-900 border border-white/5 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
              <span>{item.target_type === "gallery_photo" ? "사진" : "투표 댓글"} · {item.team_name ?? "알 수 없는 팀"} · 작성자 {item.author_name ?? "알 수 없음"}</span>
              <span>{ago(item.first_reported_at)} · 신고 {item.report_count}건</span>
            </div>
            {item.vote_title && <p className="text-xs text-gray-500">투표: {item.vote_title}</p>}
            {item.content && <p className="text-sm text-white whitespace-pre-wrap break-words bg-gray-800/60 rounded-xl p-3">{item.content}</p>}
            {item.image_urls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {item.image_urls.map(url => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="신고된 사진" className="w-full aspect-square object-cover rounded-lg" /></a>
                ))}
              </div>
            )}
            {item.reasons.length > 0 && <p className="text-xs text-amber-400">신고 사유: {item.reasons.join(" / ")}</p>}
            <div className="flex gap-2">
              <button
                disabled={busyKey === item.key}
                onClick={() => resolve(item, "dismiss")}
                className="flex-1 bg-gray-800 text-gray-300 font-medium py-2.5 rounded-xl text-sm inline-flex items-center justify-center gap-1 disabled:opacity-50"
              ><Check size={14} /> 문제없음(기각)</button>
              <button
                disabled={busyKey === item.key}
                onClick={() => resolve(item, "remove")}
                className="flex-1 bg-red-500/90 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-sm inline-flex items-center justify-center gap-1 disabled:opacity-50"
              ><Trash2 size={14} /> 삭제</button>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
