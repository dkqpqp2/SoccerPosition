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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 gap-4">
        <SpmLogo size="md" />
        <p className="text-gray-600">팀에 합류하려면 먼저 로그인해주세요</p>
        <button
          onClick={() => signIn("kakao", { callbackUrl: "/join" })}
          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-6 py-3 rounded-2xl"
        >
          카카오 로그인
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <SpmLogo size="md" />
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <h1 className="text-lg font-bold text-gray-800 mb-1">팀 합류</h1>
          <p className="text-sm text-gray-500 mb-5">초대 코드를 입력해서 팀에 합류하세요</p>

          {success ? (
            <div className="text-center py-4">
              <p className="text-green-600 font-bold text-base">{success}</p>
              <p className="text-sm text-gray-400 mt-1">잠시 후 대시보드로 이동해요...</p>
            </div>
          ) : (
            <form onSubmit={handleJoin} className="flex flex-col gap-3">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="초대 코드 입력 (예: a1b2c3d4)"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {loading ? "합류 중..." : "팀 합류하기"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
              >
                취소
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          로그인된 계정: {session?.user?.name}
        </p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>}>
      <JoinContent />
    </Suspense>
  );
}
