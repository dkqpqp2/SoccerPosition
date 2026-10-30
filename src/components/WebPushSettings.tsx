"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Bell, BellOff, Share } from "lucide-react";
import { isWebPushOptedOut, isWebPushSupported, setWebPushOptedOut, subscribeWebPush, unregisterWebPush } from "./WebPushRegistrar";

type Mode = "hidden" | "install" | "unsupported" | "default" | "granted" | "denied";

function detectMode(): Mode {
  if (Capacitor.isNativePlatform()) return "hidden"; // 앱은 네이티브 푸시를 쓴다
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isWebPushSupported()) {
    return Notification.permission === "granted" ? (isWebPushOptedOut() ? "default" : "granted") : Notification.permission === "denied" ? "denied" : "default";
  }
  // 아이폰 사파리 탭에서는 푸시 API가 없다 → 홈 화면에 추가해서 열어야 한다
  return isIos ? "install" : "unsupported";
}

/** 마이페이지 알림 설정: 홈 화면에 추가한 웹앱·PC 브라우저에서 푸시 알림을 켜고 끈다. */
export default function WebPushSettings() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setMode(detectMode()); }, []);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setMode(permission === "denied" ? "denied" : "default"); return; }
      await subscribeWebPush();
      setWebPushOptedOut(false);
      setMode("granted");
    } catch {
      setError("알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    await unregisterWebPush();
    setWebPushOptedOut(true);
    // 브라우저 권한은 남아 있지만 구독이 없으므로 '꺼짐' 상태로 보여준다
    setMode("default");
    setBusy(false);
  }

  if (mode === "hidden" || mode === "unsupported") return null;

  return (
    <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
      <h2 className="font-bold text-white mb-3 text-sm flex items-center gap-2"><Bell size={15} strokeWidth={2} /> 알림 설정</h2>

      {mode === "install" && (
        <div className="text-xs text-gray-400 leading-relaxed space-y-1.5">
          <p className="text-gray-300">아이폰은 홈 화면에 추가한 뒤 그 아이콘으로 열어야 알림을 받을 수 있어요. (iOS 16.4 이상)</p>
          <p>① 사파리 하단의 <Share size={12} className="inline -mt-0.5 text-gray-300" /> 공유 버튼</p>
          <p>② <span className="text-gray-300">홈 화면에 추가</span></p>
          <p>③ 홈 화면에 생긴 아이콘으로 열고, 마이페이지에서 알림을 켜세요</p>
        </div>
      )}

      {mode === "default" && (
        <button
          onClick={enable}
          disabled={busy}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-2.5 rounded-xl text-sm transition-colors"
        >
          {busy ? "처리 중..." : "알림 받기"}
        </button>
      )}

      {mode === "granted" && (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-emerald-400"><Bell size={15} /> 알림을 받고 있어요</span>
          <button onClick={disable} disabled={busy} className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50 transition-colors">
            {busy ? "처리 중..." : "끄기"}
          </button>
        </div>
      )}

      {mode === "denied" && (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-sm text-red-400"><BellOff size={15} /> 알림이 차단되어 있어요</span>
          <p className="text-xs text-gray-500 leading-relaxed">기기 설정에서 이 앱(또는 브라우저)의 알림을 허용으로 바꿔 주세요.</p>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
