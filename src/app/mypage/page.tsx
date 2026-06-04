"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SpmLogo from "@/components/SpmLogo";

interface Profile {
  name: string;
  email: string;
  image: string;
  team_name: string | null;
  team_color: string;
}

export default function MyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teamName, setTeamName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") fetchProfile();
  }, [status]);

  async function fetchProfile() {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    setProfile(data);
    setTeamName(data.team_name || "");
  }

  async function save() {
    setSaving(true);
    await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_name: teamName }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchProfile();
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="hover:text-green-200 text-sm shrink-0">← 뒤로</button>
          <div className="flex items-center gap-2">
            <span className="text-xl">👤</span>
            <h1 className="text-lg font-bold">마이페이지</h1>
          </div>
        </div>
        <SpmLogo size="sm" showText={false} clickable />
      </header>

      <main className="max-w-lg mx-auto px-6 py-8 flex flex-col gap-5">

        {/* 프로필 카드 */}
        <div className="bg-white rounded-2xl shadow p-6 flex items-center gap-4">
          {profile.image ? (
            <img src={profile.image} alt="프로필" className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-2xl">👤</div>
          )}
          <div>
            <p className="font-bold text-gray-800 text-lg">{profile.name}</p>
            <p className="text-sm text-gray-400">{profile.email || "이메일 없음"}</p>
            <p className="text-xs text-green-600 mt-1">카카오 계정 연동됨</p>
          </div>
        </div>

        {/* 팀 정보 */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-bold text-gray-800 mb-4">⚽ 우리 팀 정보</h2>
          <div className="flex flex-col gap-4">

            <div>
              <label className="text-sm text-gray-500 mb-1 block">팀 이름</label>
              <input
                type="text"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="예: FC키싱구라미"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">경기 추가 시 "팀이름 vs 상대팀" 형식으로 표시돼요</p>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">팀 색상</label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-gray-200" style={{ backgroundColor: profile.team_color }} />
                <span className="text-sm text-gray-500">포지션 배정 화면에서 변경 가능해요</span>
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className={`w-full py-2.5 rounded-xl font-semibold transition-colors ${saved ? "bg-blue-500 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}
            >
              {saved ? "✓ 저장됐어요!" : saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>

        {/* 로그아웃 */}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full bg-white rounded-2xl shadow p-4 text-red-400 hover:text-red-600 font-medium transition-colors hover:shadow-md"
        >
          로그아웃
        </button>
      </main>
    </div>
  );
}
