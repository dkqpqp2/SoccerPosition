"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import PositionSelect from "@/components/PositionSelect";

interface Profile {
  name: string;
  email: string;
  image: string;
  team_name: string | null;
  team_color: string;
  position_1st: string | null;
  position_2nd: string | null;
  birth_year: number | null;
}

export default function MyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teamName, setTeamName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [useKakaoName, setUseKakaoName] = useState(true);
  const [birthYear, setBirthYear] = useState("");
  const [position1st, setPosition1st] = useState("");
  const [position2nd, setPosition2nd] = useState("");
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
    setPosition1st(data.position_1st || "");
    setPosition2nd(data.position_2nd || "");
    setBirthYear(data.birth_year ? String(data.birth_year) : "");
    // 카카오 이름과 저장된 이름이 다르면 직접입력 모드
    if (data.custom_name && data.custom_name !== data.kakao_name) {
      setDisplayName(data.custom_name);
      setUseKakaoName(false);
    } else {
      setDisplayName(data.name || "");
      setUseKakaoName(true);
    }
  }

  async function save() {
    setSaving(true);
    await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_name: teamName,
        position_1st: position1st || null,
        position_2nd: position2nd || null,
        display_name: useKakaoName ? null : (displayName.trim() || null),
        birth_year: birthYear ? parseInt(birthYear) : null,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchProfile();
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppLayout title="마이페이지">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-4">

        {/* 프로필 카드 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
          {profile.image ? (
            <img src={profile.image} alt="프로필" className="w-14 h-14 rounded-full ring-2 ring-emerald-400/30" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">👤</div>
          )}
          <div>
            <p className="font-bold text-white text-lg">{profile.name}</p>
            <p className="text-sm text-gray-500 mt-0.5">{profile.email || "이메일 없음"}</p>
            <p className="text-xs text-emerald-400 mt-1 font-medium">카카오 계정 연동됨</p>
          </div>
        </div>

        {/* 2x2 그리드 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 내 기본 정보 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">👤 내 기본 정보</h2>
          <div className="flex flex-col gap-4">
            {/* 이름 */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block uppercase tracking-widest">이름</label>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setUseKakaoName(true)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${useKakaoName ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"}`}
                >
                  카카오 닉네임
                </button>
                <button
                  onClick={() => setUseKakaoName(false)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${!useKakaoName ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"}`}
                >
                  직접 입력
                </button>
              </div>
              {useKakaoName ? (
                <div className="bg-gray-800/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-gray-400">
                  {profile.name || "카카오 닉네임 없음"}
                </div>
              ) : (
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="실명 또는 닉네임 입력"
                  className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600"
                />
              )}
            </div>

            {/* 출생연도 */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">출생연도</label>
              <input
                type="number"
                value={birthYear}
                onChange={e => setBirthYear(e.target.value)}
                placeholder="예: 1995"
                min={1950}
                max={new Date().getFullYear()}
                className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600"
              />
              {birthYear && (
                <p className="text-xs text-gray-600 mt-1">
                  만 {new Date().getFullYear() - parseInt(birthYear)}세
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 내 포지션 선호도 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <h2 className="font-bold text-white mb-1 flex items-center gap-2">
            🎯 내 포지션 선호도
          </h2>
          <p className="text-xs text-gray-600 mb-4">팀 가입 시 자동으로 팀원 명단에 추가돼요</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">1순위 포지션</label>
              <PositionSelect value={position1st} onChange={setPosition1st} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">2순위 포지션</label>
              <PositionSelect value={position2nd} onChange={setPosition2nd} />
            </div>
            {(position1st || position2nd) && (
              <div className="flex gap-2 flex-wrap mt-1">
                {position1st && (
                  <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
                    1순위 · {position1st}
                  </span>
                )}
                {position2nd && (
                  <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full font-medium">
                    2순위 · {position2nd}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 팀 정보 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">⚽ 우리 팀 정보</h2>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">팀 이름</label>
            <input
              type="text"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="예: FC키싱구라미"
              className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600"
            />
            <p className="text-xs text-gray-600 mt-1">경기 추가 시 "팀이름 vs 상대팀" 형식으로 표시돼요</p>
          </div>
        </div>

        {/* 용병 등록 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5 opacity-60">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-white flex items-center gap-2">⚡ 용병 등록</h2>
            <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium">추후 개발</span>
          </div>
          <p className="text-xs text-gray-600 mb-4">용병으로 다른 팀 경기에 참여할 수 있는 기능이에요</p>
          <div className="flex flex-col gap-2">
            <div className="bg-gray-800/50 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">용병 활동 가능 여부</span>
              <div className="w-10 h-5 bg-gray-700 rounded-full" />
            </div>
            <div className="bg-gray-800/50 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">활동 지역 설정</span>
              <span className="text-xs text-gray-600">미지원</span>
            </div>
          </div>
        </div>

        </div>{/* end grid */}

        {/* 저장 버튼 */}
        <button
          onClick={save}
          disabled={saving}
          className={`w-full py-3 rounded-xl font-bold transition-colors ${saved ? "bg-blue-500 text-white" : "bg-emerald-500 hover:bg-emerald-400 text-black"}`}
        >
          {saved ? "✓ 저장됐어요!" : saving ? "저장 중..." : "저장"}
        </button>

        {/* 로그아웃 */}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full bg-gray-900 border border-white/5 rounded-2xl p-4 text-red-400 hover:text-red-300 hover:border-red-500/20 font-medium transition-colors"
        >
          로그아웃
        </button>
      </div>
    </AppLayout>
  );
}
