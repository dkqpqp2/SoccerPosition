import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { supabaseAdmin } from "./supabase";

export interface NativePushPayload {
  title: string;
  body: string;
  url?: string;
}

// FIREBASE_SERVICE_ACCOUNT_JSON: 서비스 계정 키 JSON 전체(또는 그것을 base64로 인코딩한 값).
// 런타임에 초기화한다 (빌드 시점엔 환경변수 없음). 설정이 없으면 앱 푸시만 조용히 건너뛴다.
function getFirebaseApp(): App | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const existing = getApps()[0];
  if (existing) return existing;
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return initializeApp({ credential: cert(JSON.parse(json)) });
}

const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/** 앱(안드로이드·iOS)에 설치된 기기로 푸시 발송. 사용자별 안 읽은 알림 수를 앱 아이콘 숫자(iOS)로 함께 보낸다. */
export async function sendNativePush(userIds: string[], payload: NativePushPayload) {
  if (userIds.length === 0) return;
  const app = getFirebaseApp();
  if (!app) return;

  const { data: devices } = await supabaseAdmin
    .from("device_tokens")
    .select("token, user_id")
    .in("user_id", userIds);
  if (!devices?.length) return;

  const { data: unread } = await supabaseAdmin
    .from("notifications")
    .select("user_id")
    .in("user_id", userIds)
    .eq("is_read", false);
  const unreadOf = new Map<string, number>();
  (unread ?? []).forEach(n => unreadOf.set(n.user_id, (unreadOf.get(n.user_id) ?? 0) + 1));

  const messaging = getMessaging(app);
  // sendEach는 한 번에 최대 500개
  for (let i = 0; i < devices.length; i += 500) {
    const chunk = devices.slice(i, i + 500);
    const result = await messaging.sendEach(
      chunk.map(d => ({
        token: d.token,
        notification: { title: payload.title, body: payload.body },
        data: { url: payload.url ?? "/" },
        android: { priority: "high" as const },
        apns: { payload: { aps: { badge: unreadOf.get(d.user_id) ?? 1, sound: "default" } } },
      }))
    );

    // 앱을 지웠거나 만료된 토큰은 정리
    const dead = chunk.filter((_, idx) => {
      const err = result.responses[idx].error;
      return err && DEAD_TOKEN_CODES.has(err.code);
    });
    if (dead.length > 0) {
      await supabaseAdmin.from("device_tokens").delete().in("token", dead.map(d => d.token));
    }
  }
}
