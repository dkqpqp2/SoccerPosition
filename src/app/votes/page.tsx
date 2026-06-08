"use client";

import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import TimeSelect from "@/components/TimeSelect";

interface Voter {
  user_id: string;
  name: string;
}

interface VoteOption {
  id: string;
  label: string;
  order_num: number;
  count: number;
  voters: Voter[];
}

interface VoteComment {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  is_mine: boolean;
}

interface Vote {
  id: string;
  title: string;
  description: string | null;
  vote_date: string | null;
  end_at: string | null;
  is_multiple: boolean;
  status: "open" | "closed";
  created_at: string;
  created_by_name: string | null;
  options: VoteOption[];
  my_responses: string[];
  total_voters: number;
  team_member_count: number;
  comments: VoteComment[];
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const PRESET_OPTIONS: Record<string, string[]> = {
  "경기 참석 여부": ["참석 ✅", "불참 ❌", "미정 🤔"],
  "경기 시간": ["오전", "오후", "저녁"],
  "유니폼 색상": ["흰색", "검정", "빨강", "파랑"],
  직접입력: [],
};

export default function VotesPage() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 만들기 폼
  const [form, setForm] = useState({
    title: "",
    description: "",
    vote_date: "",
    end_date: "",   // 마감 날짜
    end_time: "",   // 마감 시간 HH:MM
    is_multiple: false,
    options: ["", ""],
    preset: "직접입력",
  });

  const fetchVotes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/votes");
    if (res.ok) setVotes(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVotes();
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((d) => { if (d.is_owner) setIsOwner(true); })
      .catch(() => {});
  }, [fetchVotes]);

  async function handleVote(voteId: string, optionIds: string[]) {
    const res = await fetch(`/api/votes/${voteId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: optionIds }),
    });
    if (res.ok) fetchVotes();
  }

  async function handleRemoveVote(voteId: string) {
    const res = await fetch(`/api/votes/${voteId}/respond`, { method: "DELETE" });
    if (res.ok) fetchVotes();
  }

  async function handleAddComment(voteId: string, content: string) {
    const res = await fetch(`/api/votes/${voteId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) fetchVotes();
    return res.ok;
  }

  async function handleDeleteComment(voteId: string, commentId: string) {
    const res = await fetch(`/api/votes/${voteId}/comments/${commentId}`, { method: "DELETE" });
    if (res.ok) fetchVotes();
  }

  async function handleClose(voteId: string) {
    if (!confirm("이 투표를 마감할까요?")) return;
    const res = await fetch(`/api/votes/${voteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    if (res.ok) fetchVotes();
  }

  async function handleDelete(voteId: string) {
    if (!confirm("이 투표를 삭제할까요?")) return;
    const res = await fetch(`/api/votes/${voteId}`, { method: "DELETE" });
    if (res.ok) fetchVotes();
  }

  async function handleCreate() {
    const validOptions = form.options.filter((o) => o.trim());
    if (!form.title.trim()) return alert("제목을 입력해주세요");
    if (validOptions.length < 2) return alert("선택지를 최소 2개 입력해주세요");

    setSubmitting(true);
    // end_date + end_time 조합 → ISO 문자열
    const end_at =
      form.end_date && form.end_time
        ? new Date(`${form.end_date}T${form.end_time}:00`).toISOString()
        : form.end_date
        ? new Date(`${form.end_date}T23:59:00`).toISOString()
        : null;

    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || null,
        vote_date: form.vote_date || null,
        end_at,
        is_multiple: form.is_multiple,
        options: validOptions,
      }),
    });

    if (res.ok) {
      setShowCreateModal(false);
      resetForm();
      fetchVotes();
    } else {
      const d = await res.json();
      alert(d.error || "오류가 발생했습니다");
    }
    setSubmitting(false);
  }

  function resetForm() {
    setForm({
      title: "",
      description: "",
      vote_date: "",
      end_date: "",
      end_time: "",
      is_multiple: false,
      options: ["", ""],
      preset: "직접입력",
    });
  }

  function applyPreset(preset: string) {
    const opts = PRESET_OPTIONS[preset] ?? [];
    setForm((f) => ({
      ...f,
      preset,
      title: preset === "직접입력" ? f.title : preset,
      options: opts.length ? [...opts] : ["", ""],
    }));
  }

  // ── 달력 계산 ──
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // vote_date별로 투표 그룹핑
  const voteDateMap: Record<string, Vote[]> = {};
  votes.forEach((vote) => {
    if (vote.vote_date) {
      const d = vote.vote_date.slice(0, 10);
      if (!voteDateMap[d]) voteDateMap[d] = [];
      voteDateMap[d].push(vote);
    }
  });

  // 표시할 투표 (날짜 필터 or 전체)
  const displayVotes = selectedDate
    ? votes.filter((v) => v.vote_date?.slice(0, 10) === selectedDate)
    : votes;

  function formatEndAt(endAt: string) {
    const d = new Date(endAt);
    const mo = d.getMonth() + 1;
    const day = d.getDate();
    const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    const h = d.getHours();
    const ampm = h < 12 ? "오전" : "오후";
    const h12 = h % 12 || 12;
    const m = d.getMinutes();
    return `${mo}월 ${day}일 (${wd}) ${ampm} ${h12}:${String(m).padStart(2, "0")}`;
  }

  function formatSelectedDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    const mo = d.getMonth() + 1;
    const day = d.getDate();
    const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${mo}월 ${day}일 (${wd})`;
  }

  return (
    <AppLayout title="투표" helpContent={{ items: [
      { icon: "📝", title: "투표 만들기", desc: "관리자는 + 투표 만들기 버튼으로 새 투표를 생성해요. 제목·항목·기간을 설정할 수 있어요." },
      { icon: "🗳️", title: "투표 참여", desc: "진행 중인 투표에서 항목을 선택해 투표할 수 있어요. 마감 전까지 변경 가능해요." },
      { icon: "📊", title: "결과 확인", desc: "마감된 투표는 결과를 바 차트로 확인할 수 있어요." },
      { icon: "🔒", title: "비공개 투표", desc: "익명 투표로 설정하면 누가 무엇에 투표했는지 공개되지 않아요." },
    ]}}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">🗳️ 투표</h2>
            <p className="text-xs text-gray-500 mt-0.5">팀 투표를 만들고 참여해요</p>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
            >
              + 투표 만들기
            </button>
          )}
        </div>

        {/* ── 달력 ── */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-4">
          {/* 월 네비게이션 */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => { setCurrentMonth(new Date(year, month - 1, 1)); setSelectedDate(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors text-lg"
            >
              ‹
            </button>
            <p className="text-sm font-bold text-white">
              {year}년 {month + 1}월
            </p>
            <button
              onClick={() => { setCurrentMonth(new Date(year, month + 1, 1)); setSelectedDate(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors text-lg"
            >
              ›
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`text-center text-[10px] font-bold py-1 ${
                  i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-600"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayVotes = voteDateMap[dateStr] ?? [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const dayOfWeek = (firstDayOfWeek + day - 1) % 7;
              const openCount = dayVotes.filter((v) => v.status === "open").length;
              const closedCount = dayVotes.filter((v) => v.status === "closed").length;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`relative flex flex-col items-center pt-1.5 pb-2 rounded-xl transition-all ${
                    isSelected
                      ? "bg-emerald-500/20 ring-1 ring-emerald-500/40"
                      : isToday
                      ? "bg-white/5"
                      : "hover:bg-white/5"
                  }`}
                >
                  {/* 오늘 표시 점 */}
                  {isToday && !isSelected && (
                    <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-emerald-400" />
                  )}
                  <span
                    className={`text-xs font-semibold leading-none ${
                      isSelected
                        ? "text-emerald-400 font-black"
                        : isToday
                        ? "text-white font-black"
                        : dayOfWeek === 0
                        ? "text-red-400"
                        : dayOfWeek === 6
                        ? "text-blue-400"
                        : "text-gray-300"
                    }`}
                  >
                    {day}
                  </span>
                  {/* 투표 인디케이터 */}
                  {dayVotes.length > 0 && (
                    <div className="flex gap-0.5 mt-1 justify-center flex-wrap px-1">
                      {openCount > 0 && (
                        <span
                          className="rounded-full bg-emerald-400"
                          style={{ width: 5, height: 5 }}
                        />
                      )}
                      {openCount > 1 && (
                        <span
                          className="rounded-full bg-emerald-400"
                          style={{ width: 5, height: 5 }}
                        />
                      )}
                      {closedCount > 0 && (
                        <span
                          className="rounded-full bg-gray-600"
                          style={{ width: 5, height: 5 }}
                        />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* 범례 */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-gray-500">진행중 투표</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-600" />
              <span className="text-[10px] text-gray-500">마감된 투표</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-gray-500">오늘</span>
            </div>
          </div>
        </div>

        {/* 날짜 필터 chip */}
        {selectedDate && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1">
              <span className="text-xs font-bold text-emerald-400">
                📅 {formatSelectedDate(selectedDate)}
              </span>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-emerald-500 hover:text-emerald-300 text-xs leading-none ml-1"
              >
                ×
              </button>
            </div>
            <span className="text-xs text-gray-600">
              {displayVotes.length}개 투표
            </span>
          </div>
        )}

        {/* 투표 목록 */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayVotes.length === 0 ? (
          <div className="text-center py-14">
            <div className="text-5xl mb-3 opacity-20">🗳️</div>
            <p className="text-gray-600 text-sm">
              {selectedDate ? "이 날 투표가 없어요" : "아직 투표가 없어요"}
            </p>
            {isOwner && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 font-semibold border border-emerald-500/30 px-4 py-2 rounded-xl hover:bg-emerald-500/10 transition-colors"
              >
                첫 투표 만들기 →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayVotes.map((vote) => (
              <VoteCard
                key={vote.id}
                vote={vote}
                isOwner={isOwner}
                onVote={handleVote}
                onRemoveVote={handleRemoveVote}
                onClose={handleClose}
                onDelete={handleDelete}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                formatEndAt={formatEndAt}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 투표 만들기 모달 ── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          onClick={() => { setShowCreateModal(false); resetForm(); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative flex min-h-full items-end sm:items-center justify-center py-0 sm:py-6">
          <div
            className="relative bg-gray-900 border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg flex flex-col"
            style={{ maxHeight: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <h3 className="font-bold text-white">투표 만들기</h3>
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xl transition-colors"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* 빠른 선택 */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">빠른 선택</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(PRESET_OPTIONS).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => applyPreset(preset)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        form.preset === preset
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* 제목 */}
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1.5 block">제목 *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="예) 이번 주 경기 참석 여부"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
                />
              </div>

              {/* 설명 */}
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1.5 block">설명 (선택)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="추가 안내 사항"
                  rows={2}
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 resize-none transition-colors"
                />
              </div>

              {/* 관련 날짜 */}
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1.5 block">📅 관련 날짜</label>
                <input
                  type="date"
                  value={form.vote_date}
                  onChange={(e) => setForm((f) => ({ ...f, vote_date: e.target.value }))}
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/40 transition-colors"
                />
                <p className="text-[10px] text-gray-600 mt-1">달력에 표시됩니다</p>
              </div>

              {/* 마감 날짜 + 시간 */}
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1.5 block">⏰ 마감 일시 <span className="text-gray-700">(없으면 수동 마감)</span></label>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="flex-1 bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/40 transition-colors"
                  />
                  <span className="text-gray-600 text-sm shrink-0">~</span>
                  <div className="flex-1">
                    <TimeSelect
                      value={form.end_time}
                      onChange={(val) => setForm((f) => ({ ...f, end_time: val }))}
                    />
                  </div>
                </div>
              </div>

              {/* 복수 선택 토글 */}
              <button
                onClick={() => setForm((f) => ({ ...f, is_multiple: !f.is_multiple }))}
                className="w-full flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div>
                  <p className="text-sm text-gray-200 font-medium">복수 선택 허용</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">여러 항목에 동시에 투표 가능</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.is_multiple ? "bg-emerald-500" : "bg-gray-700"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.is_multiple ? "right-0.5" : "left-0.5"}`} />
                </div>
              </button>

              {/* 선택지 */}
              <div>
                <label className="text-xs text-gray-500 font-medium mb-2 block">선택지 *</label>
                <div className="space-y-2">
                  {form.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-700 w-5 shrink-0 text-right">{i + 1}</span>
                      <input
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...form.options];
                          newOpts[i] = e.target.value;
                          setForm((f) => ({ ...f, options: newOpts }));
                        }}
                        placeholder={`선택지 ${i + 1}`}
                        className="flex-1 bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
                      />
                      {form.options.length > 2 && (
                        <button
                          onClick={() => setForm((f) => ({ ...f, options: f.options.filter((_, j) => j !== i) }))}
                          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-400 text-lg leading-none shrink-0 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {form.options.length < 6 && (
                  <button
                    onClick={() => setForm((f) => ({ ...f, options: [...f.options, ""] }))}
                    className="mt-2.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
                  >
                    + 선택지 추가
                  </button>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-white/5 shrink-0">
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-colors"
              >
                {submitting ? "생성 중..." : "투표 만들기"}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ── 투표 카드 컴포넌트 ──
function VoteCard({
  vote,
  isOwner,
  onVote,
  onRemoveVote,
  onClose,
  onDelete,
  onAddComment,
  onDeleteComment,
  formatEndAt,
}: {
  vote: Vote;
  isOwner: boolean;
  onVote: (id: string, optionIds: string[]) => void;
  onRemoveVote: (id: string) => void;
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
  onAddComment: (voteId: string, content: string) => Promise<boolean>;
  onDeleteComment: (voteId: string, commentId: string) => void;
  formatEndAt: (s: string) => string;
}) {
  const [selected, setSelected] = useState<string[]>(vote.my_responses);
  const [expandedOpt, setExpandedOpt] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    setSelected(vote.my_responses);
  }, [vote.my_responses.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasVoted = vote.my_responses.length > 0;
  const isExpired = vote.end_at ? new Date(vote.end_at) < new Date() : false;
  const isClosed = vote.status === "closed" || isExpired;
  const totalVotes = vote.options.reduce((s, o) => s + o.count, 0);
  const hasChanged =
    JSON.stringify([...selected].sort()) !== JSON.stringify([...vote.my_responses].sort());

  // 전체 팀원 대비 참여율
  const memberCount = vote.team_member_count ?? 0;
  const participationPct =
    memberCount > 0 ? Math.round((vote.total_voters / memberCount) * 100) : 0;

  async function submitComment() {
    const trimmed = commentInput.trim();
    if (!trimmed || submittingComment) return;
    setSubmittingComment(true);
    const ok = await onAddComment(vote.id, trimmed);
    if (ok) setCommentInput("");
    setSubmittingComment(false);
  }

  function formatCommentTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return "방금";
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}시간 전`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function toggle(optId: string) {
    if (isClosed) return;
    if (vote.is_multiple) {
      setSelected((prev) =>
        prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
      );
    } else {
      setSelected([optId]);
    }
  }

  return (
    <div
      className={`bg-gray-900 border rounded-2xl overflow-hidden transition-all ${
        isClosed ? "border-white/5" : "border-emerald-500/10"
      }`}
    >
      {/* ── 헤더 ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {/* 뱃지들 */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isClosed ? "bg-gray-800 text-gray-500" : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {isClosed ? "마감" : "진행중"}
              </span>
              {vote.is_multiple && (
                <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">
                  복수선택
                </span>
              )}
              {vote.vote_date && (
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                  📅 {vote.vote_date.slice(5).replace("-", "/")}
                </span>
              )}
            </div>

            {/* 제목 */}
            <p className="text-sm font-bold text-white">{vote.title}</p>
            {vote.description && (
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{vote.description}</p>
            )}

            {/* 작성자 + 마감시간 */}
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {vote.created_by_name && (
                <span className="text-[10px] text-gray-600">
                  👤 {vote.created_by_name}
                </span>
              )}
              {vote.end_at && (
                <span className={`text-[10px] ${isClosed ? "text-gray-700" : "text-gray-500"}`}>
                  {isClosed
                    ? `⏰ ${formatEndAt(vote.end_at)} 마감됨`
                    : `⏰ 마감 ${formatEndAt(vote.end_at)}`}
                </span>
              )}
            </div>
          </div>

          {/* 관리자 버튼 */}
          {isOwner && (
            <div className="flex gap-1 shrink-0">
              {!isClosed && (
                <button
                  onClick={() => onClose(vote.id)}
                  className="text-[10px] text-gray-600 hover:text-yellow-400 px-2 py-1 rounded-lg hover:bg-yellow-500/10 transition-colors border border-white/5"
                >
                  마감
                </button>
              )}
              <button
                onClick={() => onDelete(vote.id)}
                className="text-[10px] text-gray-600 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors border border-white/5"
              >
                삭제
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 선택지 ── */}
      <div className="px-4 pb-3 space-y-2">
        {vote.options.map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.count / totalVotes) * 100) : 0;
          const isMyVote = vote.my_responses.includes(opt.id);
          const isSelectedNow = selected.includes(opt.id);
          const showBars = hasVoted || isClosed;
          const isExpanded = expandedOpt === opt.id;

          return (
            <div key={opt.id}>
              {/* 선택지 행 */}
              <div className="relative rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-white/3 rounded-xl" />
                {showBars && pct > 0 && (
                  <div
                    className={`absolute left-0 top-0 bottom-0 rounded-xl transition-[width] duration-700 ${
                      isMyVote ? "bg-emerald-500/30" : "bg-white/8"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                )}
                {!hasVoted && isSelectedNow && !isClosed && (
                  <div className="absolute inset-0 rounded-xl ring-1 ring-emerald-500/50 bg-emerald-500/5" />
                )}

                <button
                  onClick={() => toggle(opt.id)}
                  disabled={isClosed}
                  className={`relative w-full px-3 py-2.5 flex items-center justify-between text-left ${
                    isClosed ? "cursor-default" : "cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-[8px] font-black transition-colors ${
                        isMyVote
                          ? "bg-emerald-500 border-emerald-500 text-black"
                          : isSelectedNow && !hasVoted
                          ? "bg-emerald-500/30 border-emerald-500/60 text-emerald-400"
                          : "border-white/20 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span
                      className={`text-sm truncate ${
                        isMyVote
                          ? "text-white font-bold"
                          : isSelectedNow && !hasVoted
                          ? "text-emerald-300 font-semibold"
                          : "text-gray-300"
                      }`}
                    >
                      {opt.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {showBars && (
                      <>
                        <span className={`text-xs font-bold ${isMyVote ? "text-emerald-400" : "text-gray-400"}`}>
                          {pct}%
                        </span>
                        <span className="text-[10px] text-gray-600 min-w-[28px] text-right">
                          {opt.count}명
                        </span>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {/* 투표자 이름 목록 (투표 후 or 마감 시 표시) */}
              {showBars && opt.voters.length > 0 && (
                <div className="mt-1 px-1">
                  <button
                    onClick={() => setExpandedOpt(isExpanded ? null : opt.id)}
                    className="flex items-center gap-1.5 w-full text-left"
                  >
                    {/* 이름 칩 미리보기 (접힌 상태) */}
                    {!isExpanded && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {opt.voters.slice(0, 4).map((v) => (
                          <span
                            key={v.user_id}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              isMyVote && v.user_id === vote.my_responses[0]
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-white/5 text-gray-500"
                            }`}
                          >
                            {v.name}
                          </span>
                        ))}
                        {opt.voters.length > 4 && (
                          <span className="text-[10px] text-gray-600">
                            외 {opt.voters.length - 4}명 ▾
                          </span>
                        )}
                        {opt.voters.length <= 4 && (
                          <span className="text-[10px] text-gray-700 ml-0.5">▾</span>
                        )}
                      </div>
                    )}
                    {/* 펼친 상태 */}
                    {isExpanded && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {opt.voters.map((v) => (
                          <span
                            key={v.user_id}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              vote.my_responses.includes(opt.id) && v.user_id === vote.my_responses[0]
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-white/5 text-gray-500"
                            }`}
                          >
                            {v.name}
                          </span>
                        ))}
                        <span className="text-[10px] text-gray-700 ml-0.5">▴</span>
                      </div>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 전체 참여율 바 ── */}
      {memberCount > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-gray-800/60 rounded-xl px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500 font-medium">전체 팀원 참여율</span>
              <span className="text-[10px] font-bold text-gray-400">
                {vote.total_voters}/{memberCount}명
                <span className={`ml-1 ${participationPct >= 70 ? "text-emerald-400" : participationPct >= 40 ? "text-yellow-400" : "text-gray-500"}`}>
                  ({participationPct}%)
                </span>
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-700 ${
                  participationPct >= 70
                    ? "bg-emerald-500"
                    : participationPct >= 40
                    ? "bg-yellow-500"
                    : "bg-gray-600"
                }`}
                style={{ width: `${participationPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 댓글 섹션 ── */}
      <div className="px-4 pb-2">
        {/* 댓글 토글 버튼 */}
        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors py-1"
        >
          <span>💬</span>
          <span>댓글 {vote.comments.length > 0 ? `${vote.comments.length}개` : "달기"}</span>
          {vote.comments.length > 0 && (
            <span className="text-gray-700">{showComments ? "▴" : "▾"}</span>
          )}
        </button>

        {showComments && (
          <div className="mt-2 space-y-0.5">
            {/* 댓글 목록 */}
            {vote.comments.length > 0 && (
              <div className="space-y-1 mb-3">
                {vote.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="group flex items-start gap-2 bg-white/3 rounded-xl px-3 py-2.5 border border-white/5"
                  >
                    {/* 아바타 */}
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-emerald-400">
                        {comment.user_name.slice(0, 1)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[11px] font-bold ${comment.is_mine ? "text-emerald-400" : "text-gray-300"}`}>
                          {comment.user_name}
                          {comment.is_mine && <span className="text-[9px] text-emerald-600 ml-1">나</span>}
                        </span>
                        <span className="text-[10px] text-gray-700">
                          {formatCommentTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                        {comment.content}
                      </p>
                    </div>

                    {/* 삭제 버튼 (본인 or 관리자) */}
                    {(comment.is_mine || isOwner) && (
                      <button
                        onClick={() => onDeleteComment(vote.id, comment.id)}
                        className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 text-xs mt-0.5"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 댓글 입력 */}
            <div className="flex gap-2 items-end">
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
                placeholder="댓글을 남겨주세요... (Enter로 전송)"
                rows={2}
                className="flex-1 bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 resize-none transition-colors"
              />
              <button
                onClick={submitComment}
                disabled={!commentInput.trim() || submittingComment}
                className="shrink-0 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold text-xs px-3 py-2 rounded-xl transition-colors h-[52px] flex items-center"
              >
                {submittingComment ? "..." : "등록"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 액션 버튼 ── */}
      <div className="px-4 pb-4 flex items-center justify-between -mt-1">
        <span className="text-[10px] text-gray-700">
          {new Date(vote.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} 등록
        </span>

        <div className="flex items-center gap-2">
          {hasVoted && !isClosed && (
            <button
              onClick={() => onRemoveVote(vote.id)}
              className="text-[10px] text-gray-600 hover:text-red-400 transition-colors"
            >
              투표 취소
            </button>
          )}
          {!isClosed && (
            <>
              {!hasVoted && (
                <button
                  onClick={() => onVote(vote.id, selected)}
                  disabled={selected.length === 0}
                  className="text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-black px-4 py-1.5 rounded-lg transition-colors"
                >
                  투표하기
                </button>
              )}
              {hasVoted && hasChanged && (
                <button
                  onClick={() => onVote(vote.id, selected)}
                  className="text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-lg transition-colors border border-emerald-500/30"
                >
                  변경하기
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
