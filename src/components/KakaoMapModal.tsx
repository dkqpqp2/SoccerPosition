"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoSDK } from "@/lib/kakao";

interface Place {
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  place: Place;
  onClose: () => void;
}

const ROUTE_MODES = [
  { icon: "🚗", label: "자동차" },
  { icon: "🚌", label: "대중교통" },
  { icon: "🚶", label: "도보" },
] as const;

export default function KakaoMapModal({ place, onClose }: Props) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const [ready,    setReady]    = useState(false);
  const [userLoc,  setUserLoc]  = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  const eName = encodeURIComponent(place.name);

  /* SDK 로드 + 지도 초기화 */
  useEffect(() => {
    loadKakaoSDK().then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const kakao  = window.kakao;
    const coords = new kakao.maps.LatLng(place.lat, place.lng);
    const map    = new kakao.maps.Map(mapRef.current, { center: coords, level: 4 });
    const marker = new kakao.maps.Marker({ position: coords });
    marker.setMap(map);
    new kakao.maps.InfoWindow({
      content: `<div style="padding:5px 10px;font-size:13px;font-weight:bold;white-space:nowrap;">${place.name}</div>`,
    }).open(map, marker);
  }, [ready, place]);

  /* 현재 위치 */
  function getLocation() {
    if (!navigator.geolocation) return;
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false); },
      ()  => setLocLoading(false),
      { timeout: 10000 }
    );
  }

  /* 길찾기 URL */
  function routeUrl() {
    if (userLoc) {
      return `https://map.kakao.com/link/from/현재위치,${userLoc.lat},${userLoc.lng}/to/${eName},${place.lat},${place.lng}`;
    }
    return `https://map.kakao.com/link/to/${eName},${place.lat},${place.lng}`;
  }

  /* 카카오내비 딥링크 */
  function openKakaoNavi() {
    window.location.href = `kakaomap://route?ep=${place.lat},${place.lng}&by=CAR`;
    setTimeout(() => { if (!document.hidden) window.open(`https://map.kakao.com/link/to/${eName},${place.lat},${place.lng}`, "_blank"); }, 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 rounded-t-3xl sm:rounded-2xl border border-white/10 w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between">
          <div>
            <h3 className="font-bold text-white">📍 {place.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">경기 장소</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        {/* 지도 */}
        <div ref={mapRef} className="w-full h-52 bg-gray-800">
          {!ready && (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="px-5 py-4 space-y-3">

          {/* 길찾기 */}
          {!userLoc ? (
            <button onClick={getLocation} disabled={locLoading}
              className="w-full text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 font-semibold disabled:opacity-50">
              {locLoading
                ? <><span className="w-4 h-4 border border-gray-400 border-t-transparent rounded-full animate-spin" /> 내 위치 가져오는 중...</>
                : <>📡 내 위치로 길찾기</>}
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {ROUTE_MODES.map(({ icon, label }) => (
                <a key={label} href={routeUrl()} target="_blank" rel="noopener noreferrer"
                  className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs py-3 rounded-xl font-semibold transition-colors flex flex-col items-center gap-1.5">
                  <span className="text-xl">{icon}</span>
                  <span>{label}</span>
                </a>
              ))}
            </div>
          )}

          {/* 카카오내비 */}
          <button onClick={openKakaoNavi}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
            🗺️ 카카오내비 시작
          </button>

          {/* 카카오맵에서 보기 */}
          <a href={`https://map.kakao.com/link/to/${eName},${place.lat},${place.lng}`} target="_blank" rel="noopener noreferrer"
            className="block w-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-semibold py-2.5 rounded-xl transition-colors text-sm text-center">
            카카오맵에서 보기
          </a>
        </div>
      </div>
    </div>
  );
}
