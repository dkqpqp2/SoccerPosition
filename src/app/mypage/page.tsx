"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell, User, Handshake, Target, Home, Zap, ClipboardList, Check,
  AlertTriangle, StickyNote, X, Vote, Calendar, Wallet, Mail, LogOut, Trash2,
  ImagePlus, Pencil,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import PositionSelect from "@/components/PositionSelect";
import { POSITION_MAP } from "@/lib/positions";

const REGIONS = ["서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const AGE_GROUPS = ["20대", "30대", "40대", "혼합"];
const SKILL_LEVELS = ["입문", "아마추어", "세미프로"];
const PLAYER_BACKGROUNDS = ["없음", "중학교", "고등학교", "대학교", "프로팀"];
const GAME_TYPES = ["풋살", "축구"];
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const PREFERRED_TIMES = ["오전", "오후", "저녁", "주말 오전", "주말 오후", "주말 저녁"];
const ACTIVITY_FREQS = ["주 1회", "주 2회", "월 2회 이하"];

interface MatchingProfile {
  description: string;
  region: string;
  age_group: string;
  skill_level: string;
  player_background: string;
  game_type: string[];
  preferred_days: string[];
  preferred_time: string[];
  activity_frequency: string;
  kakao_open_chat: string;
  is_public: boolean;
  futsal_match_count: number;
  soccer_wins: number;
  soccer_draws: number;
  soccer_losses: number;
}

interface Profile {
  name: string;
  email: string;
  image: string;
  team_name: string | null;
  team_color: string;
  team_logo_url: string | null;
  position_1st: string | null;
  position_2nd: string | null;
  birth_year: number | null;
  jersey_number: number | null;
  role: string | null;
  is_owner: boolean;
}

interface MyEvaluation {
  strengths: string;
  weaknesses: string;
  notes: string;
  ai_recommended_positions?: string[];
  updated_at: string | null;
}

const defaultMatchingProfile: MatchingProfile = {
  description: "", region: "", age_group: "", skill_level: "",
  player_background: "", game_type: [], preferred_days: [],
  preferred_time: [], activity_frequency: "", kakao_open_chat: "",
  is_public: false, futsal_match_count: 0, soccer_wins: 0, soccer_draws: 0, soccer_losses: 0,
};

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
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [matchingProfile, setMatchingProfile] = useState<MatchingProfile>(defaultMatchingProfile);
  const [matchingSaving, setMatchingSaving] = useState(false);
  const [matchingSaved, setMatchingSaved] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; title: string; body: string; link: string; is_read: boolean; created_at: string; type?: string }[]>([]);
  const [myTab, setMyTab] = useState<"info" | "matching">("info");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [myEval, setMyEval] = useState<MyEvaluation | null | "loading">("loading");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") { fetchProfile(); fetchMatchingProfile(); fetchNotifications(); fetchMyEval(); }
  }, [status]);

  async function fetchMyEval() {
    const res = await fetch("/api/user/evaluation");
    if (res.ok) {
      const data = await res.json();
      setMyEval(data); // null이면 평가 없음
    } else {
      setMyEval(null);
    }
  }

  async function fetchProfile() {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    setProfile(data);
    setTeamName(data.team_name || "");
    setPosition1st(data.position_1st || "");
    setPosition2nd(data.position_2nd || "");
    setBirthYear(data.birth_year ? String(data.birth_year) : "");
    setJerseyNumber(data.jersey_number != null ? String(data.jersey_number) : "");
    // 카카오 이름과 저장된 이름이 다르면 직접입력 모드
    if (data.custom_name && data.custom_name !== data.kakao_name) {
      setDisplayName(data.custom_name);
      setUseKakaoName(false);
    } else {
      setDisplayName(data.name || "");
      setUseKakaoName(true);
    }
  }

  async function fetchNotifications() {
    const res = await fetch("/api/notifications");
    if (res.ok) setNotifications(await res.json());
  }

  async function dismissNotification(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  async function markReadAndGo(notification: { id: string; link: string }) {
    await fetch(`/api/notifications/${notification.id}`, { method: "DELETE" });
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
    router.push(notification.link);
  }

  async function fetchMatchingProfile() {
    const res = await fetch("/api/matching/profile");
    if (res.ok) {
      const data = await res.json();
      if (data) setMatchingProfile({ ...defaultMatchingProfile, ...data });
    }
  }

  async function saveMatchingProfile() {
    setMatchingSaving(true);
    await fetch("/api/matching/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matchingProfile),
    });
    setMatchingSaving(false);
    setMatchingSaved(true);
    setTimeout(() => setMatchingSaved(false), 2000);
  }

  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
  }

  async function save() {
    setSaving(true);
    setSaveError("");
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(canManageTeam ? { team_name: teamName } : {}),
        position_1st: position1st || null,
        position_2nd: position2nd || null,
        display_name: useKakaoName ? null : (displayName.trim() || null),
        birth_year: birthYear ? parseInt(birthYear) : null,
        jersey_number: jerseyNumber ? parseInt(jerseyNumber) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error ?? "저장에 실패했어요.");
      return;
    }
    setSaved(true);
    setEditMode(false);
    setTimeout(() => setSaved(false), 2000);
    fetchProfile();
  }

  function cancelEdit() {
    setSaveError("");
    setEditMode(false);
    fetchProfile();
  }

  async function uploadLogo(file: File) {
    setLogoError("");
    setLogoUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/team/logo", { method: "POST", body: formData });
    const data = await res.json();
    setLogoUploading(false);
    if (!res.ok) { setLogoError(data.error ?? "업로드에 실패했어요."); return; }
    fetchProfile();
  }

  async function removeLogo() {
    setLogoError("");
    setLogoUploading(true);
    const res = await fetch("/api/team/logo", { method: "DELETE" });
    setLogoUploading(false);
    if (!res.ok) { const data = await res.json(); setLogoError(data.error ?? "삭제에 실패했어요."); return; }
    fetchProfile();
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isManager = profile?.is_owner === true;
  const canManageTeam = profile?.is_owner === true;

  return (
    <AppLayout title="마이페이지">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-4">

        {/* 🔔 알림 섹션 */}
        {notifications.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Bell size={15} strokeWidth={2} /> 알림
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </h2>
              <button
                onClick={async () => {
                  await fetch("/api/notifications", { method: "PATCH" });
                  setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                }}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                모두 읽음
              </button>
            </div>
            {(showAllNotifs ? notifications : notifications.slice(0, 2)).map(n => (
              <div key={n.id}
                className={`rounded-lg border p-4 flex gap-3 transition-colors ${n.is_read ? "bg-gray-900 border-white/5 opacity-60" : "bg-emerald-500/5 border-emerald-500/20"}`}
              >
                <span className={`shrink-0 mt-0.5 ${n.is_read ? "text-gray-500" : "text-emerald-400"}`}>
                  {n.type === "vote_created" ? <Vote size={18} strokeWidth={1.75} />
                    : n.type === "dues_request" ? <Wallet size={18} strokeWidth={1.75} />
                    : n.type === "match_created" ? <Calendar size={18} strokeWidth={1.75} />
                    : <Target size={18} strokeWidth={1.75} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold mb-0.5 ${n.is_read ? "text-gray-400" : "text-white"}`}>{n.title}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{n.body}</p>
                  {n.type !== "dues_request" && (
                    <button
                      onClick={() => markReadAndGo(n)}
                      className="mt-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                    >
                      {n.type === "vote_created" ? "투표 참여하기 →" : n.type === "match_created" ? "출석 체크하러 가기 →" : "포지션 확인하기 →"}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => dismissNotification(n.id)}
                  className="text-gray-600 hover:text-gray-400 shrink-0 self-start transition-colors"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
            ))}
            {notifications.length > 2 && (
              <button
                onClick={() => setShowAllNotifs(p => !p)}
                className="text-xs text-gray-500 hover:text-gray-300 font-semibold py-2 text-center transition-colors"
              >
                {showAllNotifs ? "접기 ▲" : `알림 ${notifications.length - 2}개 더보기 ▼`}
              </button>
            )}
          </div>
        )}

        {/* 탭 바 */}
        <div className="flex bg-gray-900 border border-white/5 rounded-lg p-1 gap-1">
          <button
            onClick={() => setMyTab("info")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${myTab === "info" ? "bg-emerald-500 text-black" : "text-gray-500 hover:text-white"}`}>
            <User size={15} strokeWidth={2} /> 내 정보
          </button>
          {isManager && (
            <button
              onClick={() => setMyTab("matching")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${myTab === "matching" ? "bg-emerald-500 text-black" : "text-gray-500 hover:text-white"}`}>
              <Handshake size={15} strokeWidth={2} /> 팀 프로필
            </button>
          )}
        </div>

        {/* ── 내 정보 탭 ── */}
        {myTab === "info" && <>

        {/* 프로필 카드 */}
        <div className="bg-gray-900 border border-white/5 rounded-lg p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {profile.image ? (
              <img src={profile.image.replace(/^http:\/\//, 'https://')} alt="프로필" className="w-14 h-14 rounded-full ring-2 ring-emerald-400/30" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <User size={24} className="text-emerald-400" strokeWidth={1.75} />
              </div>
            )}
            <div>
              <p className="font-bold text-white text-lg">{profile.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">{profile.email || "이메일 없음"}</p>
              <p className="text-xs text-emerald-400 mt-1 font-medium">카카오 계정 연동됨</p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-full whitespace-nowrap">
            {isManager ? "내가 만든 팀" : "가입한 팀"}
          </span>
        </div>

        {/* 2x2 그리드 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 내 기본 정보 */}
        <div className="bg-gray-900 border border-white/5 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white flex items-center gap-2"><User size={16} strokeWidth={1.75} className="text-gray-400" /> 내 기본 정보</h2>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors"
              >
                <Pencil size={12} /> 수정
              </button>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {/* 이름 */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block uppercase tracking-widest">이름</label>
              {!editMode ? (
                <div className="bg-gray-800/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white">
                  {profile.name || "미설정"}
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>

            {/* 출생연도 */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">출생연도</label>
              {!editMode ? (
                <div className="bg-gray-800/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white">
                  {birthYear ? `${birthYear}년생 · 만 ${new Date().getFullYear() - parseInt(birthYear)}세` : "미설정"}
                </div>
              ) : (
                <>
                  <input
                    type="number"
                    value={birthYear}
                    onChange={e => setBirthYear(e.target.value)}
                    placeholder="예: 1995"
                    min={1950}
                    max={new Date().getFullYear()}
                    inputMode="numeric"
                    className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {birthYear && (
                    <p className="text-xs text-gray-600 mt-1">
                      만 {new Date().getFullYear() - parseInt(birthYear)}세
                    </p>
                  )}
                </>
              )}
            </div>

            {/* 등번호 */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">등번호</label>
              {!editMode ? (
                <div className="bg-gray-800/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white">
                  {jerseyNumber ? `#${jerseyNumber}` : "미설정"}
                </div>
              ) : (
                <input
                  type="number"
                  value={jerseyNumber}
                  onChange={e => setJerseyNumber(e.target.value)}
                  placeholder="예: 7"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* 내 포지션 선호도 */}
        <div className="bg-gray-900 border border-white/5 rounded-lg p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-white flex items-center gap-2">
              <Target size={16} strokeWidth={1.75} className="text-gray-400" /> 내 포지션 선호도
            </h2>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors"
              >
                <Pencil size={12} /> 수정
              </button>
            )}
          </div>
          <p className="text-xs text-gray-600 mb-4">팀 가입 시 자동으로 팀원 명단에 추가돼요</p>
          <div className="flex flex-col gap-3">
            {editMode && (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">1순위 포지션</label>
                  <PositionSelect value={position1st} onChange={setPosition1st} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">2순위 포지션</label>
                  <PositionSelect value={position2nd} onChange={setPosition2nd} />
                </div>
              </>
            )}
            {(position1st || position2nd) ? (
              <div className="flex gap-2 flex-wrap mt-1">
                {position1st && (
                  <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
                    1순위 · {position1st}
                  </span>
                )}
                {position2nd && (
                  <span className="text-xs bg-sky-500/15 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-full font-medium">
                    2순위 · {position2nd}
                  </span>
                )}
              </div>
            ) : !editMode && (
              <div className="bg-gray-800/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-gray-400">미설정</div>
            )}
          </div>
        </div>

        {/* 팀 정보 */}
        <div className="bg-gray-900 border border-white/5 rounded-lg p-5">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2"><Home size={16} strokeWidth={1.75} className="text-gray-400" /> 내 팀</h2>

          {/* 팀 로고 */}
          <div className="mb-5">
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">팀 로고</label>
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden"
                style={{ backgroundColor: `${profile.team_color}1A`, borderColor: `${profile.team_color}40` }}
              >
                {profile.team_logo_url ? (
                  <img src={profile.team_logo_url} alt="팀 로고" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-black text-xl" style={{ color: profile.team_color }}>{(teamName || "우")[0]}</span>
                )}
              </div>
              {canManageTeam && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 cursor-pointer transition-colors">
                      <ImagePlus size={13} />
                      {logoUploading ? "업로드 중..." : "로고 업로드"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={logoUploading}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }}
                      />
                    </label>
                    {profile.team_logo_url && (
                      <button
                        onClick={removeLogo}
                        disabled={logoUploading}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} /> 삭제
                      </button>
                    )}
                  </div>
                  {logoError && <p className="text-[11px] text-red-400">{logoError}</p>}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">우리팀</label>
            {canManageTeam ? (
              <>
                <input
                  type="text"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  placeholder="예: FC키싱구라미"
                  className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600"
                />
                <p className="text-xs text-gray-600 mt-1">경기 추가 시 "팀이름 vs 상대팀" 형식으로 표시돼요</p>
              </>
            ) : (
              <>
                <div className="bg-gray-800/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-gray-400">
                  {teamName || "팀 이름 없음"}
                </div>
                <p className="text-xs text-gray-600 mt-1">팀 이름은 팀을 만든 팀장만 수정할 수 있어요</p>
              </>
            )}
          </div>
        </div>

        {/* 용병 등록 */}
        <div className="bg-gray-900 border border-white/5 rounded-lg p-5 opacity-60">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-white flex items-center gap-2"><Zap size={16} strokeWidth={1.75} className="text-gray-400" /> 용병 등록</h2>
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

        {/* 내 평가 섹션 */}
        {myEval !== "loading" && (
          <div className="bg-gray-900 border border-white/5 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-white flex items-center gap-2"><ClipboardList size={16} strokeWidth={1.75} className="text-gray-400" /> 나에 대한 평가</h2>
              {myEval?.updated_at && (
                <span className="text-[11px] text-gray-600">
                  {new Date(myEval.updated_at).toLocaleDateString("ko-KR")} 수정됨
                </span>
              )}
            </div>

            {myEval && (myEval.strengths || myEval.weaknesses || myEval.notes) ? (
              <div className="space-y-2.5">
                {myEval.strengths && (
                  <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3">
                    <p className="text-[11px] font-bold text-emerald-400 mb-1.5 flex items-center gap-1"><Check size={12} strokeWidth={2.5} /> 장점</p>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{myEval.strengths}</p>
                  </div>
                )}
                {myEval.weaknesses && (
                  <div className="bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-3">
                    <p className="text-[11px] font-bold text-red-400 mb-1.5 flex items-center gap-1"><AlertTriangle size={12} strokeWidth={2.5} /> 단점 / 개선점</p>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{myEval.weaknesses}</p>
                  </div>
                )}
                {myEval.notes && (
                  <div className="bg-white/3 border border-white/5 rounded-xl px-4 py-3">
                    <p className="text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1"><StickyNote size={12} strokeWidth={2.5} /> 메모</p>
                    <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">{myEval.notes}</p>
                  </div>
                )}
                {myEval.ai_recommended_positions && myEval.ai_recommended_positions.length > 0 && (
                  <div className="bg-sky-500/5 border border-sky-500/15 rounded-xl px-4 py-3">
                    <p className="text-[11px] font-bold text-sky-400 mb-1.5 flex items-center gap-1">AI 추천 포지션</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {myEval.ai_recommended_positions.map(pos => (
                        <span key={pos} className="text-xs bg-sky-500/15 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-full">
                          {pos} · {POSITION_MAP[pos]?.description ?? pos}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-5 space-y-2">
                <ClipboardList size={30} strokeWidth={1.5} className="opacity-30 mx-auto" />
                <p className="text-sm text-gray-500 font-medium">아직 평가된 게 없어요</p>
                <p className="text-xs text-gray-600 leading-relaxed">감독과 코치에게 평가해달라고 요청해보세요</p>
              </div>
            )}
          </div>
        )}

        {/* 저장 버튼 */}
        {saveError && <p className="text-xs text-red-400 text-center -mb-1">{saveError}</p>}
        <div className="flex gap-2">
          {editMode && (
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="py-3 px-5 rounded-xl font-bold transition-colors bg-white/5 hover:bg-white/10 text-gray-400"
            >
              취소
            </button>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-bold transition-colors bg-emerald-500 hover:bg-emerald-400 text-black"
          >
            {saved ? <span className="inline-flex items-center justify-center gap-1"><Check size={15} /> 저장됐어요!</span> : saving ? "저장 중..." : "저장"}
          </button>
        </div>

        </>}{/* end 내 정보 탭 */}

        {/* ── 팀 매칭 탭 (팀장/부팀장만) ── */}
        {myTab === "matching" && isManager && <div className="bg-gray-900 border border-white/5 rounded-lg p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white flex items-center gap-2"><Handshake size={16} strokeWidth={1.75} className="text-gray-400" /> 팀 매칭 프로필</h2>
              <p className="text-xs text-gray-500 mt-0.5">공개 설정 시 다른 팀과 매칭을 할 수 있어요</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${matchingProfile.is_public ? "text-emerald-400" : "text-gray-500"}`}>
                {matchingProfile.is_public ? "공개" : "비공개"}
              </span>
              <button
                onClick={() => setMatchingProfile(p => ({ ...p, is_public: !p.is_public }))}
                className={`w-10 h-5 rounded-full relative transition-colors ${matchingProfile.is_public ? "bg-emerald-500" : "bg-gray-700"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${matchingProfile.is_public ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          {/* 팀 소개글 */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">팀 소개글</label>
            <textarea
              value={matchingProfile.description}
              onChange={e => setMatchingProfile(p => ({ ...p, description: e.target.value }))}
              placeholder="우리 팀을 간단히 소개해주세요"
              rows={3}
              className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600 resize-none"
            />
          </div>

          {/* 활동 지역 */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">활동 지역</label>
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.map(r => (
                <button key={r} onClick={() => setMatchingProfile(p => ({ ...p, region: r }))}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${matchingProfile.region === r ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 연령대 */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">연령대</label>
            <div className="flex gap-2 flex-wrap">
              {AGE_GROUPS.map(a => (
                <button key={a} onClick={() => setMatchingProfile(p => ({ ...p, age_group: a }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${matchingProfile.age_group === a ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* 평균 실력 */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">평균 실력</label>
            <div className="flex gap-2">
              {SKILL_LEVELS.map(s => (
                <button key={s} onClick={() => setMatchingProfile(p => ({ ...p, skill_level: s }))}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-colors ${matchingProfile.skill_level === s ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 선수 출신 */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">선수 출신 (최고 경력)</label>
            <div className="flex gap-2 flex-wrap">
              {PLAYER_BACKGROUNDS.map(b => (
                <button key={b} onClick={() => setMatchingProfile(p => ({ ...p, player_background: b }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${matchingProfile.player_background === b ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"}`}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* 경기 방식 */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">경기 방식 (복수 선택)</label>
            <div className="flex gap-2">
              {GAME_TYPES.map(g => (
                <button key={g} onClick={() => setMatchingProfile(p => ({ ...p, game_type: toggleArrayItem(p.game_type, g) }))}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-colors ${matchingProfile.game_type.includes(g) ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 선호 요일 */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">선호 요일 (복수 선택)</label>
            <div className="flex gap-1.5">
              {DAYS.map(d => (
                <button key={d} onClick={() => setMatchingProfile(p => ({ ...p, preferred_days: toggleArrayItem(p.preferred_days, d) }))}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-colors ${matchingProfile.preferred_days.includes(d) ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* 선호 시간 */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">선호 시간대</label>
            <div className="flex flex-wrap gap-1.5">
              {PREFERRED_TIMES.map(t => (
                <button key={t} onClick={() => setMatchingProfile(p => ({ ...p, preferred_time: toggleArrayItem(p.preferred_time, t) }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${matchingProfile.preferred_time.includes(t) ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 활동 빈도 */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">활동 빈도</label>
            <div className="flex gap-2">
              {ACTIVITY_FREQS.map(f => (
                <button key={f} onClick={() => setMatchingProfile(p => ({ ...p, activity_frequency: f }))}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-colors ${matchingProfile.activity_frequency === f ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* 카카오 오픈채팅 */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">카카오 오픈채팅 링크</label>
            <input
              type="url"
              value={matchingProfile.kakao_open_chat}
              onChange={e => setMatchingProfile(p => ({ ...p, kakao_open_chat: e.target.value }))}
              placeholder="https://open.kakao.com/..."
              className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600"
            />
          </div>

          {/* 전적 (읽기 전용) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 border border-white/5 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1"><Zap size={11} strokeWidth={2} /> 풋살 매칭</p>
              <p className="text-xl font-black text-sky-400">{matchingProfile.futsal_match_count}회</p>
            </div>
            <div className="bg-gray-800/50 border border-white/5 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1"><Target size={11} strokeWidth={2} /> 축구 전적</p>
              <p className="text-sm font-black">
                <span className="text-emerald-400">{matchingProfile.soccer_wins}승</span>
                <span className="text-gray-500 mx-1">{matchingProfile.soccer_draws}무</span>
                <span className="text-red-400">{matchingProfile.soccer_losses}패</span>
              </p>
            </div>
          </div>

          {/* 저장 */}
          <button
            onClick={saveMatchingProfile}
            disabled={matchingSaving}
            className="w-full py-3 rounded-xl font-bold transition-colors bg-emerald-500 hover:bg-emerald-400 text-black"
          >
            {matchingSaved ? <span className="inline-flex items-center justify-center gap-1"><Check size={15} /> 저장됐어요!</span> : matchingSaving ? "저장 중..." : "매칭 프로필 저장"}
          </button>
        </div>}{/* end 팀 매칭 탭 */}

        {/* 로그아웃 */}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full bg-gray-900 border border-white/5 rounded-lg p-4 text-red-400 hover:text-red-300 hover:border-red-500/20 font-medium transition-colors"
        >
          로그아웃
        </button>

        {/* 문의 및 탈퇴 */}
        <div className="bg-gray-900 border border-white/5 rounded-lg p-5">
          <h2 className="font-bold text-white mb-3 text-sm">고객 지원</h2>
          <div className="flex flex-col gap-2">
            <a
              href="mailto:dkqpqp3@gmail.com"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Mail size={15} strokeWidth={1.75} />
              <span>문의하기: dkqpqp3@gmail.com</span>
            </a>
            {!profile?.is_owner && (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-amber-400 transition-colors mt-1"
              >
                <LogOut size={15} strokeWidth={1.75} />
                <span>팀 나가기</span>
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-400 transition-colors mt-1"
            >
              <Trash2 size={15} strokeWidth={1.75} />
              <span>회원 탈퇴</span>
            </button>
          </div>
        </div>
      </div>

      {/* 팀 나가기 확인 모달 */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto" onClick={() => setShowLeaveConfirm(false)}>
          <div className="flex min-h-full items-center justify-center px-4 py-6">
            <div className="bg-gray-900 border border-white/10 rounded-lg shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-5">
                <LogOut size={36} strokeWidth={1.5} className="text-amber-400 mx-auto" />
                <h3 className="font-black text-white text-lg mt-2">팀을 나갈까요?</h3>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  팀을 나가면 팀 데이터에 접근할 수 없어요.<br />
                  납부 기록은 보존되며 언제든 재가입할 수 있어요.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    setLeaving(true);
                    const res = await fetch("/api/team/leave", { method: "POST" });
                    setLeaving(false);
                    if (res.ok) {
                      setShowLeaveConfirm(false);
                      router.push("/dashboard");
                      router.refresh();
                    } else {
                      const data = await res.json().catch(() => ({}));
                      alert(data.error ?? "오류가 발생했어요.");
                    }
                  }}
                  disabled={leaving}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black py-3 rounded-xl font-bold transition-colors"
                >
                  {leaving ? "처리 중..." : "나가기"}
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-3 rounded-xl font-bold transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 회원 탈퇴 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto" onClick={() => setShowDeleteConfirm(false)}>
          <div className="flex min-h-full items-center justify-center px-4 py-6">
          <div className="bg-gray-900 border border-white/10 rounded-lg shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <AlertTriangle size={36} strokeWidth={1.5} className="text-red-400 mx-auto" />
              <h3 className="font-black text-white text-lg mt-2">정말 탈퇴할까요?</h3>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                탈퇴 시 계정 및 모든 개인 데이터가 삭제되며<br />복구할 수 없어요.
              </p>
            </div>
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">확인을 위해 <span className="text-red-400 font-bold">탈퇴</span> 를 입력하세요</p>
              <input
                type="text"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="탈퇴"
                className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                취소
              </button>
              <button
                disabled={deleteInput !== "탈퇴" || deleting}
                onClick={async () => {
                  setDeleting(true);
                  await fetch("/api/user/delete", { method: "DELETE" });
                  await signOut({ callbackUrl: "/" });
                }}
                className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-30 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                {deleting ? "처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
