import { NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import { supabaseAdmin } from "./supabase";

export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "none",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      try {
      const { data: existing } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("kakao_id", user.id)
        .single();

      if (existing) {
        // 기존 유저 로그인 — 본인 팀 team_members에 없으면 자동 추가 (레거시 계정 보완)
        const [{ data: ownerTeam }, { data: userDetail }] = await Promise.all([
          supabaseAdmin.from("teams").select("id").eq("owner_id", existing.id).single(),
          supabaseAdmin.from("users").select("display_name, position_1st, position_2nd").eq("id", existing.id).single(),
        ]);

        if (ownerTeam) {
          const { data: memberExists } = await supabaseAdmin
            .from("team_members")
            .select("id")
            .eq("team_id", ownerTeam.id)
            .eq("user_id", existing.id)
            .single();

          if (!memberExists) {
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
            kakao_id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          })
          .select("id")
          .single();

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
              name: user.name,
              is_mercenary: false,
              is_cafe_mercenary: false,
            });
          }
        }
      }
      return true;
      } catch (error) {
        console.error("SignIn callback error:", error);
        return true; // 에러가 나도 로그인은 허용
      }
    },
    async jwt({ token, user, account, profile }) {
      if (account && profile) {
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
