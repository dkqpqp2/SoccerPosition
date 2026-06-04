"use client";

import { useState, useEffect } from "react";
import SpmLogo from "@/components/SpmLogo";

const ADMIN_SECRET = "1234";

interface User {
  id: string;
  name: string;
  email: string;
  image: string;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  totalTeams: number;
  totalMembers: number;
  totalMatches: number;
  users: User[];
  signupByDay: Record<string, number>;
}

function StatCard({
  value,
  label,
  color,
}: {
  value: number | string;
  label: string;
  color: "emerald" | "blue" | "amber" | "purple";
}) {
  const colors = {
    emerald: "text-emerald-400",
    blue:    "text-blue-400",
    amber:   "text-amber-400",
    purple:  "text-purple-400",
  };
  return (
    <div className="bg-gray-800 rounded-2xl p-5 text-center">
      <p className={`text-3xl font-black ${colors[color]}`}>{value}</p>
      <p className="text-gray-400 text-sm mt-1">{label}</p>
    </div>
  );
}

export default function AdminPage() {
  const [password, setPassword]   = useState("");
  const [authed,   setAuthed]     = useState(false);
  const [stats,    setStats]      = useState<Stats | null>(null);
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState("");

  const handleLogin = () => {
    if (password === ADMIN_SECRET) {
      setAuthed(true);
    } else {
      setError("비밀번호가 틀렸습니다");
    }
  };

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    fetch(`/api/admin/stats?secret=${ADMIN_SECRET}`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false));
  }, [authed]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-8 w-full max-w-sm">
          <div className="flex justify-center mb-6">
            <SpmLogo size="md" />
          </div>
          <h2 className="text-white text-center text-lg font-bold mb-6">관리자 페이지</h2>
          <input
            type="password"
            placeholder="비밀번호 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 mb-3 outline-none focus:ring-2 focus:ring-emerald-500 border border-white/5"
          />
          {error && <p className="text-red-400 text-sm mb-3 text-center">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl transition-colors"
          >
            입장
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  const signupDays = Object.entries(stats.signupByDay).sort(([a], [b]) => a.localeCompare(b));
  const maxSignup  = Math.max(...signupDays.map(([, v]) => v), 1);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 헤더 */}
      <header className="bg-gray-900 border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SpmLogo size="sm" />
          <span className="text-gray-500 text-sm">관리자 대시보드</span>
        </div>
        <button
          onClick={() => setAuthed(false)}
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* 핵심 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard value={stats.totalUsers}   label="👥 총 가입자"      color="emerald" />
          <StatCard value={stats.totalTeams}   label="🏆 생성된 팀"      color="blue"    />
          <StatCard value={stats.totalMembers} label="⚽ 등록된 팀원"    color="amber"   />
          <StatCard value={stats.totalMatches} label="📅 총 경기 수"     color="purple"  />
        </div>

        {/* Vercel Analytics 안내 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-white">📊 방문자 · 체류시간 분석</h3>
              <p className="text-gray-500 text-sm mt-0.5">Vercel Analytics로 자동 수집 중이에요</p>
            </div>
            <a
              href="https://vercel.com/jeongho-s-projects/soccer-position-project/analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              대시보드 열기 →
            </a>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
              <p className="text-xl">👁️</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">페이지뷰</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Vercel에서 확인</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
              <p className="text-xl">🙋</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">방문자 수</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Vercel에서 확인</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
              <p className="text-xl">⏱️</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">평균 체류시간</p>
              <p className="text-[11px] text-gray-600 mt-0.5">Vercel에서 확인</p>
            </div>
          </div>
        </div>

        {/* 날짜별 가입자 차트 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4">📈 최근 30일 가입자</h3>
          {signupDays.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-6">최근 30일 가입자 없음</p>
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {signupDays.map(([day, count]) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[10px] text-emerald-400 font-bold">{count}</span>
                  <div
                    className="w-full bg-emerald-500 rounded-t-md transition-all"
                    style={{ height: `${(count / maxSignup) * 88}px`, minHeight: "4px" }}
                  />
                  <span className="text-[9px] text-gray-600">{day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 가입자 목록 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4">👤 가입자 목록 <span className="text-gray-500 text-sm font-normal">({stats.totalUsers}명)</span></h3>
          <div className="space-y-2">
            {stats.users.map((user, i) => (
              <div
                key={user.id}
                className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-xl px-4 py-3"
              >
                <span className="text-gray-600 text-xs w-5 shrink-0 text-right">{i + 1}</span>
                {user.image ? (
                  <img src={user.image} alt="" className="w-8 h-8 rounded-full shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm shrink-0">👤</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white">{user.name || "이름 없음"}</p>
                  <p className="text-gray-500 text-xs truncate">{user.email || "-"}</p>
                </div>
                <p className="text-gray-600 text-xs shrink-0">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString("ko-KR") : "-"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
