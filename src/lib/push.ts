import webpush from "web-push";
import { supabaseAdmin } from "./supabase";
import { sendNativePush } from "./fcm";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// 웹 푸시(브라우저·홈 화면에 추가한 웹앱) 발송. 만료된 구독은 자동 삭제.
async function sendWebPush(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return;

  // 런타임에 VAPID 초기화 (빌드 시점엔 환경변수 없음)
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subs?.length) return;

  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      ).catch(async (err) => {
        // 만료된 구독 자동 삭제
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      })
    )
  );
}

// 웹 푸시와 앱 푸시를 함께 보낸다. 한쪽이 실패해도 다른 쪽은 계속 보낸다.
async function sendAll(userIds: string[], payload: PushPayload) {
  const results = await Promise.allSettled([sendWebPush(userIds, payload), sendNativePush(userIds, payload)]);
  results.forEach(r => { if (r.status === "rejected") console.error("push failed:", r.reason); });
}

// 특정 팀의 모든 구독자에게 발송 (발신자 제외)
export async function sendPushToTeam(teamId: string, payload: PushPayload, excludeUserId?: string) {
  const { data: members } = await supabaseAdmin.from("team_users").select("user_id").eq("team_id", teamId);
  const userIds = (members ?? []).map(m => m.user_id as string).filter(uid => uid !== excludeUserId);
  await sendAll(userIds, payload);
}

// 특정 user_id들에게만 발송 (팀 전체가 아니라 배정된 사람에게만 알릴 때 등)
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  await sendAll(userIds, payload);
}
