"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { Capacitor } from "@capacitor/core";

// 사용자가 알림 설정에서 직접 끈 기기는 권한이 남아 있어도 자동으로 다시 켜지 않는다
const OFF_KEY = "spm_web_push_off";
export function isWebPushOptedOut() {
  try { return localStorage.getItem(OFF_KEY) === "1"; } catch { return false; }
}
export function setWebPushOptedOut(off: boolean) {
  try { if (off) localStorage.setItem(OFF_KEY, "1"); else localStorage.removeItem(OFF_KEY); } catch { /* 저장 불가 환경은 무시 */ }
}

/** 이 브라우저가 웹 푸시를 받을 수 있는지. 앱(Capacitor)에서는 네이티브 푸시를 쓰므로 false. iOS는 홈 화면에 추가한 웹앱에서만 true가 된다. */
export function isWebPushSupported() {
  if (typeof window === "undefined" || Capacitor.isNativePlatform()) return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/** 구독을 만들거나 기존 구독을 가져와 서버에 등록한다. 알림 권한은 미리 허용돼 있어야 한다. */
export async function subscribeWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("VAPID public key missing");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) throw new Error("subscription register failed");
}

/** 이 기기의 웹 푸시를 끊는다 (알림 끄기, 로그아웃). 실패해도 호출한 쪽 흐름은 계속된다. */
export async function unregisterWebPush() {
  if (!isWebPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  } catch {
    // 실패해도 로그아웃은 계속 진행
  }
}

/** 이미 알림을 허용한 웹앱이 로그인하면 조용히 구독을 서버에 맞춘다 (재로그인·구독 만료 대비). 권한 요청은 하지 않는다. */
export default function WebPushRegistrar() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !isWebPushSupported()) return;
    if (Notification.permission !== "granted" || isWebPushOptedOut()) return;
    subscribeWebPush().catch(() => {
      // 조용히 무시 — 마이페이지 알림 설정에서 다시 켤 수 있다
    });
  }, [status]);

  return null;
}
