"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";

type MemberStatus = "active" | "injured" | "personal";

interface Member {
  id: string;
  user_id: string | null;
  name: string;
  is_mercenary: boolean;
  status: MemberStatus;
  status_note: string | null;
  status_until: string | null;
}

const STATUS_LABEL: Record<MemberStatus, string> = {
  active: "참여가능",
  injured: "부상",
  personal: "개인사정",
};

const STATUS_COLOR: Record<MemberStatus, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  injured: "bg-red-500/20 text-red-400 border border-red-500/30",
  personal: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
};

export default function StatusPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [tab, setTab] = useState<"available" | "unavailable">("available");

  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [form, setForm] = useState<{ status: MemberStatus; status_note: string; status_until: string }>({
    status: "active",
    status_note: "",
    status_until: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/");
    if (authStatus === "authenticated") {
      fetchMembers();
      fetchProfile();
    }
  }, [authStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchMembers() {
    const res = await fetch("/api/members");
    if (res.ok) {
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }

  async function fetchProfile() {
    const res = await fetch("/api/user/profile");
    if (res.ok) {
      const data = await res.json();
      setMyMemberId(data.member_id ?? null);
      setCanManage(["owner", "manager", "coach", "president"].includes(data.role));
    }
  }

  function openEdit(member: Member) {
    setForm({
      status: member.status ?? "active",
      status_note: member.status_note ?? "",
      status_until: member.status_until ?? "",
    });
    setEditTarget(member);
  }

  async function handleSave() {
    if (!editTarget) return;
    setSaving(true);
    const res = await fetch(`/api/members/${editTarget.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setEditTarget(null);
      fetchMembers();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "저장 실패. 다시 시도해주세요.");
    }
  }

  const regularMembers = members.filter(m => !m.is_mercenary);
  const available = regularMembers.filter(m => (m.status ?? "active") === "active");
  const unavailable = regularMembers.filter(m => m.status === "injured" || m.status === "personal");
  const myMember = regularMembers.find(m => m.id === myMemberId);

  return (
    <AppLayout title="팀 현황" helpContent={{ items: [
      { icon: "🩹", title: "부상/개인사정 등록", desc: "본인 상태를 직접 등록하거나, 관리자가 팀원 상태를 대신 등록할 수 있어요." },
      { icon: "📊", title: "불참 인원 파악", desc: "부상·개인사정으로 못 나오는 인원을 한눈에 파악해 경기 불참 인원을 미리 가늠할 수 있어요." },
    ]}}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 내 상태 변경 */}
            {myMember && (
              <button
                onClick={() => openEdit(myMember)}
                className="w-full bg-gray-900 border border-white/5 rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
              >
                <span className="text-xl shrink-0">📝</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">내 상태 변경하기</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    현재 상태: <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold ${STATUS_COLOR[myMember.status ?? "active"]}`}>{STATUS_LABEL[myMember.status ?? "active"]}</span>
                  </p>
                </div>
              </button>
            )}

            {/* 탭 박스 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTab("available")}
                className={`rounded-2xl p-4 text-center transition-colors border ${
                  tab === "available"
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-gray-900 border-white/5 hover:bg-white/5"
                }`}
              >
                <p className={`text-lg font-black ${tab === "available" ? "text-emerald-400" : "text-gray-400"}`}>{available.length}명</p>
                <p className={`text-xs font-bold mt-0.5 ${tab === "available" ? "text-emerald-300" : "text-gray-500"}`}>참여가능 인원</p>
              </button>
              <button
                onClick={() => setTab("unavailable")}
                className={`rounded-2xl p-4 text-center transition-colors border ${
                  tab === "unavailable"
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-gray-900 border-white/5 hover:bg-white/5"
                }`}
              >
                <p className={`text-lg font-black ${tab === "unavailable" ? "text-amber-400" : "text-gray-400"}`}>{unavailable.length}명</p>
                <p className={`text-xs font-bold mt-0.5 ${tab === "unavailable" ? "text-amber-300" : "text-gray-500"}`}>부상 · 개인사정 인원</p>
              </button>
            </div>

            {/* 참여가능 인원 */}
            {tab === "available" && (
              <MemberListSection
                title=""
                emptyIcon="🙁"
                emptyText="참여가능 인원이 없어요"
                members={available}
                myMemberId={myMemberId}
                canManage={canManage}
                onEdit={openEdit}
              />
            )}

            {/* 부상 · 개인사정 인원 */}
            {tab === "unavailable" && (
              <MemberListSection
                title=""
                emptyIcon="✅"
                emptyText="부상·개인사정 인원이 없어요"
                members={unavailable}
                myMemberId={myMemberId}
                canManage={canManage}
                onEdit={openEdit}
              />
            )}
          </>
        )}
      </div>

      {/* 상태 수정 모달 */}
      {editTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60" onClick={() => setEditTarget(null)} />
          <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="relative bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm space-y-4">
              <p className="text-base font-bold text-white">{editTarget.name}님 상태 변경</p>

              <div className="flex gap-2">
                {(["active", "injured", "personal"] as MemberStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setForm(f => ({ ...f, status: s }))}
                    className={`flex-1 text-sm font-bold py-2 rounded-xl transition-colors ${
                      form.status === s ? STATUS_COLOR[s] : "bg-white/5 text-gray-500 border border-white/5"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>

              {form.status !== "active" && (
                <>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">메모 (선택)</label>
                    <textarea
                      value={form.status_note}
                      onChange={e => setForm(f => ({ ...f, status_note: e.target.value }))}
                      placeholder="예: 무릎 부상, 7월 중 복귀 예정"
                      rows={2}
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">복귀 예정일 (선택)</label>
                    <input
                      type="date"
                      value={form.status_until}
                      onChange={e => setForm(f => ({ ...f, status_until: e.target.value }))}
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditTarget(null)} className="flex-1 bg-white/5 text-gray-400 font-bold py-2.5 rounded-xl text-sm hover:bg-white/10 transition-colors">취소</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function MemberListSection({
  title,
  emptyIcon,
  emptyText,
  members,
  myMemberId,
  canManage,
  onEdit,
}: {
  title: string;
  emptyIcon: string;
  emptyText: string;
  members: Member[];
  myMemberId: string | null;
  canManage: boolean;
  onEdit: (member: Member) => void;
}) {
  return (
    <div>
      {title && <p className="text-sm font-bold text-white mb-2">{title}</p>}
      <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
        {members.length === 0 ? (
          <div className="text-center py-10 text-gray-600">
            <div className="text-4xl mb-2 opacity-30">{emptyIcon}</div>
            <p className="text-sm">{emptyText}</p>
          </div>
        ) : (
          members.map((m, idx) => {
            const st: MemberStatus = m.status ?? "active";
            const canEdit = canManage || m.id === myMemberId;
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 px-4 py-3 ${idx !== members.length - 1 ? "border-b border-white/5" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{m.name}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${STATUS_COLOR[st]}`}>{STATUS_LABEL[st]}</span>
                  </div>
                  {(m.status_note || m.status_until) && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {m.status_note}
                      {m.status_note && m.status_until ? " · " : ""}
                      {m.status_until ? `복귀 예정 ${m.status_until}` : ""}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <button onClick={() => onEdit(m)} className="shrink-0 text-xs font-bold text-gray-500 hover:text-emerald-400 px-2 py-1">
                    수정
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
