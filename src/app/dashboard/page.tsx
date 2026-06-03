"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import SpmLogo from "@/components/SpmLogo";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white px-6 py-4 flex items-center justify-between">
        <SpmLogo size="sm" />
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/mypage")}
            className="flex items-center gap-1.5 text-sm text-green-100 hover:text-white hover:bg-green-600 px-3 py-1.5 rounded-xl transition-colors"
          >
            {session?.user?.image ? (
              <img src={session.user.image} alt="프로필" className="w-7 h-7 rounded-full border border-white/30" />
            ) : (
              <span>👤</span>
            )}
            <span>{session?.user?.name}님</span>
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm bg-green-600 hover:bg-green-500 px-3 py-1 rounded-lg transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className="bg-white rounded-2xl shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push("/members")}
          >
            <div className="text-3xl mb-3">👥</div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">팀원 관리</h2>
            <p className="text-gray-500 text-sm">팀원과 포지션 순위를 등록하세요</p>
          </div>

          <div
            className="bg-white rounded-2xl shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push("/formations")}
          >
            <div className="text-3xl mb-3">🟩</div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">포메이션 관리</h2>
            <p className="text-gray-500 text-sm">나만의 포메이션을 직접 만들어보세요</p>
          </div>

          <div
            className="bg-white rounded-2xl shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push("/matches")}
          >
            <div className="text-3xl mb-3">📅</div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">경기 관리</h2>
            <p className="text-gray-500 text-sm">경기 날짜별로 포지션 배정을 저장하세요</p>
          </div>

          <div
            className="bg-white rounded-2xl shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push("/assign")}
          >
            <div className="text-3xl mb-3">🎯</div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">포지션 배정</h2>
            <p className="text-gray-500 text-sm">팀원에게 포지션을 랜덤 배정하세요</p>
          </div>
        </div>
      </main>
    </div>
  );
}
