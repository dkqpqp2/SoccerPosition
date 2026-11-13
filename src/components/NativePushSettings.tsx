"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Capacitor } from "@capacitor/core";
import { Bell, BellOff } from "lucide-react";
import { enableNativePush, isNativePushOff, setNativePushOff, unregisterNativePush } from "./NativePushRegistrar";

type Mode = "hidden" | "loading" | "on" | "off" | "denied";

/** 마이페이지(앱 전용): 이 폰으로 받는 알림을 앱 안에서 켜고 끈다. 폰 설정에서 막힌 경우에는 켜는 방법을 안내한다. */
export default function NativePushSettings() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const [mode, setMode] = useState<Mode>("hidden");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // 앱이 아니거나, 알림 기능이 없는 예전 앱(1.5 이하)이면 보이지 않는다
    if (!userId || !Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("PushNotifications")) return;
    setMode("loading");
    import("@capacitor/push-notifications")
      .then(({ PushNotifications }) => PushNotifications.checkPermissions())
      .then(perm => {
        if (perm.receive === "denied") setMode("denied");
        else if (perm.receive === "granted" && !isNativePushOff(userId)) setMode("on");
        else setMode("off");
      })
      .catch(() => setMode("hidden"));
  }, [userId]);

  async function turnOn() {
    if (!userId) return;
    setBusy(true);
    setError("");
    try {
      setNativePushOff(userId, false);
      const result = await enableNativePush();
      setMode(result === "granted" ? "on" : result === "denied" ? "denied" : "off");
    } catch {
      setError("알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!userId) return;
    setBusy(true);
    setError("");
    setNativePushOff(userId, true); // 먼저 표시해 두면, 서버 해제가 실패해도 앱을 다시 열 때 다시 켜지지 않는다
    await unregisterNativePush();
    setMode("off");
    setBusy(false);
  }

  if (mode === "hidden" || mode === "loading") return null;

  return (
    <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
      <h2 className="font-bold text-white mb-3 text-sm flex items-center gap-2"><Bell size={15} strokeWidth={2} /> 앱 알림</h2>

      {mode === "on" && (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-emerald-400"><Bell size={15} /> 알림을 받고 있어요</span>
          <button onClick={turnOff} disabled={busy} className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50 transition-colors">
            {busy ? "처리 중..." : "끄기"}
          </button>
        </div>
      )}

      {mode === "off" && (
        <>
          <p className="text-xs text-gray-500 mb-3">투표, 회비 요청, 포지션 배정 소식을 이 폰으로 받아요.</p>
          <button
            onClick={turnOn}
            disabled={busy}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            {busy ? "처리 중..." : "알림 받기"}
          </button>
        </>
      )}

      {mode === "denied" && (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-sm text-red-400"><BellOff size={15} /> 폰에서 알림이 차단되어 있어요</span>
          <p className="text-xs text-gray-500 leading-relaxed">
            폰의 <span className="text-gray-300">설정 → 앱 → 스포츠팀매니저 → 알림</span>에서 허용으로 바꾼 뒤, 앱을 다시 열어 주세요.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
