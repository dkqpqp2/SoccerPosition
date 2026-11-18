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
 * 환경변수에 붙여넣은 .p8 키를 올바른 PEM 형태로 맞춘다.
 * 입력 화면에 따라 줄바꿈이 공백이나 `\n` 글자로 바뀌거나 따옴표가 붙어도 읽을 수 있게, BEGIN/END 사이의 내용만 뽑아 64자씩 다시 줄바꿈한다.
 */
export function normalizeApplePrivateKey(raw: string): string {
  const text = raw.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  const match = text.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  const label = match ? match[1] : "PRIVATE KEY";
  // BEGIN/END 줄 없이 가운데 글자만 붙여넣은 경우도 있어서, 공백을 뺀 내용이 키 글자(base64)로 보이면 그 내용으로 키를 만든다
  const body = (match ? match[2] : text).replace(/\s+/g, "");
  if (!match && !/^[A-Za-z0-9+/=]{100,}$/.test(body)) return text; // 키처럼 보이지 않으면 그대로 두고 createPrivateKey가 오류를 내게 한다
  return `-----BEGIN ${label}-----\n${(body.match(/.{1,64}/g) ?? []).join("\n")}\n-----END ${label}-----\n`;
}

/** 키 값이 읽히지 않을 때 로그에 남길 형태 정보 (길이와 표시 줄 유무만 — 키 내용은 절대 찍지 않는다). */
export function describeApplePrivateKey(raw: string): string {
  const text = raw.trim();
  return `길이 ${text.length}자, BEGIN줄 ${text.includes("-----BEGIN") ? "있음" : "없음"}, END줄 ${text.includes("-----END") ? "있음" : "없음"}, 줄바꿈 ${text.includes("\n") ? "있음" : text.includes("\\n") ? "\\n 글자" : "없음"}`;
}

/** 설정이 일부만 있을 때 어떤 값이 빠졌는지 알려준다 (로그용 — 값 자체는 절대 찍지 않는다). */
export function missingAppleSettings(): string[] {
  return ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"].filter(name => !process.env[name]);
}

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
  const key = createPrivateKey(normalizeApplePrivateKey(process.env.APPLE_PRIVATE_KEY!));
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
