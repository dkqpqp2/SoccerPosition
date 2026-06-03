"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-800 to-green-600">
      <div className="bg-white rounded-2xl shadow-xl p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="text-5xl">⚽</div>
        <h1 className="text-2xl font-bold text-gray-800 text-center">
          축구 포지션 배정
        </h1>
        <p className="text-gray-500 text-center text-sm">
          팀원의 포지션을 스마트하게 배정해드립니다
        </p>
        <button
          onClick={() => signIn("kakao")}
          className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          <span className="text-lg">💬</span>
          카카오로 시작하기
        </button>
      </div>
    </div>
  );
}
