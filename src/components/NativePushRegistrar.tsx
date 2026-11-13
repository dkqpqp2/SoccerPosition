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

type AppRouter = ReturnType<typeof useRouter>;

// AppLayout은 페이지를 옮길 때마다 새로 만들어진다. 그때마다 권한 확인·토큰 등록·서버 전송을 반복하지 않도록
// 이 페이지를 연 뒤 한 번만 시작하고, 알림 리스너도 한 번만 붙인다(컴포넌트가 사라져도 떼지 않아야 토큰 도착을 놓치지 않는다).
let started = false;
let routerRef: AppRouter | null = null;

async function startNativePush() {
  const { PushNotifications } = await import("@capacitor/push-notifications");

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
  });
  await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const url = notification.data?.url;
    // 서버가 보낸 앱 내부 경로로만 이동
    if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) routerRef?.push(url);
  });

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive === "granted") await PushNotifications.register();
  } catch {
    // 권한 확인 실패는 조용히 무시
  }
}

/** 앱(안드로이드·iOS)에서만 동작: 알림 권한을 요청하고 푸시 토큰을 서버에 등록, 알림을 누르면 해당 화면으로 이동. */
export default function NativePushRegistrar() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    routerRef = router;
  }, [router]);

  useEffect(() => {
    if (status !== "authenticated" || !Capacitor.isNativePlatform() || started) return;
    started = true;
    startNativePush().catch(() => {
      started = false; // 다음 페이지 이동 때 다시 시도
    });
  }, [status]);

  return null;
}
