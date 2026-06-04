import { NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import { supabaseAdmin } from "./supabase";

export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const { data: existing } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("kakao_id", user.id)
        .single();

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
          }
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
