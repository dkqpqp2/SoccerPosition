// 웹 푸시 구독 주소는 브라우저 제조사의 푸시 서버 주소여야 한다. 아무 주소나 받으면, 서버가 알림을 보낼 때 그 주소로 요청을 보내게 돼
// 내부 주소 등으로 요청을 유도하는 데 악용될 수 있다. (Chrome·Edge·Firefox·Safari 푸시 서버만 허용)
const PUSH_SERVER_SUFFIXES = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 2048) return false;
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" &&
      !url.port &&
      PUSH_SERVER_SUFFIXES.some(s => url.hostname === s || url.hostname.endsWith(`.${s}`))
    );
  } catch {
    return false;
  }
}
