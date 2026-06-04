"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import SpmLogo from "@/components/SpmLogo";

function JoinContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? "";

  const [code, setCode] = useState(codeFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 로그인 안 된 상태로 초대 링크 접속 → 로그인 후 자동 복귀
  useEffect(() => {
    if (status === "unauthenticated" && codeFromUrl) {
      signIn("kakao", { callbackUrl: `/join?code=${codeFromUrl}` });
    }
  }, [status, codeFromUrl]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/team/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: code.trim() }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "오류가 발생했어요");
    } else {
      setSuccess(`🎉 "${data.team_name}" 팀에 합류했어요!`);
      setTimeout(() => router.push("/dashboard"), 2000);
    }
    setLoading(false);
  }

  if (status === "loading" || (status === "unauthenticated" && codeFromUrl)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 gap-6">
        <SpmLogo size="md" />
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-xs text-center flex flex-col gap-4">
          <p className="text-gray-400 text-sm">팀에 합류하려면 먼저 로그인해주세요</p>
          <button
            onClick={() => signIn("kakao", { callbackUrl: "/join" })}
            className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            <span>💬</span> 카카오 로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* 배경 효과 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.07)_0%,_transparent_65%)] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <SpmLogo size="md" />
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/40">
          <h1 className="text-lg font-bold text-white mb-1">팀 합류</h1>
          <p className="text-sm text-gray-500 mb-5">초대 코드를 입력해서 팀에 합류하세요</p>

          {success ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">🎉</div>
              <p className="text-emerald-400 font-bold text-base">{success}</p>
              <p className="text-sm text-gray-500 mt-1">잠시 후 홈으로 이동해요...</p>
            </div>
          ) : (
            <form onSubmit={handleJoin} className="flex flex-col gap-3">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="초대 코드 입력 (예: a1b2c3d4)"
                className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600 font-mono"
                autoFocus
              />
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-colors"
              >
                {loading ? "합류 중..." : "팀 합류하기"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="w-full text-sm text-gray-600 hover:text-gray-400 py-2 transition-colors"
              >
                취소
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-700 mt-4">
          로그인된 계정: {session?.user?.name}
        </p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
