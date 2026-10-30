"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

const TOKEN_KEY = "spm_push_token";

/** 로그아웃할 때 호출: 이 기기로 가던 푸시를 끊는다 (다른 사람이 같은 폰으로 로그인해도 이전 사용자 알림이 안 가게). */
export async function unregisterNativePush() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await fetch("/api/push/device", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 실패해도 로그아웃은 계속 진행
  }
}

/** 앱(안드로이드·iOS)에서만 동작: 알림 권한을 요청하고 푸시 토큰을 서버에 등록, 알림을 누르면 해당 화면으로 이동. */
export default function NativePushRegistrar() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated" || !Capacitor.isNativePlatform()) return;

    const handles: { remove: () => Promise<void> }[] = [];
    let cancelled = false;

    (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");

      handles.push(
        await PushNotifications.addListener("registration", async ({ value }) => {
          try {
            const res = await fetch("/api/push/device", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: value, platform: Capacitor.getPlatform() }),
            });
            if (res.ok) localStorage.setItem(TOKEN_KEY, value);
          } catch {
            // 오프라인 등 — 다음 실행 때 다시 등록된다
          }
        })
      );
      handles.push(
        await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
          const url = notification.data?.url;
          // 서버가 보낸 앱 내부 경로로만 이동
          if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) router.push(url);
        })
      );
      if (cancelled) return;

      try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive === "granted") await PushNotifications.register();
      } catch {
        // 권한 확인 실패는 조용히 무시
      }
    })();

    return () => {
      cancelled = true;
      handles.forEach(h => { void h.remove(); });
    };
  }, [status, router]);

  return null;
}
