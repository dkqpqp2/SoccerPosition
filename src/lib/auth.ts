import { NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import AppleProvider from "next-auth/providers/apple";
import { supabaseAdmin } from "./supabase";
import { createAppleClientSecret, isAppleConfigured } from "./apple";

// users.kakao_id 칼럼은 "로그인 제공자별 고유 id"로 쓴다. 카카오는 카카오 id 그대로, Apple은 충돌하지 않게 앞에 apple: 을 붙인다.
const APPLE_ID_PREFIX = "apple:";

export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
    }),
    // Apple 설정값이 모두 있을 때만 켠다 (없으면 로그인 화면에도 버튼이 나오지 않음)
    ...(isAppleConfigured()
      ? [AppleProvider({ clientId: process.env.APPLE_CLIENT_ID!, clientSecret: createAppleClientSecret() })]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      try {
      const isApple = account?.provider === "apple";
      const loginId = isApple ? `${APPLE_ID_PREFIX}${account!.providerAccountId}` : user.id;
      // Apple은 이름을 로그인 정보에 담아주지 않을 때가 많다 — 마이페이지에서 바꿀 수 있게 기본 이름을 둔다
      const userName = user.name || (isApple ? "팀원" : user.name);
      let dbUserId: string | null = null;

      const { data: existing } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("kakao_id", loginId)
        .single();
      dbUserId = existing?.id ?? null;

      if (existing) {
        // 기존 유저 로그인 — 본인 팀 team_members에 없으면 자동 추가 (레거시 계정 보완)
        const [{ data: ownerTeam }, { data: userDetail }] = await Promise.all([
          supabaseAdmin.from("teams").select("id").eq("owner_id", existing.id).single(),
          supabaseAdmin.from("users").select("display_name, position_1st, position_2nd").eq("id", existing.id).single(),
        ]);

        if (ownerTeam) {
          // .single()은 중복 행이 이미 있으면 에러를 던지고 "없음"으로 처리돼서 로그인할 때마다 계속 또 추가되는 악순환이 생길 수 있음 — .limit(1)로 방어
          const { data: existingMembers } = await supabaseAdmin
            .from("team_members")
            .select("id")
            .eq("team_id", ownerTeam.id)
            .eq("user_id", existing.id)
            .is("left_at", null)
            .limit(1);

          if (!existingMembers?.length) {
            const displayName = userDetail?.display_name || user.name;
            await supabaseAdmin.from("team_members").insert({
              team_id: ownerTeam.id,
              user_id: existing.id,
              name: displayName,
              position_1st: userDetail?.position_1st ?? null,
              position_2nd: userDetail?.position_2nd ?? null,
              is_mercenary: false,
              is_cafe_mercenary: false,
            });
          }
        }
      }

      if (!existing) {
        // 신규 유저 생성
        const { data: newUser } = await supabaseAdmin
          .from("users")
          .insert({
            kakao_id: loginId,
            name: userName,
            email: user.email,
            image: user.image,
          })
          .select("id")
          .single();

        dbUserId = newUser?.id ?? null;
        if (newUser) {
          // 팀 자동 생성
          const { data: team } = await supabaseAdmin
            .from("teams")
            .insert({
              name: "우리팀",
              color: "#16a34a",
              owner_id: newUser.id,
            })
            .select("id")
            .single();

          if (team) {
            // 팀장으로 등록
            await supabaseAdmin.from("team_users").insert({
              team_id: team.id,
              user_id: newUser.id,
              role: "owner",
            });

            // team_members에도 자동 추가
            await supabaseAdmin.from("team_members").insert({
              team_id: team.id,
              user_id: newUser.id,
              name: userName,
              is_mercenary: false,
              is_cafe_mercenary: false,
            });

            // 새로 만든 팀을 현재 활성 팀으로 지정
            await supabaseAdmin.from("users").update({ active_team_id: team.id }).eq("id", newUser.id);
          }
        }
      }

      // 탈퇴할 때 Apple 연결을 끊으려면 refresh token이 필요하다 — 서버 전용 테이블에 보관
      if (isApple && dbUserId && account?.refresh_token) {
        const { error } = await supabaseAdmin
          .from("apple_credentials")
          .upsert({ user_id: dbUserId, refresh_token: account.refresh_token, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        if (error) console.error("apple credential save failed:", error.message);
      }
      return true;
      } catch (error) {
        console.error("SignIn callback error:", error);
        return true; // 에러가 나도 로그인은 허용
      }
    },
    async jwt({ token, user, account, profile }) {
      // 로그인 직후 한 번만: 세션의 사용자 id(token.sub)를 users.kakao_id에 저장된 값과 똑같이 맞춘다
      if (account?.provider === "apple") token.sub = `${APPLE_ID_PREFIX}${account.providerAccountId}`;
      if (account && profile && account.provider === "kakao") {
        // Kakao 로그인 시 프로필 사진 토큰에 저장
        const kakaoProfile = profile as any;
        token.picture =
          kakaoProfile?.kakao_account?.profile?.profile_image_url ||
          kakaoProfile?.properties?.profile_image ||
          token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        // 프로필 사진 명시적으로 전달
        if (token.picture) {
          session.user.image = token.picture as string;
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    // Apple은 로그인 결과를 다른 사이트(apple.com)에서 POST로 돌려보낸다 → SameSite=None이 아니면 이 쿠키가 안 따라와서 로그인 후 돌아갈 주소(초대 코드 등)를 잃는다
    callbackUrl: {
      name: "next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
    state: {
      name: "next-auth.state",
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
  },
};
