"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import KakaoPlaceSearch, { SelectedPlace } from "@/components/KakaoPlaceSearch";
import TimeSelect from "@/components/TimeSelect";

interface TeamProfile {
  id: string;
  team_id: string;
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
  futsal_match_count: number;
  soccer_wins: number;
  soccer_draws: number;
  soccer_losses: number;
  teams: { id: string; name: string; color: string };
}

interface MatchRequest {
  id: string;
  from_team_id: string;
  to_team_id: string;
  status: string;
  game_type: string;
  proposed_date: string;
  proposed_time?: string;
  proposed_end_time?: string;
  proposed_location: string;
  message: string;
  cancel_reason?: string;
  created_at: string;
  from_team: { id: string; name: string; color: string };
  to_team: { id: string; name: string; color: string };
}

interface MatchListing {
  id: string;
  team_id: string;
  game_type: string;
  preferred_date: string | null;
  preferred_time: string | null;
  preferred_end_time: string | null;
  location: string | null;
  place_lat: number | null;
  place_lng: number | null;
  message: string | null;
  status: string; // open | closed
  created_at: string;
  teams: { id: string; name: string; color: string };
}

const SKILL_COLOR: Record<string, string> = {
  "입문": "text-green-400 bg-green-500/10 border-green-500/20",
  "아마추어": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "세미프로": "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

const BG_COLOR: Record<string, string> = {
  "없음": "text-gray-500",
  "중학교": "text-emerald-400",
  "고등학교": "text-blue-400",
  "대학교": "text-purple-400",
  "프로팀": "text-amber-400",
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending:  { label: "대기 중",  cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  accepted: { label: "수락됨",   cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  rejected: { label: "거절됨",   cls: "text-red-400 bg-red-500/10 border-red-500/20" },
  cancelled:{ label: "취소됨",   cls: "text-gray-500 bg-gray-500/10 border-gray-500/20" },
};

export default function MatchingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"board" | "listings" | "requests">("board");

  // 상대팀 찾기
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TeamProfile | null>(null);
  const [applying, setApplying] = useState(false);
  const [form, setForm] = useState({ game_type: "축구", proposed_date: "", proposed_time: "", proposed_end_time: "", message: "" });
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [teamSearch, setTeamSearch] = useState("");
  const [teamPage, setTeamPage] = useState(5);

  // 매칭 신청
  const [requests, setRequests] = useState<MatchRequest[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [myTeamName, setMyTeamName] = useState<string | null>(null);
  const [myTeamLoaded, setMyTeamLoaded] = useState(false);
  const [showTeamNameWarning, setShowTeamNameWarning] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<MatchRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [receivedPage, setReceivedPage] = useState(5);
  const [sentPage, setSentPage] = useState(5);
  const [cancelledPage, setCancelledPage] = useState(5);
  const [showCancelled, setShowCancelled] = useState(false);

  // 매칭 등록
  const [listings, setListings] = useState<MatchListing[]>([]);
  const [showListingForm, setShowListingForm] = useState(false);
  const [listingForm, setListingForm] = useState({ game_type: "풋살", preferred_date: "", preferred_time: "", preferred_end_time: "", message: "" });
  const [listingPlace, setListingPlace] = useState<SelectedPlace | null>(null);
  const [creatingListing, setCreatingListing] = useState(false);
  const [applyListing, setApplyListing] = useState<MatchListing | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [applyingListing, setApplyingListing] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") {
      fetchTeams();
      fetchRequests();
      fetchMyTeamId();
      fetchListings();
    }
  }, [status]);

  async function fetchMyTeamId() {
    try {
      const res = await fetch("/api/matching/myteam");
      if (res.ok) {
        const data = await res.json();
        if (data?.team_id) setMyTeamId(data.team_id);
        setMyTeamName(data?.team_name ?? null);
      }
    } finally {
      setMyTeamLoaded(true);
    }
  }

  async function fetchTeams() {
    setLoading(true);
    const res = await fetch("/api/matching/teams");
    if (res.ok) setTeams(await res.json());
    setLoading(false);
  }

  async function fetchRequests() {
    const res = await fetch("/api/matching/requests");
    if (res.ok) setRequests(await res.json());
  }

  async function fetchListings() {
    const res = await fetch("/api/matching/listings");
    if (res.ok) setListings(await res.json());
  }

  // 상대팀 찾기 → 매칭 신청
  async function sendRequest() {
    if (!selected) return;
    setApplying(true);
    const res = await fetch("/api/matching/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_team_id: selected.team_id,
        game_type: form.game_type,
        proposed_date: form.proposed_date,
        proposed_time: form.proposed_time || null,
        proposed_end_time: form.proposed_end_time || null,
        proposed_location: selectedPlace?.name ?? null,
        place_lat: selectedPlace?.lat ?? null,
        place_lng: selectedPlace?.lng ?? null,
        message: form.message,
      }),
    });
    setApplying(false);
    if (res.ok) {
      setSelected(null);
      setSelectedPlace(null);
      setForm({ game_type: "축구", proposed_date: "", proposed_time: "", proposed_end_time: "", message: "" });
      fetchRequests();
      setTab("requests");
    } else {
      const err = await res.json();
      alert(err.error || "신청 실패");
    }
  }

  // 매칭 등록 → 신청
  async function sendListingRequest() {
    if (!applyListing) return;
    setApplyingListing(true);
    const res = await fetch("/api/matching/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_team_id: applyListing.team_id,
        game_type: applyListing.game_type,
        proposed_date: applyListing.preferred_date ?? null,
        proposed_time: applyListing.preferred_time ?? null,
        proposed_end_time: applyListing.preferred_end_time ?? null,
        proposed_location: applyListing.location ?? null,
        place_lat: applyListing.place_lat ?? null,
        place_lng: applyListing.place_lng ?? null,
        message: applyMessage,
        listing_id: applyListing.id,
      }),
    });
    setApplyingListing(false);
    if (res.ok) {
      setApplyListing(null);
      setApplyMessage("");
      fetchRequests();
      setTab("requests");
    } else {
      const err = await res.json();
      alert(err.error || "신청 실패");
    }
  }

  async function updateRequest(id: string, status: string, reason?: string) {
    await fetch(`/api/matching/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, cancel_reason: reason ?? null }),
    });
    fetchRequests();
  }

  async function submitCancel() {
    if (!cancelTarget) return;
    await updateRequest(cancelTarget.id, "cancelled", cancelReason);
    setCancelTarget(null);
    setCancelReason("");
  }

  // 매칭 등록 생성
  async function createListing() {
    setCreatingListing(true);
    const res = await fetch("/api/matching/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_type: listingForm.game_type,
        preferred_date: listingForm.preferred_date || null,
        preferred_time: listingForm.preferred_time || null,
        preferred_end_time: listingForm.preferred_end_time || null,
        location: listingPlace?.name ?? null,
        place_lat: listingPlace?.lat ?? null,
        place_lng: listingPlace?.lng ?? null,
        message: listingForm.message || null,
      }),
    });
    setCreatingListing(false);
    if (res.ok) {
      setShowListingForm(false);
      setListingForm({ game_type: "풋살", preferred_date: "", preferred_time: "", preferred_end_time: "", message: "" });
      setListingPlace(null);
      fetchListings();
    }
  }

  async function closeListing(id: string) {
    await fetch(`/api/matching/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    fetchListings();
  }

  async function reopenListing(id: string) {
    await fetch(`/api/matching/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open" }),
    });
    fetchListings();
  }

  async function deleteListing(id: string) {
    if (!confirm("매칭 등록을 삭제할까요?")) return;
    await fetch(`/api/matching/listings/${id}`, { method: "DELETE" });
    fetchListings();
  }

  // 파생 상태
  const sentRequests      = requests.filter(r => r.from_team_id === myTeamId && r.status !== "cancelled");
  const receivedRequests  = requests.filter(r => r.to_team_id === myTeamId   && r.status !== "cancelled");
  const cancelledRequests = requests.filter(r =>
    (r.from_team_id === myTeamId || r.to_team_id === myTeamId) && r.status === "cancelled"
  );
  const PAGE = 5;
  const pendingReceived = requests.filter(r => r.to_team_id === myTeamId && r.status === "pending").length;
  const filteredTeams   = teams.filter(t =>
    t.teams.name !== "우리팀" &&
    (teamSearch.trim() === "" || t.teams.name.toLowerCase().includes(teamSearch.toLowerCase()))
  );
  const myListings   = listings.filter(l => l.team_id === myTeamId);
  const openListings = listings.filter(l => l.team_id !== myTeamId && l.status === "open");

  // 팀 이름 미설정 시 접근 차단
  if (myTeamLoaded && myTeamName === "우리팀") {
    return (
      <AppLayout title="팀 매칭">
        <div className="max-w-3xl mx-auto px-4 py-16 flex flex-col items-center justify-center gap-6 text-center">
          <p className="text-6xl">⚠️</p>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">팀 이름을 먼저 설정해주세요</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              현재 팀 이름이 <span className="text-amber-400 font-bold">"우리팀"</span>으로 설정되어 있어요.<br />
              팀 매칭 기능은 팀 이름을 변경한 후 사용할 수 있어요.
            </p>
          </div>
          <button
            onClick={() => router.push("/mypage")}
            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-sm transition-colors"
          >
            팀 이름 설정하러 가기 →
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="팀 매칭">
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-4">

        {/* ── 탭 ── */}
        <div className="flex bg-gray-900 border border-white/5 rounded-2xl p-1 gap-1">
          <button onClick={() => setTab("board")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${tab === "board" ? "bg-emerald-500 text-black" : "text-gray-500 hover:text-white"}`}>
            🔍 상대팀 찾기
          </button>
          <button onClick={() => setTab("listings")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${tab === "listings" ? "bg-emerald-500 text-black" : "text-gray-500 hover:text-white"}`}>
            📋 매칭 등록
          </button>
          <button onClick={() => setTab("requests")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors relative ${tab === "requests" ? "bg-emerald-500 text-black" : "text-gray-500 hover:text-white"}`}>
            📬 매칭 신청
            {pendingReceived > 0 && (
              <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-black flex items-center justify-center ${tab === "requests" ? "bg-black text-emerald-400" : "bg-red-500 text-white"}`}>
                {pendingReceived}
              </span>
            )}
          </button>
        </div>

        {/* ── 상대팀 찾기 탭 ── */}
        {tab === "board" && (
          <>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
              <input
                type="text"
                value={teamSearch}
                onChange={e => { setTeamSearch(e.target.value); setTeamPage(5); }}
                placeholder="팀 이름으로 검색"
                className="w-full bg-gray-900 border border-white/10 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="bg-gray-900 border border-white/5 rounded-2xl p-10 text-center">
                <p className="text-4xl mb-3">⚽</p>
                <p className="text-gray-400 font-bold">{teamSearch ? "검색 결과가 없어요" : "공개된 팀이 없어요"}</p>
                <p className="text-gray-600 text-sm mt-1">{teamSearch ? "다른 팀 이름으로 검색해보세요" : "마이페이지에서 매칭 프로필을 설정하고 팀을 공개해보세요"}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-600 px-1">총 {filteredTeams.length}개 팀</p>
                {filteredTeams.slice(0, teamPage).map(team => (
                  <div key={team.id} className="bg-gray-900 border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm"
                          style={{ backgroundColor: team.teams.color }}>
                          {team.teams.name.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-white">{team.teams.name}</p>
                          <p className="text-xs text-gray-500">{team.region} · {team.age_group} · {team.activity_frequency}</p>
                        </div>
                      </div>
                      {team.skill_level && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${SKILL_COLOR[team.skill_level] ?? "text-gray-400"}`}>
                          {team.skill_level}
                        </span>
                      )}
                    </div>
                    {team.description && (
                      <p className="text-sm text-gray-400 leading-relaxed">{team.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {team.game_type?.map(g => (
                        <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">{g}</span>
                      ))}
                      {team.preferred_days?.map(d => (
                        <span key={d} className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">{d}요일</span>
                      ))}
                      {team.preferred_time?.map(t => (
                        <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">{t}</span>
                      ))}
                      {team.player_background && team.player_background !== "없음" && (
                        <span className={`text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 font-medium ${BG_COLOR[team.player_background]}`}>
                          {team.player_background} 출신 ✦
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {team.game_type?.includes("풋살") && (
                        <div className="flex-1 bg-gray-800/50 border border-white/5 rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-gray-500">풋살 매칭</p>
                          <p className="text-base font-black text-blue-400">{team.futsal_match_count}회</p>
                        </div>
                      )}
                      {team.game_type?.includes("축구") && (
                        <div className="flex-1 bg-gray-800/50 border border-white/5 rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-gray-500">축구 전적</p>
                          <p className="text-sm font-black">
                            <span className="text-emerald-400">{team.soccer_wins}승</span>
                            <span className="text-gray-500 mx-0.5">{team.soccer_draws}무</span>
                            <span className="text-red-400">{team.soccer_losses}패</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <button onClick={() => myTeamName === "우리팀" ? setShowTeamNameWarning(true) : setSelected(team)}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-sm transition-colors">
                      매칭 신청하기
                    </button>
                  </div>
                ))}
                {filteredTeams.length > teamPage && (
                  <button onClick={() => setTeamPage(p => p + 5)}
                    className="w-full py-2.5 rounded-xl border border-white/10 text-gray-500 text-xs font-bold hover:bg-white/5 transition-colors">
                    더보기 ({filteredTeams.length - teamPage}개 남음)
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* ── 매칭 등록 탭 ── */}
        {tab === "listings" && (
          <div className="flex flex-col gap-4">
            {/* 등록 버튼 */}
            <button onClick={() => myTeamName === "우리팀" ? setShowTeamNameWarning(true) : setShowListingForm(true)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
              <span>+</span> 매칭 등록하기
            </button>

            {/* 내가 등록한 매칭 */}
            {myListings.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-400 mb-2 px-1">
                  📋 내가 등록한 매칭 <span className="text-gray-600 font-normal">({myListings.length})</span>
                </h3>
                <div className="flex flex-col gap-2">
                  {myListings.map(listing => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      isOwner
                      onClose={closeListing}
                      onReopen={reopenListing}
                      onDelete={deleteListing}
                      onApply={setApplyListing}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 다른 팀의 매칭 구인 */}
            <div>
              <h3 className="text-sm font-bold text-gray-400 mb-2 px-1">
                🏟️ 매칭 구인 중 <span className="text-gray-600 font-normal">({openListings.length})</span>
              </h3>
              {openListings.length === 0 ? (
                <div className="bg-gray-900 border border-white/5 rounded-2xl p-10 text-center">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-gray-400 font-bold">등록된 매칭이 없어요</p>
                  <p className="text-gray-600 text-sm mt-1">가장 먼저 매칭을 등록해보세요!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {openListings.map(listing => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      isOwner={false}
                      onClose={closeListing}
                      onReopen={reopenListing}
                      onDelete={deleteListing}
                      onApply={(l) => myTeamName === "우리팀" ? setShowTeamNameWarning(true) : setApplyListing(l)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 매칭 신청 탭 ── */}
        {tab === "requests" && (
          <div className="flex flex-col gap-4">
            <RequestSection
              title="📥 받은 신청"
              items={receivedRequests}
              page={receivedPage}
              onMore={() => setReceivedPage(p => p + PAGE)}
              emptyText="받은 매칭 신청이 없어요"
              renderCard={(r) => (
                <RequestCard key={r.id} request={r} isReceived myTeamId={myTeamId} onUpdate={updateRequest} onCancel={setCancelTarget} />
              )}
            />
            <RequestSection
              title="📤 보낸 신청"
              items={sentRequests}
              page={sentPage}
              onMore={() => setSentPage(p => p + PAGE)}
              emptyText="보낸 매칭 신청이 없어요"
              renderCard={(r) => (
                <RequestCard key={r.id} request={r} isReceived={false} myTeamId={myTeamId} onUpdate={updateRequest} onCancel={setCancelTarget} />
              )}
            />
            <div>
              <button
                onClick={() => setShowCancelled(v => !v)}
                className="w-full flex items-center justify-between px-1 mb-2"
              >
                <span className="text-sm font-bold text-gray-500">
                  ❌ 취소된 경기 ({cancelledRequests.length})
                </span>
                <span className="text-gray-600 text-xs">{showCancelled ? "▲ 접기" : "▼ 펼치기"}</span>
              </button>
              {showCancelled && (
                <RequestSection
                  title=""
                  items={cancelledRequests}
                  page={cancelledPage}
                  onMore={() => setCancelledPage(p => p + PAGE)}
                  emptyText="취소된 경기가 없어요"
                  renderCard={(r) => (
                    <RequestCard key={r.id} request={r}
                      isReceived={r.to_team_id === myTeamId}
                      myTeamId={myTeamId}
                      onUpdate={updateRequest} onCancel={setCancelTarget} />
                  )}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 매칭 신청 모달 (상대팀 찾기) ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-lg">⚽ 매칭 신청</h3>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-gray-400 text-sm"><span className="text-white font-bold">{selected.teams.name}</span> 팀에 매칭을 신청해요</p>

            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">경기 방식</label>
              <div className="flex gap-2">
                {["풋살", "축구"].map(g => (
                  <button key={g} onClick={() => setForm(f => ({ ...f, game_type: g }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${form.game_type === g ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">희망 날짜</label>
              <input type="date" value={form.proposed_date}
                onChange={e => setForm(f => ({ ...f, proposed_date: e.target.value }))}
                className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">시작 시간</label>
              <TimeSelect value={form.proposed_time} onChange={v => setForm(f => ({ ...f, proposed_time: v }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">종료 시간</label>
              <TimeSelect value={form.proposed_end_time} onChange={v => setForm(f => ({ ...f, proposed_end_time: v }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">희망 장소</label>
              <KakaoPlaceSearch selected={selectedPlace} onSelect={setSelectedPlace} onClear={() => setSelectedPlace(null)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">메시지 (선택)</label>
              <textarea rows={3} value={form.message} placeholder="간단한 인사나 요청사항을 적어주세요"
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelected(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/5 transition-colors">
                취소
              </button>
              <button onClick={sendRequest} disabled={applying}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors disabled:opacity-50">
                {applying ? "신청 중..." : "신청하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 매칭 등록 폼 모달 ── */}
      {showListingForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-lg">📋 매칭 등록</h3>
              <button onClick={() => setShowListingForm(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-gray-500 text-sm">경기 상대를 구하는 공고를 올려요. 다른 팀이 신청할 수 있어요.</p>

            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">경기 방식</label>
              <div className="flex gap-2">
                {["풋살", "축구"].map(g => (
                  <button key={g} onClick={() => setListingForm(f => ({ ...f, game_type: g }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${listingForm.game_type === g ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">희망 날짜</label>
              <input type="date" value={listingForm.preferred_date}
                onChange={e => setListingForm(f => ({ ...f, preferred_date: e.target.value }))}
                className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">시작 시간</label>
              <TimeSelect value={listingForm.preferred_time} onChange={v => setListingForm(f => ({ ...f, preferred_time: v }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">종료 시간</label>
              <TimeSelect value={listingForm.preferred_end_time} onChange={v => setListingForm(f => ({ ...f, preferred_end_time: v }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">희망 장소</label>
              <KakaoPlaceSearch selected={listingPlace} onSelect={setListingPlace} onClear={() => setListingPlace(null)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">소개 메시지 (선택)</label>
              <textarea rows={3} value={listingForm.message} placeholder="어떤 팀과 경기하고 싶은지 간단히 적어주세요"
                onChange={e => setListingForm(f => ({ ...f, message: e.target.value }))}
                className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowListingForm(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/5 transition-colors">
                취소
              </button>
              <button onClick={createListing} disabled={creatingListing}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors disabled:opacity-50">
                {creatingListing ? "등록 중..." : "등록하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 매칭 등록 신청 모달 ── */}
      {applyListing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-lg">⚽ 매칭 신청</h3>
              <button onClick={() => { setApplyListing(null); setApplyMessage(""); }} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            {/* 등록 정보 미리보기 */}
            <div className="bg-gray-800/60 border border-white/5 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
                  style={{ backgroundColor: applyListing.teams.color }}>
                  {applyListing.teams.name.slice(0, 2)}
                </div>
                <span className="font-bold text-white text-sm">{applyListing.teams.name}</span>
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{applyListing.game_type}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                {applyListing.preferred_date && (
                  <span>📅 {applyListing.preferred_date}
                    {applyListing.preferred_time ? ` ${applyListing.preferred_time}` : ""}
                    {applyListing.preferred_end_time ? ` ~ ${applyListing.preferred_end_time}` : ""}
                  </span>
                )}
                {applyListing.location && <span>📍 {applyListing.location}</span>}
              </div>
              {applyListing.message && (
                <p className="text-xs text-gray-500 italic">"{applyListing.message}"</p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">메시지 (선택)</label>
              <textarea rows={3} value={applyMessage}
                placeholder="간단한 인사나 팀 소개를 적어주세요"
                onChange={e => setApplyMessage(e.target.value)}
                className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setApplyListing(null); setApplyMessage(""); }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/5 transition-colors">
                취소
              </button>
              <button onClick={sendListingRequest} disabled={applyingListing}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors disabled:opacity-50">
                {applyingListing ? "신청 중..." : "신청하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 팀 이름 경고 모달 ── */}
      {showTeamNameWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="text-center">
              <p className="text-4xl mb-3">⚠️</p>
              <h3 className="font-bold text-white text-lg mb-1">팀 이름을 먼저 설정해주세요</h3>
              <p className="text-gray-400 text-sm">현재 팀 이름이 <span className="text-amber-400 font-bold">"우리팀"</span>으로 설정되어 있어요.<br/>매칭 기능을 이용하려면 팀 이름을 변경해주세요.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowTeamNameWarning(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/5 transition-colors">
                닫기
              </button>
              <button onClick={() => { setShowTeamNameWarning(false); router.push("/mypage"); }}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors">
                팀 설정하러 가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 취소 모달 ── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-lg">❌ 매칭 취소</h3>
              <button onClick={() => { setCancelTarget(null); setCancelReason(""); }} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="bg-gray-800/60 border border-white/5 rounded-xl px-4 py-3">
              <p className="text-sm text-gray-400">
                <span className="text-white font-bold">
                  {cancelTarget.from_team_id === myTeamId ? cancelTarget.to_team.name : cancelTarget.from_team.name}
                </span>
                {" "}과의 매칭을 취소할게요.
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-widest">취소 사유 (선택)</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="취소 사유를 적어주세요. 상대팀에게 전달돼요."
                rows={3}
                className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setCancelTarget(null); setCancelReason(""); }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/5 transition-colors">
                돌아가기
              </button>
              <button onClick={submitCancel}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-colors">
                매칭 취소
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ── 공통 컴포넌트 ──

function ListingCard({ listing, isOwner, onClose, onReopen, onDelete, onApply }: {
  listing: MatchListing;
  isOwner: boolean;
  onClose: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  onApply: (l: MatchListing) => void;
}) {
  const isOpen = listing.status === "open";
  return (
    <div className={`bg-gray-900 border rounded-2xl p-4 flex flex-col gap-2 ${isOpen ? "border-white/5" : "border-white/5 opacity-70"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black"
            style={{ backgroundColor: listing.teams.color }}>
            {listing.teams.name.slice(0, 2)}
          </div>
          <div>
            <p className="font-bold text-white text-sm">{listing.teams.name}</p>
            <p className="text-xs text-gray-500">{listing.game_type}</p>
          </div>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
          isOpen
            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
            : "text-gray-500 bg-gray-500/10 border-gray-500/20"
        }`}>
          {isOpen ? "모집 중" : "마감"}
        </span>
      </div>

      {(listing.preferred_date || listing.location) && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
          {listing.preferred_date && (
            <span>📅 {listing.preferred_date}
              {listing.preferred_time ? ` ${listing.preferred_time}` : ""}
              {listing.preferred_end_time ? ` ~ ${listing.preferred_end_time}` : ""}
            </span>
          )}
          {listing.location && <span>📍 {listing.location}</span>}
        </div>
      )}

      {listing.message && (
        <p className="text-xs text-gray-400 bg-white/3 rounded-xl px-3 py-2 italic">"{listing.message}"</p>
      )}

      {isOwner ? (
        <div className="flex gap-2 mt-1">
          {isOpen ? (
            <button onClick={() => onClose(listing.id)}
              className="flex-1 py-2 rounded-xl border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/5 transition-colors">
              마감하기
            </button>
          ) : (
            <button onClick={() => onReopen(listing.id)}
              className="flex-1 py-2 rounded-xl border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/10 transition-colors">
              재오픈
            </button>
          )}
          <button onClick={() => onDelete(listing.id)}
            className="flex-1 py-2 rounded-xl border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-colors">
            삭제
          </button>
        </div>
      ) : (
        isOpen && (
          <button onClick={() => onApply(listing)}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-sm transition-colors mt-1">
            매칭 신청하기
          </button>
        )
      )}
    </div>
  );
}

function RequestSection({
  title, items, page, onMore, emptyText, renderCard,
}: {
  title: string;
  items: MatchRequest[];
  page: number;
  onMore: () => void;
  emptyText: string;
  renderCard: (r: MatchRequest) => React.ReactNode;
}) {
  const visible = items.slice(0, page);
  const hasMore = items.length > page;
  return (
    <div>
      {title && (
        <h3 className="text-sm font-bold text-gray-400 mb-2 px-1">
          {title} <span className="text-gray-600 font-normal">({items.length})</span>
        </h3>
      )}
      {items.length === 0 ? (
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-6 text-center text-gray-600 text-sm">{emptyText}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map(r => renderCard(r))}
          {hasMore && (
            <button onClick={onMore}
              className="w-full py-2.5 rounded-xl border border-white/10 text-gray-500 text-xs font-bold hover:bg-white/5 transition-colors">
              더보기 ({items.length - page}개 남음)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RequestCard({ request, isReceived, myTeamId, onUpdate, onCancel }: {
  request: MatchRequest;
  isReceived: boolean;
  myTeamId: string | null;
  onUpdate: (id: string, status: string) => void;
  onCancel: (r: MatchRequest) => void;
}) {
  const st = STATUS_LABEL[request.status] ?? { label: request.status, cls: "text-gray-400" };
  const opponent = isReceived ? request.from_team : request.to_team;
  const isCancellable = request.status === "pending" || request.status === "accepted";

  return (
    <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
            style={{ backgroundColor: opponent.color }}>
            {opponent.name.slice(0, 2)}
          </div>
          <span className="font-bold text-white text-sm">{opponent.name}</span>
          <span className="text-xs text-gray-500">{request.game_type}</span>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
      </div>

      {(request.proposed_date || request.proposed_location) && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {request.proposed_date && (
            <span>📅 {request.proposed_date}
              {request.proposed_time ? ` ${request.proposed_time}` : ""}
              {request.proposed_end_time ? ` ~ ${request.proposed_end_time}` : ""}
            </span>
          )}
          {request.proposed_location && <span>📍 {request.proposed_location}</span>}
        </div>
      )}

      {request.message && (
        <p className="text-xs text-gray-400 bg-white/3 rounded-xl px-3 py-2">{request.message}</p>
      )}

      {request.status === "cancelled" && request.cancel_reason && (
        <p className="text-xs text-red-400/70 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">
          취소 사유: {request.cancel_reason}
        </p>
      )}

      {isReceived && request.status === "pending" && (
        <div className="flex gap-2 mt-1">
          <button onClick={() => onCancel(request)}
            className="flex-1 py-2 rounded-xl border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-colors">
            거절
          </button>
          <button onClick={() => onUpdate(request.id, "accepted")}
            className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-colors">
            수락
          </button>
        </div>
      )}

      {isCancellable && request.status !== "pending" && (
        <button onClick={() => onCancel(request)}
          className="w-full py-2 rounded-xl border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-colors mt-1">
          매칭 취소
        </button>
      )}

      {!isReceived && request.status === "pending" && (
        <button onClick={() => onCancel(request)}
          className="w-full py-2 rounded-xl border border-white/10 text-gray-500 text-xs font-bold hover:bg-white/5 transition-colors mt-1">
          신청 취소
        </button>
      )}
    </div>
  );
}
