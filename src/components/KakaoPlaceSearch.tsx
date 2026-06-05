"use client";

import { useState } from "react";

export interface SelectedPlace {
  name: string;
  lat: number;
  lng: number;
}

interface KakaoDocument {
  place_name: string;
  address_name: string;
  road_address_name?: string;
  x: string; // lng
  y: string; // lat
}

interface Props {
  selected: SelectedPlace | null;
  onSelect: (place: SelectedPlace) => void;
  onClear: () => void;
}

export default function KakaoPlaceSearch({ selected, onSelect, onClear }: Props) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<KakaoDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function search() {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch(`/api/kakao/places?q=${encodeURIComponent(q)}`);
      const data = await res.json();

      if (!res.ok) {
        setError("검색 오류: " + (data.error ?? res.status));
        return;
      }

      const docs: KakaoDocument[] = data.documents ?? [];
      if (docs.length === 0) {
        setError("검색 결과가 없어요. 다른 키워드로 시도해보세요.");
      } else {
        setResults(docs);
      }
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  function pick(doc: KakaoDocument) {
    onSelect({ name: doc.place_name, lat: parseFloat(doc.y), lng: parseFloat(doc.x) });
    setResults([]);
    setQuery("");
  }

  /* ── 선택 완료 상태 ── */
  if (selected) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-800 border border-emerald-500/30 rounded-lg px-3 py-2 text-sm truncate">
          <span className="text-emerald-400 font-medium">📍 {selected.name}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-gray-500 hover:text-white text-sm px-2.5 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          ✕
        </button>
      </div>
    );
  }

  /* ── 검색 UI ── */
  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
          placeholder="경기장 이름으로 검색 (예: 황구지천)"
          className="flex-1 bg-gray-800 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="shrink-0 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/20 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 transition-colors min-w-[52px] flex items-center justify-center"
        >
          {loading
            ? <span className="inline-block w-4 h-4 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
            : "검색"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-amber-400 mt-1.5">{error}</p>
      )}

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-gray-800 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          {results.map((doc, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(doc)}
              className="w-full text-left px-4 py-3 hover:bg-white/10 active:bg-white/15 transition-colors border-b border-white/5 last:border-0"
            >
              <p className="text-sm font-medium text-white">{doc.place_name}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {doc.road_address_name || doc.address_name}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
