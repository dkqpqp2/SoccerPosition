"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { POSITION_MAP } from "@/lib/positions";
import AppLayout from "@/components/AppLayout";
import PositionSelect from "@/components/PositionSelect";

interface Member {
  id: string;
  user_id: string | null;
  name: string;
  position_1st: string | null;
  position_2nd: string | null;
  is_mercenary: boolean;
  is_cafe_mercenary: boolean;
  referrer: string | null;
  birth_year: number | null;
}

interface FormData {
  name: string;
  position_1st: string;
  position_2nd: string;
  is_mercenary: boolean;
  is_cafe_mercenary: boolean;
  referrer: string;
}

interface EvalCard {
  id: string;
  name: string;
  position_1st: string | null;
  position_2nd: string | null;
  strengths: string;
  weaknesses: string;
  notes: string;
  updated_at: string | null;
}

export default function MembersPage() {
  const { status } = useSession();
  const router = useRouter();
  const [members,   setMembers]   = useState<Member[]>([]);
  const [evals,     setEvals]     = useState<EvalCard[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [evalLoading, setEvalLoading] = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ name: "", position_1st: "", position_2nd: "", is_mercenary: false, is_cafe_mercenary: false, referrer: "" });
  const [tab,  setTab]  = useState<"regular" | "mercenary" | "eval">("regular");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [userRole, setUserRole] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canManage = userRole === "owner" || userRole === "manager" || userRole === "coach" || userRole === "president";

  // 계정 연결 모달
  const [linkTarget, setLinkTarget] = useState<Member | null>(null); // 연결할 임의 추가 멤버
  const [linkingId, setLinkingId] = useState<string | null>(null); // 선택한 계정 멤버 id
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") { fetchMembers(); fetchUserRole(); }
  }, [status]);

  // 평가 탭 선택 시 데이터 로드
  useEffect(() => {
    if (tab === "eval") fetchEvals();
  }, [tab]);

  async function fetchUserRole() {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    setUserRole(data.role ?? null);
  }

  async function fetchMembers() {
    const res = await fetch("/api/members");
    const data = await res.json();
    setMembers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function fetchEvals() {
    setEvalLoading(true);
    const res = await fetch("/api/members/evaluations");
    const data = await res.json();
    setEvals(Array.isArray(data) ? data : []);
    setEvalLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    let res: Response;
    if (editId) {
      res = await fetch(`/api/members/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      res = await fetch("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? "오류가 발생했어요. 다시 시도해주세요.");
      return;
    }
    setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: false, is_cafe_mercenary: false, referrer: "" });
    setFormError(null);
    setShowForm(false); setEditId(null); fetchMembers();
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    fetchMembers();
  }

  async function handleLink() {
    if (!linkTarget || !linkingId) return;
    setLinking(true);
    const res = await fetch(`/api/members/${linkTarget.id}/link`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_member_id: linkingId }),
    });
    setLinking(false);
    if (res.ok) {
      setLinkTarget(null);
      setLinkingId(null);
      fetchMembers();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "연결 실패. 다시 시도해주세요.");
    }
  }

  function handleEdit(member: Member) {
    setForm({ name: member.name, position_1st: member.position_1st || "", position_2nd: member.position_2nd || "", is_mercenary: member.is_mercenary, is_cafe_mercenary: member.is_cafe_mercenary, referrer: member.referrer || "" });
    setEditId(member.id); setShowForm(true);
  }

  const regularMembers   = members.filter(m => !m.is_mercenary);
  const mercenaryMembers = members.filter(m => m.is_mercenary);
  const allDisplayed     = tab === "regular" ? regularMembers : mercenaryMembers;
  const totalPages       = Math.ceil(allDisplayed.length / PAGE_SIZE);
  const displayedMembers = allDisplayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppLayout title="팀원 관리" helpContent={{ items: [
      { icon: "👤", title: "팀원 추가", desc: "+ 정규팀원 버튼으로 새 팀원을 등록해요. 이름·포지션·나이를 입력할 수 있어요." },
      { icon: "⚡", title: "용병 추가", desc: "+ 용병 버튼으로 단기 참가자를 등록해요. 정규 통계에 포함되지 않아요." },
      { icon: "🎯", title: "선호 포지션", desc: "각 팀원에게 1순위·2순위 포지션을 설정하면 포지션 배정 시 자동으로 반영돼요." },
      { icon: "📋", title: "평가 탭", desc: "관리자는 팀원별 능력치와 메모를 기록할 수 있어요. 팀원 본인만 볼 수 있어요." },
      { icon: "📊", title: "팀원 통계", desc: "팀 통계 페이지에서 각 팀원의 골·어시스트 기록을 확인할 수 있어요." },
    ]}}>
      {/* 상단 버튼 */}
      <div className="flex justify-end gap-2 px-4 pt-4">
        {canManage && tab !== "eval" && (
          <>
            <button
              onClick={() => { setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: false, is_cafe_mercenary: false, referrer: "" }); setEditId(null); setShowForm(true); }}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3 py-1.5 rounded-xl text-sm transition-colors">
              + 정규팀원
            </button>
            <button
              onClick={() => { setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: true, is_cafe_mercenary: false, referrer: "" }); setEditId(null); setShowForm(true); }}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-xl text-sm transition-colors">
              + 용병
            </button>
          </>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b border-white/5 bg-gray-900/50 mt-2">
        <button onClick={() => { setTab("regular"); setPage(1); }}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === "regular" ? "text-emerald-400 border-b-2 border-emerald-400" : "text-gray-600 hover:text-gray-400"}`}>
          정규 팀원 <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${tab === "regular" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-gray-600"}`}>{regularMembers.length}</span>
        </button>
        <button onClick={() => { setTab("mercenary"); setPage(1); }}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === "mercenary" ? "text-amber-400 border-b-2 border-amber-400" : "text-gray-600 hover:text-gray-400"}`}>
          ⚡ 용병 <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${tab === "mercenary" ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-gray-600"}`}>{mercenaryMembers.length}</span>
        </button>
        <button onClick={() => setTab("eval")}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === "eval" ? "text-purple-400 border-b-2 border-purple-400" : "text-gray-600 hover:text-gray-400"}`}>
          📝 평가
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col" style={{ minHeight: "calc(100vh - 140px)" }}>

        {/* ── 평가 탭 ── */}
        {tab === "eval" ? (
          evalLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : evals.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <div className="text-5xl mb-3 opacity-30">📝</div>
              <p>팀원이 없어요</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {evals.map(ev => (
                <EvalCard
                  key={ev.id}
                  ev={ev}
                  canEdit={canManage}
                  onEdit={() => router.push(`/members/${ev.id}`)}
                />
              ))}
            </div>
          )

        /* ── 정규/용병 탭 ── */
        ) : loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : displayedMembers.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <div className="text-5xl mb-3 opacity-30">{tab === "regular" ? "👥" : "⚡"}</div>
            <p>{tab === "regular" ? "정규 팀원이 없어요" : "용병이 없어요"}</p>
            {canManage && <button onClick={() => { setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: tab === "mercenary", is_cafe_mercenary: false, referrer: "" }); setEditId(null); setShowForm(true); }} className="mt-4 text-sm text-emerald-400 font-bold hover:text-emerald-300">+ 추가하기</button>}
          </div>
        ) : (
          <>
            <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
              {displayedMembers.map((member, idx) => (
                <MemberRow key={member.id} member={member} isLast={idx === displayedMembers.length - 1}
                  onEdit={handleEdit} onDelete={handleDelete} isMercenary={member.is_mercenary}
                  canManage={canManage} onDetail={id => router.push(`/members/${id}`)}
                  onLink={m => setLinkTarget(m)} />
              ))}
            </div>

            <div className="mt-auto pt-6">
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 border border-white/5 text-gray-400 disabled:opacity-30 hover:bg-white/10 transition-colors">← 이전</button>
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${p === page ? "bg-emerald-500 text-black" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>{p}</button>
                    ))}
                  </div>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 border border-white/5 text-gray-400 disabled:opacity-30 hover:bg-white/10 transition-colors">다음 →</button>
                </div>
              )}
              <p className="text-center text-xs text-gray-600 mt-2">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, allDisplayed.length)} / 총 {allDisplayed.length}명
              </p>
            </div>
          </>
        )}
      </div>

      {/* 계정 연결 모달 */}
      {linkTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="absolute inset-0 bg-black/70" onClick={() => { setLinkTarget(null); setLinkingId(null); }} />
          <div className="flex min-h-full items-center justify-center px-4 py-6">
            <div className="relative bg-gray-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl p-6 z-10"
              onClick={e => e.stopPropagation()}>
              <h2 className="font-bold text-white text-lg mb-1">계정 연결</h2>
              <p className="text-sm text-gray-400 mb-5">
                <span className="text-orange-400 font-semibold">{linkTarget.name}</span>님을 아래 계정과 연결할게요. 납부 기록이 모두 이전됩니다.
              </p>

              {/* 연결 가능한 계정 멤버 목록 */}
              <div className="flex flex-col gap-2 mb-5 max-h-60 overflow-y-auto">
                {members.filter(m => m.user_id && !m.is_mercenary).length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-4">연결 가능한 계정이 없어요</p>
                ) : (
                  members.filter(m => m.user_id && !m.is_mercenary).map(m => (
                    <button
                      key={m.id}
                      onClick={() => setLinkingId(m.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                        linkingId === m.id
                          ? "border-purple-400/60 bg-purple-500/10"
                          : "border-white/10 bg-white/3 hover:bg-white/5"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        linkingId === m.id ? "bg-purple-500/20 text-purple-400" : "bg-white/5 text-gray-400"
                      }`}>
                        {m.name.charAt(0)}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${linkingId === m.id ? "text-purple-300" : "text-white"}`}>{m.name}</p>
                        <p className="text-xs text-gray-500">{m.position_1st ?? "포지션 미설정"}</p>
                      </div>
                      {linkingId === m.id && (
                        <span className="ml-auto text-purple-400 text-sm">✓</span>
                      )}
                    </button>
                  ))
                )}
              </div>

              {linkingId && (
                <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                  ⚠️ 연결 후에는 되돌릴 수 없어요. 기존 계정 팀원 항목은 삭제되고, <b>{linkTarget.name}</b>님의 기록이 선택한 계정으로 이전돼요.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleLink}
                  disabled={!linkingId || linking}
                  className="flex-1 bg-purple-500 hover:bg-purple-400 disabled:opacity-40 text-white py-3 rounded-xl font-bold transition-colors"
                >
                  {linking ? "연결 중..." : "계정 연결"}
                </button>
                <button
                  onClick={() => { setLinkTarget(null); setLinkingId(null); }}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-3 rounded-xl font-bold transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모달 폼 */}
      {showForm && canManage && (
        <div className="fixed inset-0 z-50 bg-black/70 overflow-y-auto" onClick={() => { setShowForm(false); setEditId(null); setFormError(null); }}>
          <div className="flex min-h-full items-end sm:items-center justify-center px-0 sm:px-4 py-0 sm:py-6">
          <form onSubmit={handleSubmit}
            className="relative bg-gray-900 border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 z-10"
            onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-white text-lg mb-5">{editId ? "팀원 수정" : "팀원 추가"}</h2>
            {formError && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 font-medium">
                ⚠️ {formError}
              </div>
            )}
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">이름 *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600"
                  placeholder="팀원 이름" required autoFocus />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">1순위 포지션</label>
                <PositionSelect value={form.position_1st} onChange={v => setForm({ ...form, position_1st: v })} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">2순위 포지션</label>
                <PositionSelect value={form.position_2nd} onChange={v => setForm({ ...form, position_2nd: v })} />
              </div>

              {/* 용병 토글 */}
              <div
                className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${form.is_mercenary ? "border-amber-400/50 bg-amber-500/10" : "border-white/10 bg-white/3"}`}
                onClick={() => setForm({ ...form, is_mercenary: !form.is_mercenary, is_cafe_mercenary: false, referrer: "" })}
              >
                <div>
                  <p className={`font-medium text-sm ${form.is_mercenary ? "text-amber-400" : "text-gray-400"}`}>⚡ 용병</p>
                  <p className="text-xs text-gray-600">정규 팀원이 아닌 용병</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.is_mercenary ? "bg-amber-400" : "bg-gray-700"}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_mercenary ? "translate-x-6" : "translate-x-1"}`} />
                </div>
              </div>

              {form.is_mercenary && (
                <>
                  <div
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${form.is_cafe_mercenary ? "border-sky-400/50 bg-sky-500/10" : "border-white/10 bg-white/3"}`}
                    onClick={() => setForm({ ...form, is_cafe_mercenary: !form.is_cafe_mercenary, referrer: form.is_cafe_mercenary ? form.referrer : "" })}
                  >
                    <div>
                      <p className={`font-medium text-sm ${form.is_cafe_mercenary ? "text-sky-400" : "text-gray-400"}`}>☕ 카페용병</p>
                      <p className="text-xs text-gray-600">카페를 통해 구한 용병</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.is_cafe_mercenary ? "bg-sky-400" : "bg-gray-700"}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_cafe_mercenary ? "translate-x-6" : "translate-x-1"}`} />
                    </div>
                  </div>

                  {!form.is_cafe_mercenary && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">누구 지인? (선택)</label>
                      <input type="text" value={form.referrer} onChange={e => setForm({ ...form, referrer: e.target.value })}
                        className="w-full bg-gray-800 border border-amber-500/20 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-600"
                        placeholder="예: 김철수" />
                      {form.referrer && <p className="text-xs text-amber-400 mt-1">표시: <b>{form.name || "이름"} ({form.referrer}지인)</b></p>}
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={submitting} className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black py-3 rounded-xl font-bold transition-colors">
                  {submitting ? "처리 중..." : editId ? "수정 완료" : "추가"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); setFormError(null); setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: false, is_cafe_mercenary: false, referrer: "" }); }}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-3 rounded-xl font-bold transition-colors">취소</button>
              </div>
            </div>
          </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

/* ── 평가 카드 (한눈에 보기) ── */
function EvalCard({ ev, canEdit, onEdit }: {
  ev: EvalCard; canEdit: boolean; onEdit: () => void;
}) {
  const hasContent = ev.strengths || ev.weaknesses || ev.notes;

  return (
    <div className={`bg-gray-900 border rounded-2xl p-4 transition-colors ${
      hasContent ? "border-white/10" : "border-white/5 opacity-60"
    }`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-sm">⚽</div>
          <div>
            <p className="font-bold text-white text-sm">{ev.name}</p>
            <div className="flex gap-1 mt-0.5">
              {ev.position_1st && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full">{ev.position_1st}</span>
              )}
              {ev.position_2nd && (
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full">{ev.position_2nd}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ev.updated_at && (
            <span className="text-[10px] text-gray-600">
              {new Date(ev.updated_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
            </span>
          )}
          {canEdit && (
            <button onClick={onEdit}
              className="text-xs text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-2.5 py-1 rounded-lg transition-colors font-semibold">
              수정
            </button>
          )}
        </div>
      </div>

      {hasContent ? (
        <div className="space-y-2">
          {ev.strengths && (
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-bold text-emerald-400 mb-1">✅ 장점</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{ev.strengths}</p>
            </div>
          )}
          {ev.weaknesses && (
            <div className="bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-bold text-red-400 mb-1">⚠️ 단점 / 개선점</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{ev.weaknesses}</p>
            </div>
          )}
          {ev.notes && (
            <div className="bg-white/3 border border-white/5 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-bold text-gray-500 mb-1">🗒️ 메모</p>
              <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">{ev.notes}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-3">
          <p className="text-xs text-gray-700">아직 작성된 평가가 없어요</p>
          {canEdit && (
            <button onClick={onEdit} className="mt-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold">
              + 평가 작성하기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 팀원 행 ── */
function MemberRow({ member, isLast, onEdit, onDelete, isMercenary = false, canManage = false, onDetail, onLink }: {
  member: Member; isLast: boolean; onEdit: (m: Member) => void; onDelete: (id: string) => void;
  canManage?: boolean; isMercenary?: boolean; onDetail?: (id: string) => void; onLink?: (m: Member) => void;
}) {
  const age = member.birth_year ? new Date().getFullYear() - member.birth_year : null;
  const isManual = !member.user_id; // 임의 추가된 팀원 (계정 없음)

  return (
    <div className={`px-4 py-3 ${!isLast ? "border-b border-white/5" : ""} ${isManual ? "bg-orange-500/3" : ""}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => !isMercenary && onDetail?.(member.id)}
            className={`text-sm font-semibold transition-colors ${
              isMercenary ? "text-amber-300 cursor-default" : "text-white hover:text-emerald-400"
            }`}
          >
            {member.name}{isMercenary && <span className="ml-1 text-xs">⚡</span>}
          </button>
          {/* 임의 추가 배지 */}
          {isManual && (
            <span className="text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-full font-medium">임의추가</span>
          )}
          {!isMercenary && !isManual && (
            age
              ? <span className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full">만 {age}세</span>
              : <span className="text-xs text-gray-700">나이 미설정</span>
          )}
          {isMercenary && member.is_cafe_mercenary && (
            <span className="text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-full">☕ 카페용병</span>
          )}
          {isMercenary && !member.is_cafe_mercenary && member.referrer && (
            <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">{member.referrer}지인</span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {!isMercenary && (
            <button onClick={() => onDetail?.(member.id)}
              className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors font-semibold">
              📝
            </button>
          )}
          {canManage && (
            <>
              {isManual && !isMercenary && onLink && (
                <button onClick={() => onLink(member)}
                  className="text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded-lg hover:bg-purple-500/10 transition-colors font-semibold">
                  연결
                </button>
              )}
              <button onClick={() => onEdit(member)} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-blue-500/10 transition-colors">수정</button>
              <button onClick={() => onDelete(member.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors">삭제</button>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {member.position_1st ? (
          <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            1️⃣ {member.position_1st} · {POSITION_MAP[member.position_1st]?.description}
          </span>
        ) : (
          <span className="text-xs text-gray-700">1순위 미설정</span>
        )}
        {member.position_2nd && (
          <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
            2️⃣ {member.position_2nd} · {POSITION_MAP[member.position_2nd]?.description}
          </span>
        )}
      </div>
    </div>
  );
}
