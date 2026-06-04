"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SpmLogo from "@/components/SpmLogo";

type TeamRole = "owner" | "manager" | "coach" | "president" | "member";

interface TeamMember {
  role: TeamRole;
  joined_at: string;
  user_id: string;
  users: { id: string; name: string; email: string; image: string };
}

interface TeamInfo {
  id: string;
  name: string;
  invite_code: string;
  my_role: TeamRole;
  is_owner: boolean;
  can_manage: boolean;
  members: TeamMember[];
}

interface MyTeamItem {
  id: string;
  name: string;
  color: string;
  role: TeamRole;
  is_mine: boolean;
  is_active: boolean;
}

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "관리자",
  manager: "감독",
  coach: "코치",
  president: "회장",
  member: "팀원",
};

const ROLE_COLOR: Record<TeamRole, string> = {
  owner: "bg-green-100 text-green-700",
  manager: "bg-blue-100 text-blue-700",
  coach: "bg-purple-100 text-purple-700",
  president: "bg-yellow-100 text-yellow-700",
  member: "bg-gray-100 text-gray-500",
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [myTeams, setMyTeams] = useState<MyTeamItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") {
      fetchTeam();
      fetchMyTeams();
    }
  }, [status]);

  async function fetchTeam() {
    const res = await fetch("/api/team");
    if (res.ok) setTeam(await res.json());
  }

  async function fetchMyTeams() {
    const res = await fetch("/api/team/list");
    if (res.ok) setMyTeams(await res.json());
  }

  async function switchTeam(teamId: string) {
    if (switching) return;
    setSwitching(true);
    await fetch("/api/team/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId }),
    });
    await fetchTeam();
    await fetchMyTeams();
    setShowMembers(false);
    setShowInvite(false);
    setSwitching(false);
  }

  function copyInviteLink() {
    const link = `${window.location.origin}/join?code=${team?.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function changeRole(targetUserId: string, newRole: TeamRole) {
    const res = await fetch("/api/team/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_user_id: targetUserId, new_role: newRole }),
    });
    if (res.ok) fetchTeam();
    else alert((await res.json()).error);
  }

  async function kickMember(targetUserId: string, name: string) {
    if (!confirm(`"${name}"님을 팀에서 강퇴할까요?`)) return;
    const res = await fetch("/api/team/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_user_id: targetUserId }),
    });
    if (res.ok) fetchTeam();
    else alert((await res.json()).error);
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  const joinedTeam = myTeams.find(t => !t.is_mine);
  const myOwnTeam = myTeams.find(t => t.is_mine);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white px-4 py-4 flex items-center justify-between">
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
            <span className="hidden sm:inline">{session?.user?.name}님</span>
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm bg-green-600 hover:bg-green-500 px-3 py-1 rounded-lg transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">

        {/* 팀 전환 탭 */}
        {myTeams.length > 0 && (
          <div className="flex gap-2 mb-4">
            {myOwnTeam && (
              <button
                onClick={() => switchTeam(myOwnTeam.id)}
                disabled={switching}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                  myOwnTeam.is_active
                    ? "bg-green-600 text-white shadow"
                    : "bg-white text-gray-500 shadow hover:bg-gray-50"
                }`}
              >
                🏠 내 팀
                <span className="text-xs opacity-75 font-normal truncate max-w-[80px]">{myOwnTeam.name}</span>
              </button>
            )}
            {joinedTeam && (
              <button
                onClick={() => switchTeam(joinedTeam.id)}
                disabled={switching}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                  joinedTeam.is_active
                    ? "bg-blue-600 text-white shadow"
                    : "bg-white text-gray-500 shadow hover:bg-gray-50"
                }`}
              >
                🤝 가입한 팀
                <span className="text-xs opacity-75 font-normal truncate max-w-[80px]">{joinedTeam.name}</span>
              </button>
            )}
            {!joinedTeam && (
              <button
                onClick={() => router.push("/join")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white text-gray-400 shadow hover:bg-gray-50 border-2 border-dashed border-gray-200 transition-colors"
              >
                + 팀 가입
              </button>
            )}
          </div>
        )}

        {/* 현재 팀 카드 */}
        {team && (
          <div className="bg-white rounded-2xl shadow p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-800">{team.name}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLOR[team.my_role]}`}>
                      {ROLE_LABEL[team.my_role]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">팀원 {team.members.length}명</p>
                </div>
                {/* 아바타 */}
                <div className="flex -space-x-2">
                  {team.members.slice(0, 5).map((m, i) =>
                    m.users?.image ? (
                      <img key={i} src={m.users.image} alt={m.users.name} className="w-7 h-7 rounded-full border-2 border-white" />
                    ) : (
                      <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-green-200 flex items-center justify-center text-xs">👤</div>
                    )
                  )}
                  {team.members.length > 5 && (
                    <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                      +{team.members.length - 5}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowMembers(!showMembers); setShowInvite(false); }}
                  className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3 py-2 rounded-xl transition-colors"
                >
                  👥 팀원
                </button>
                {team.is_owner && (
                  <button
                    onClick={() => { setShowInvite(!showInvite); setShowMembers(false); }}
                    className="text-sm bg-green-50 hover:bg-green-100 text-green-700 font-semibold px-3 py-2 rounded-xl transition-colors"
                  >
                    🔗 초대
                  </button>
                )}
              </div>
            </div>

            {/* 팀원 목록 */}
            {showMembers && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 mb-3">팀원 목록</p>
                <div className="flex flex-col gap-2">
                  {team.members.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-3">
                      {m.users?.image ? (
                        <img src={m.users.image} alt="" className="w-8 h-8 rounded-full shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm shrink-0">👤</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{m.users?.name ?? "이름 없음"}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLOR[m.role]}`}>
                        {ROLE_LABEL[m.role]}
                      </span>
                      {team.is_owner && m.role !== "owner" && (
                        <div className="flex gap-1 shrink-0">
                          <select
                            value={m.role}
                            onChange={(e) => changeRole(m.user_id, e.target.value as TeamRole)}
                            className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-400"
                          >
                            <option value="manager">감독</option>
                            <option value="coach">코치</option>
                            <option value="president">회장</option>
                            <option value="member">팀원</option>
                          </select>
                          <button
                            onClick={() => kickMember(m.user_id, m.users?.name)}
                            className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                          >
                            강퇴
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 초대 패널 */}
            {showInvite && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">초대 링크를 공유하면 팀에 합류할 수 있어요</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-600 font-mono truncate">
                    {`${typeof window !== "undefined" ? window.location.origin : ""}/join?code=${team.invite_code}`}
                  </div>
                  <button
                    onClick={copyInviteLink}
                    className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                      copied ? "bg-green-500 text-white" : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    {copied ? "✓ 복사됨" : "복사"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  초대 코드: <span className="font-mono font-bold text-gray-600">{team.invite_code}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* 메뉴 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            className={`bg-white rounded-2xl shadow p-6 transition-shadow ${
              team?.can_manage
                ? "cursor-pointer hover:shadow-md"
                : "opacity-50 cursor-not-allowed"
            }`}
            onClick={() => team?.can_manage && router.push("/assign")}
          >
            <div className="text-3xl mb-3">🎯</div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">포지션 배정</h2>
            <p className="text-gray-500 text-sm">
              {team?.can_manage
                ? "팀원에게 포지션을 랜덤 배정하세요"
                : "관리자·감독·코치만 사용할 수 있어요"}
            </p>
          </div>

          <div
            className={`bg-white rounded-2xl shadow p-6 transition-shadow ${
              team?.can_manage
                ? "cursor-pointer hover:shadow-md"
                : "opacity-50 cursor-not-allowed"
            }`}
            onClick={() => team?.can_manage && router.push("/feedback")}
          >
            <div className="text-3xl mb-3">📝</div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">경기 피드백</h2>
            <p className="text-gray-500 text-sm">
              {team?.can_manage
                ? "경기별 팀·개인 피드백을 작성하세요"
                : "관리자·감독·코치만 사용할 수 있어요"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
