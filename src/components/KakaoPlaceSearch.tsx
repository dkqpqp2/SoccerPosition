"use client";

import { useEffect, useState } from "react";
import { loadKakaoSDK } from "@/lib/kakao";

export interface SelectedPlace {
  name: string;
  lat: number;
  lng: number;
}

interface KakaoPlace {
  place_name: string;
  address_name: string;
  road_address_name?: string;
  x: string; // lng
  y: string; // lat
}

interface Props {
  /** 이미 선택된 장소. null이면 검색 UI 표시. */
  selected: SelectedPlace | null;
  onSelect: (place: SelectedPlace) => void;
  onClear: () => void;
}

export default function KakaoPlaceSearch({ selected, onSelect, onClear }: Props) {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<KakaoPlace[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [ready,    setReady]    = useState(false);
  const [error,    setError]    = useState("");

  useEffect(() => {
    loadKakaoSDK().then(() => setReady(true));
  }, []);

  function search() {
    if (!ready || !query.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(query.trim(), (data: KakaoPlace[], status: string) => {
      setLoading(false);
      if (status === window.kakao.maps.services.Status.OK) {
        setResults(data.slice(0, 5));
      } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
        setError("검색 결과가 없어요. 다른 키워드로 시도해보세요.");
      } else {
        setError("검색 중 오류가 발생했어요.");
      }
    });
  }

  function pick(place: KakaoPlace) {
    onSelect({ name: place.place_name, lat: parseFloat(place.y), lng: parseFloat(place.x) });
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
          disabled={!ready || loading}
          className="shrink-0 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/20 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 transition-colors min-w-[52px]"
        >
          {loading ? <span className="inline-block w-4 h-4 border border-emerald-400 border-t-transparent rounded-full animate-spin" /> : "검색"}
        </button>
      </div>

      {!ready && (
        <p className="text-[11px] text-gray-600 mt-1">카카오맵 초기화 중...</p>
      )}
      {error && (
        <p className="text-xs text-amber-400 mt-1.5">{error}</p>
      )}

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-gray-800 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          {results.map((place, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(place)}
              className="w-full text-left px-4 py-3 hover:bg-white/10 active:bg-white/15 transition-colors border-b border-white/5 last:border-0"
            >
              <p className="text-sm font-medium text-white">{place.place_name}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {place.road_address_name || place.address_name}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
