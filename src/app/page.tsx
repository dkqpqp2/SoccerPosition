"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import SpmLogo from "@/components/SpmLogo";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4 relative overflow-hidden">
      {/* 배경 그라디언트 효과 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.08)_0%,_transparent_65%)] pointer-events-none" />

      {/* 로고 */}
      <div className="relative mb-8 flex flex-col items-center gap-3">
        <SpmLogo size="lg" />
        <p className="text-gray-600 text-sm tracking-wide">팀원의 포지션을 스마트하게</p>
      </div>

      {/* 로그인 카드 */}
      <div className="relative bg-gray-900 border border-white/10 rounded-3xl p-8 flex flex-col items-center gap-5 w-full max-w-xs shadow-2xl shadow-black/40">

        <div className="text-center">
          <h2 className="text-xl font-black text-white">시작하기</h2>
          <p className="text-gray-500 text-sm mt-1">카카오 계정으로 간편하게 로그인</p>
        </div>

        <button
          onClick={() => signIn("kakao")}
          className="w-full flex items-center justify-center gap-2.5 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-3.5 px-6 rounded-xl transition-colors text-sm shadow-lg shadow-yellow-400/20"
        >
          <span className="text-base">💬</span>
          카카오로 시작하기
        </button>

        <p className="text-xs text-gray-700 text-center">
          Soccer Position Management
        </p>
      </div>

      {/* 하단 장식 */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
    </div>
  );
}
