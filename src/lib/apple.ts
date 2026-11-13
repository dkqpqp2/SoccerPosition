import { createPrivateKey, sign } from "crypto";

// Sign in with Apple 설정 (Apple Developer에서 만든 값). 하나라도 없으면 Apple 로그인은 꺼진 상태로 동작한다.
//   APPLE_CLIENT_ID    Services ID (예: com.soccerpositionmanagement.web)
//   APPLE_TEAM_ID      개발자 팀 ID (10자리)
//   APPLE_KEY_ID       Sign in with Apple 키의 Key ID
//   APPLE_PRIVATE_KEY  그 키의 .p8 파일 내용 (줄바꿈은 \n 글자로 써도 됨)
export function isAppleConfigured() {
  return Boolean(
    process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY
  );
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/**
 * Apple은 client secret으로 개인 키(.p8)로 서명한 JWT(ES256)를 요구한다. 유효기간은 최대 6개월이라
 * 시작할 때 하나 만들어 쓴다 — 서버 인스턴스는 그보다 훨씬 자주 새로 뜨므로 만료될 일이 없다.
 */
export function createAppleClientSecret(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: process.env.APPLE_KEY_ID }));
  const payload = b64url(
    JSON.stringify({
      iss: process.env.APPLE_TEAM_ID,
      iat: now,
      exp: now + 60 * 60 * 24 * 150,
      aud: "https://appleid.apple.com",
      sub: process.env.APPLE_CLIENT_ID,
    })
  );
  const key = createPrivateKey(process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n"));
  // JWT의 ES256 서명은 DER이 아니라 r||s 고정 길이(ieee-p1363) 형식이어야 한다
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64url(signature)}`;
}

/** 회원 탈퇴 시 Apple 쪽 로그인 연결을 끊는다 (App Store 심사 규정: Apple로 가입한 계정은 탈퇴 때 토큰을 폐기해야 함). */
export async function revokeAppleToken(refreshToken: string): Promise<boolean> {
  if (!isAppleConfigured()) return false;
  const res = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.APPLE_CLIENT_ID!,
      client_secret: createAppleClientSecret(),
      token: refreshToken,
      token_type_hint: "refresh_token",
    }),
  });
  return res.ok;
}
