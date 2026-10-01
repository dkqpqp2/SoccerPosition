"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { RefreshCw } from "lucide-react";

export default function InAppUpdateBanner() {
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

    let listenerHandle: { remove: () => void } | null = null;

    (async () => {
      const { AppUpdate, AppUpdateAvailability, FlexibleUpdateInstallStatus } = await import(
        "@capawesome/capacitor-app-update"
      );

      listenerHandle = await AppUpdate.addListener("onFlexibleUpdateStateChange", state => {
        if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) setDownloaded(true);
      });

      try {
        const info = await AppUpdate.getAppUpdateInfo();
        if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE && info.flexibleUpdateAllowed) {
          await AppUpdate.startFlexibleUpdate();
        }
      } catch {
        // 업데이트 확인 실패는 조용히 무시 (오프라인 등)
      }
    })();

    return () => listenerHandle?.remove();
  }, []);

  if (!downloaded) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 border border-emerald-500/30 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-sm text-gray-200">새 버전이 준비됐어요</p>
      <button
        onClick={async () => {
          const { AppUpdate } = await import("@capawesome/capacitor-app-update");
          await AppUpdate.completeFlexibleUpdate();
        }}
        className="flex items-center gap-1 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
      >
        <RefreshCw size={14} /> 재시작
      </button>
    </div>
  );
}
