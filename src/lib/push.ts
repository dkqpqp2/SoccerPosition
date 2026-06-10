import webpush from "web-push";
import { supabaseAdmin } from "./supabase";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// 특정 팀의 모든 구독자에게 발송 (발신자 제외)
export async function sendPushToTeam(teamId: string, payload: PushPayload, excludeUserId?: string) {
  // 런타임에 VAPID 초기화 (빌드 시점엔 환경변수 없음)
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .eq("team_id", teamId);

  if (!subs?.length) return;

  const targets = excludeUserId ? subs.filter(s => s.user_id !== excludeUserId) : subs;

  await Promise.allSettled(
    targets.map(sub =>
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
