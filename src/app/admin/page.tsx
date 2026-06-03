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
  totalMembers: number;
  totalMatches: number;
  users: User[];
  signupByDay: Record<string, number>;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm">
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
            className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 mb-3 outline-none focus:ring-2 focus:ring-green-500"
          />
          {error && <p className="text-red-400 text-sm mb-3 text-center">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors"
          >
            입장
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">데이터 불러오는 중...</p>
      </div>
    );
  }

  if (!stats) return null;

  const signupDays = Object.entries(stats.signupByDay).sort(([a], [b]) => a.localeCompare(b));
  const maxSignup = Math.max(...signupDays.map(([, v]) => v), 1);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 헤더 */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SpmLogo size="sm" />
          <span className="text-gray-400 text-sm">관리자 대시보드</span>
        </div>
        <button
          onClick={() => setAuthed(false)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 rounded-2xl p-6 text-center">
            <p className="text-3xl font-black text-green-400">{stats.totalUsers}</p>
            <p className="text-gray-400 text-sm mt-1">👥 총 가입자</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-6 text-center">
            <p className="text-3xl font-black text-blue-400">{stats.totalMembers}</p>
            <p className="text-gray-400 text-sm mt-1">⚽ 등록된 팀원</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-6 text-center">
            <p className="text-3xl font-black text-yellow-400">{stats.totalMatches}</p>
            <p className="text-gray-400 text-sm mt-1">📅 총 경기 수</p>
          </div>
        </div>

        {/* 날짜별 가입자 차트 */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-8">
          <h3 className="font-bold text-lg mb-4">📈 최근 30일 가입자</h3>
          {signupDays.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">최근 30일 가입자 없음</p>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {signupDays.map(([day, count]) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-green-400 font-bold">{count}</span>
                  <div
                    className="w-full bg-green-500 rounded-t-md transition-all"
                    style={{ height: `${(count / maxSignup) * 96}px` }}
                  />
                  <span className="text-[9px] text-gray-500 rotate-0">{day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 가입자 목록 */}
        <div className="bg-gray-800 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4">👤 가입자 목록 ({stats.totalUsers}명)</h3>
          <div className="space-y-3">
            {stats.users.map((user, i) => (
              <div key={user.id} className="flex items-center gap-3 bg-gray-700 rounded-xl px-4 py-3">
                <span className="text-gray-500 text-xs w-5">{i + 1}</span>
                {user.image ? (
                  <img src={user.image} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm">👤</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{user.name || "이름 없음"}</p>
                  <p className="text-gray-400 text-xs truncate">{user.email || "-"}</p>
                </div>
                <p className="text-gray-500 text-xs shrink-0">
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
