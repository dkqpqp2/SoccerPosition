"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { POSITION_MAP } from "@/lib/positions";
import PositionSelect from "@/components/PositionSelect";

interface Member {
  id: string;
  name: string;
  position_1st: string | null;
  position_2nd: string | null;
  is_mercenary: boolean;
}

interface FormData {
  name: string;
  position_1st: string;
  position_2nd: string;
  is_mercenary: boolean;
}

export default function MembersPage() {
  const { status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ name: "", position_1st: "", position_2nd: "", is_mercenary: false });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") fetchMembers();
  }, [status]);

  async function fetchMembers() {
    const res = await fetch("/api/members");
    const data = await res.json();
    setMembers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      await fetch(`/api/members/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: false });
    setShowForm(false);
    setEditId(null);
    fetchMembers();
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    fetchMembers();
  }

  function handleEdit(member: Member) {
    setForm({
      name: member.name,
      position_1st: member.position_1st || "",
      position_2nd: member.position_2nd || "",
      is_mercenary: member.is_mercenary,
    });
    setEditId(member.id);
    setShowForm(true);
  }

  const regularMembers = members.filter(m => !m.is_mercenary);
  const mercenaryMembers = members.filter(m => m.is_mercenary);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} className="text-white hover:text-green-200">← 뒤로</button>
        <div className="flex items-center gap-2">
          <span className="text-xl">👥</span>
          <h1 className="text-lg font-bold">팀원 관리</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-3 text-sm text-gray-500">
            <span>팀원 <b className="text-gray-800">{regularMembers.length}명</b></span>
            <span>용병 <b className="text-orange-500">{mercenaryMembers.length}명</b></span>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm({ name: "", position_1st: "", position_2nd: "", is_mercenary: false }); }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition-colors"
          >
            + 팀원 추가
          </button>
        </div>

        <div className="flex gap-6 items-start">

          {/* 왼쪽: 폼 */}
          <div className="w-72 shrink-0">
            {showForm ? (
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-5 sticky top-6">
                <h2 className="font-bold text-gray-800 mb-4">{editId ? "팀원 수정" : "팀원 추가"}</h2>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">이름 *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="팀원 이름"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">1순위 포지션</label>
                    <PositionSelect
                      value={form.position_1st}
                      onChange={v => setForm({ ...form, position_1st: v })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">2순위 포지션</label>
                    <PositionSelect
                      value={form.position_2nd}
                      onChange={v => setForm({ ...form, position_2nd: v })}
                    />
                  </div>

                  {/* 용병 토글 */}
                  <div
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-colors ${form.is_mercenary ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-gray-50"}`}
                    onClick={() => setForm({ ...form, is_mercenary: !form.is_mercenary })}
                  >
                    <div>
                      <p className={`font-medium text-sm ${form.is_mercenary ? "text-orange-600" : "text-gray-600"}`}>용병</p>
                      <p className="text-xs text-gray-400">정규 팀원이 아닌 용병</p>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${form.is_mercenary ? "bg-orange-400" : "bg-gray-300"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_mercenary ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm font-medium transition-colors">
                      {editId ? "수정 완료" : "추가"}
                    </button>
                    <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-xl text-sm font-medium transition-colors">
                      취소
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="bg-white rounded-2xl shadow p-5 text-center text-gray-400">
                <div className="text-3xl mb-2">👆</div>
                <p className="text-sm">우측 상단 버튼으로<br/>팀원을 추가하세요</p>
              </div>
            )}
          </div>

          {/* 오른쪽: 정규팀원 + 용병 나란히 */}
          <div className="flex-1 flex gap-4 items-start min-w-0">
            {loading ? (
              <p className="text-gray-400 py-10">로딩 중...</p>
            ) : members.length === 0 ? (
              <div className="flex-1 text-center py-16 text-gray-400">
                <div className="text-5xl mb-3">👥</div>
                <p>아직 팀원이 없어요</p>
              </div>
            ) : (
              <>
                {/* 정규 팀원 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-400 mb-2 px-1">정규 팀원 ({regularMembers.length}명)</p>
                  {regularMembers.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow p-6 text-center text-gray-300 text-sm">없음</div>
                  ) : (
                    <div className="bg-white rounded-2xl shadow overflow-hidden">
                      {regularMembers.map((member, idx) => (
                        <MemberRow key={member.id} member={member} isLast={idx === regularMembers.length - 1} onEdit={handleEdit} onDelete={handleDelete} />
                      ))}
                    </div>
                  )}
                </div>

                {/* 용병 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-orange-400 mb-2 px-1">⚡ 용병 ({mercenaryMembers.length}명)</p>
                  {mercenaryMembers.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow p-6 text-center text-gray-300 text-sm border-2 border-orange-100">없음</div>
                  ) : (
                    <div className="bg-white rounded-2xl shadow overflow-hidden border-2 border-orange-200">
                      {mercenaryMembers.map((member, idx) => (
                        <MemberRow key={member.id} member={member} isLast={idx === mercenaryMembers.length - 1} onEdit={handleEdit} onDelete={handleDelete} isMercenary />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

function MemberRow({ member, isLast, onEdit, onDelete, isMercenary = false }: {
  member: Member;
  isLast: boolean;
  onEdit: (m: Member) => void;
  onDelete: (id: string) => void;
  isMercenary?: boolean;
}) {
  return (
    <div className={`px-4 py-3 ${!isLast ? "border-b border-gray-100" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-semibold ${isMercenary ? "text-orange-600" : "text-gray-800"}`}>
          {member.name}{isMercenary && <span className="ml-1 text-xs">⚡</span>}
        </span>
        <div className="flex gap-1">
          <button onClick={() => onEdit(member)} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-0.5 rounded hover:bg-blue-50">수정</button>
          <button onClick={() => onDelete(member.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-0.5 rounded hover:bg-red-50">삭제</button>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {member.position_1st ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            1️⃣ {member.position_1st} · {POSITION_MAP[member.position_1st]?.description}
          </span>
        ) : (
          <span className="text-xs text-gray-300">1순위 미설정</span>
        )}
        {member.position_2nd && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            2️⃣ {member.position_2nd} · {POSITION_MAP[member.position_2nd]?.description}
          </span>
        )}
      </div>
    </div>
  );
}
