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
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-900 to-green-700 px-4">
      {/* 상단 로고 */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <SpmLogo size="lg" />
        <p className="text-green-300 text-sm tracking-wide">팀원의 포지션을 스마트하게</p>
      </div>

      {/* 로그인 카드 */}
      <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-5 w-full max-w-xs">
        {/* 아이콘 */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #16a34a, #166534)" }}
        >
          <span className="text-2xl font-black text-white tracking-tighter">SPM</span>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-black text-gray-800">시작하기</h2>
          <p className="text-gray-400 text-sm mt-1">카카오 계정으로 간편하게 로그인</p>
        </div>

        <button
          onClick={() => signIn("kakao")}
          className="w-full flex items-center justify-center gap-2.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3.5 px-6 rounded-xl transition-colors text-sm"
        >
          <span className="text-base">💬</span>
          카카오로 시작하기
        </button>

        <p className="text-xs text-gray-300 text-center">
          Soccer Position Management
        </p>
      </div>
    </div>
  );
}
