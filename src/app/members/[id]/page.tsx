"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { POSITION_MAP } from "@/lib/positions";

interface MemberDetail {
  id: string;
  name: string;
  position_1st: string | null;
  position_2nd: string | null;
  is_mercenary: boolean;
}

interface Evaluation {
  strengths:  string;
  weaknesses: string;
  notes:      string;
  updated_at: string | null;
}

interface PlayerStat {
  id: string;
  goals: number;
  assists: number;
  games_played: number;
  total_matches: number;
  attendance_rate: number;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function MemberDetailPage() {
  const { status } = useSession();
  const router     = useRouter();
  const { id }     = useParams<{ id: string }>();

  const [member,    setMember]    = useState<MemberDetail | null>(null);
  const [eval_,     setEval]      = useState<Evaluation>({ strengths: "", weaknesses: "", notes: "", updated_at: null });
  const [stat,      setStat]      = useState<PlayerStat | null>(null);
  const [userRole,  setUserRole]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [savedToast,setSavedToast]= useState(false);
  const [year,      setYear]      = useState(CURRENT_YEAR);

  const canEdit = ["owner", "manager", "president", "coach"].includes(userRole ?? "");

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/"); return; }
    if (status === "authenticated") init();
  }, [status]);

  useEffect(() => {
    if (member) fetchStat(year);
  }, [year, member]);

  async function init() {
    const [profileRes, membersRes, evalRes] = await Promise.all([
      fetch("/api/user/profile"),
      fetch("/api/members"),
      fetch(`/api/members/${id}/evaluation`),
    ]);
    const profile = await profileRes.json();
    const members: MemberDetail[] = await membersRes.json();
    const evalData: Evaluation    = await evalRes.json();

    setUserRole(profile.role ?? null);
    const found = members.find(m => m.id === id) ?? null;
    setMember(found);
    setEval(evalData);

    if (found) await fetchStat(year);
    setLoading(false);
  }

  async function fetchStat(y: number) {
    const res  = await fetch(`/api/stats?year=${y}`);
    const data = await res.json();
    const mine = Array.isArray(data) ? data.find((p: PlayerStat) => p.id === id) : null;
    setStat(mine ?? null);
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/members/${id}/evaluation`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(eval_),
    });
    setSaving(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  }

  if (loading) return (
    <AppLayout title="팀원 상세">
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  if (!member) return (
    <AppLayout title="팀원 상세">
      <div className="text-center py-32 text-gray-600">팀원을 찾을 수 없어요</div>
    </AppLayout>
  );

  const rate      = stat?.attendance_rate ?? 0;
  const barColor  = rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-400" : "bg-red-500";

  return (
    <AppLayout title={member.name}>
      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">

        {/* 뒤로 */}
        <button onClick={() => router.push("/members")}
          className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-1">
          ← 팀원 목록
        </button>

        {/* 프로필 카드 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl font-black text-white">{member.name}</h1>
              <p className="text-xs text-gray-500 mt-0.5">정규 팀원</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl">
              ⚽
            </div>
          </div>

          {/* 포지션 */}
          <div className="flex gap-2 flex-wrap">
            {member.position_1st ? (
              <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                1️⃣ {member.position_1st} · {POSITION_MAP[member.position_1st]?.description ?? member.position_1st}
              </span>
            ) : (
              <span className="text-xs text-gray-700">1순위 포지션 미설정</span>
            )}
            {member.position_2nd && (
              <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full">
                2️⃣ {member.position_2nd} · {POSITION_MAP[member.position_2nd]?.description ?? member.position_2nd}
              </span>
            )}
          </div>
        </div>

        {/* 시즌 통계 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">📊 시즌 통계</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setYear(y => y - 1)}
                className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm transition-colors">‹</button>
              <span className="text-sm font-bold text-white px-2">{year}년</span>
              <button onClick={() => setYear(y => y + 1)}
                className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm transition-colors">›</button>
            </div>
          </div>

          {stat ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-emerald-400">{stat.goals}</p>
                  <p className="text-xs text-gray-500 mt-0.5">🥅 골</p>
                </div>
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-blue-400">{stat.assists}</p>
                  <p className="text-xs text-gray-500 mt-0.5">🎯 어시스트</p>
                </div>
              </div>

              {/* 참석률 */}
              <div className="bg-white/3 border border-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 font-semibold">🏃 참석률</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">{stat.games_played}/{stat.total_matches}경기</span>
                    <span className={`text-sm font-black ${
                      rate >= 80 ? "text-emerald-400" : rate >= 50 ? "text-amber-400" : "text-red-400"
                    }`}>{stat.total_matches > 0 ? `${rate}%` : "–"}</span>
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${rate}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-600 text-sm">{year}년 통계 없음</p>
            </div>
          )}
        </div>

        {/* 장단점 평가 */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">📝 장단점 평가</h2>
            {eval_.updated_at && (
              <span className="text-[11px] text-gray-600">
                {new Date(eval_.updated_at).toLocaleDateString("ko-KR")} 수정됨
              </span>
            )}
          </div>

          <div className="space-y-3">
            {/* 장점 */}
            <div>
              <label className="text-xs font-semibold text-emerald-400 mb-1.5 flex items-center gap-1">
                ✅ 장점
              </label>
              {canEdit ? (
                <textarea
                  value={eval_.strengths}
                  onChange={e => setEval(v => ({ ...v, strengths: e.target.value }))}
                  placeholder="이 선수의 강점을 적어주세요"
                  rows={3}
                  className="w-full bg-gray-800 border border-emerald-500/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600 resize-none"
                />
              ) : (
                <div className="bg-white/3 border border-white/5 rounded-xl px-3 py-2.5 min-h-[72px]">
                  {eval_.strengths
                    ? <p className="text-sm text-gray-300 whitespace-pre-wrap">{eval_.strengths}</p>
                    : <p className="text-sm text-gray-700">아직 작성된 내용이 없어요</p>}
                </div>
              )}
            </div>

            {/* 단점 */}
            <div>
              <label className="text-xs font-semibold text-red-400 mb-1.5 flex items-center gap-1">
                ⚠️ 단점 / 개선점
              </label>
              {canEdit ? (
                <textarea
                  value={eval_.weaknesses}
                  onChange={e => setEval(v => ({ ...v, weaknesses: e.target.value }))}
                  placeholder="개선이 필요한 부분을 적어주세요"
                  rows={3}
                  className="w-full bg-gray-800 border border-red-500/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600 resize-none"
                />
              ) : (
                <div className="bg-white/3 border border-white/5 rounded-xl px-3 py-2.5 min-h-[72px]">
                  {eval_.weaknesses
                    ? <p className="text-sm text-gray-300 whitespace-pre-wrap">{eval_.weaknesses}</p>
                    : <p className="text-sm text-gray-700">아직 작성된 내용이 없어요</p>}
                </div>
              )}
            </div>

            {/* 메모 */}
            <div>
              <label className="text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1">
                🗒️ 메모
              </label>
              {canEdit ? (
                <textarea
                  value={eval_.notes}
                  onChange={e => setEval(v => ({ ...v, notes: e.target.value }))}
                  placeholder="기타 메모 사항"
                  rows={2}
                  className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 placeholder-gray-600 resize-none"
                />
              ) : (
                <div className="bg-white/3 border border-white/5 rounded-xl px-3 py-2.5 min-h-[52px]">
                  {eval_.notes
                    ? <p className="text-sm text-gray-300 whitespace-pre-wrap">{eval_.notes}</p>
                    : <p className="text-sm text-gray-700">메모 없음</p>}
                </div>
              )}
            </div>

            {canEdit && (
              <button onClick={save} disabled={saving}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-colors">
                {saving ? "저장 중..." : "💾 저장"}
              </button>
            )}

            {!canEdit && (
              <p className="text-center text-xs text-gray-700">감독 · 코치 · 회장 · 관리자만 수정할 수 있어요</p>
            )}
          </div>
        </div>

      </div>

      {savedToast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-white/10 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg whitespace-nowrap">
          ✅ 저장됐어요!
        </div>
      )}
    </AppLayout>
  );
}
