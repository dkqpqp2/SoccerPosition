"use client";

import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";

interface DueMember {
  user_id: string;
  name: string;
  status: string | null;
  custom_amount: number | null;
  effective_amount: number;
  paid: boolean;
  paid_at: string | null;
  payment_amount: number | null;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  used_at: string;
  memo: string | null;
  created_by_name: string | null;
}

interface Income {
  id: string;
  title: string;
  amount: number;
  category: string;
  received_at: string;
  memo: string | null;
  created_by_name: string | null;
}

interface Summary {
  initial_balance: number;
  total_collected: number;
  total_income: number;
  total_expenses: number;
  balance: number;
}

const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  장비: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "간식/식비": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  경기장: "bg-green-500/20 text-green-300 border-green-500/30",
  유니폼: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  대회: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  기타: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const INCOME_CATEGORY_COLORS: Record<string, string> = {
  벌금:  "bg-red-500/20 text-red-300 border-red-500/30",
  찬조금: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  기타:  "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const STATUS_OPTIONS = [
  { value: null,     label: "정상",  color: "bg-gray-700 text-gray-300 border-gray-600" },
  { value: "부상자", label: "부상자", color: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  { value: "취준생", label: "취준생", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  { value: "기타",   label: "기타",  color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
];

const STATUS_BADGE: Record<string, string> = {
  부상자: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  취준생: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  기타:   "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const MIN_MONTH = "2026-01";

function fmt(n: number) { return n.toLocaleString("ko-KR") + "원"; }

function getMonthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return `${y}년 ${mo}월`;
}
function prevM(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}
function nextM(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}
function nowMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── 팀원 설정 패널 ──
function MemberPanel({
  member, defaultAmount, onSave, onClose,
}: {
  member: DueMember;
  defaultAmount: number;
  onSave: (userId: string, status: string | null, amount: string) => Promise<void>;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<string | null>(member.status ?? null);
  const [amount, setAmount] = useState(member.custom_amount !== null ? String(member.custom_amount) : "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(member.user_id, status, amount);
    setSaving(false);
  };

  const isDefault = status === null && amount === "";

  return (
    <div className="mx-4 mb-2 bg-gray-800/80 border border-white/10 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">상태</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => {
              setStatus(opt.value);
              if (opt.value === null) setAmount("");
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              status === opt.value
                ? opt.color + " ring-1 ring-white/20"
                : "bg-gray-700/50 text-gray-500 border-white/10 hover:border-white/20"
            }`}
          >
            {opt.label}{status === opt.value && " ✓"}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1.5">
        개인 회비
        <span className="ml-1 text-gray-600 normal-case">(비워두면 기본 {fmt(defaultAmount)} 적용)</span>
      </p>
      <div className="relative mb-3">
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder={String(defaultAmount)}
          className="w-full bg-gray-700 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 pr-8"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
      </div>

      <div className="flex gap-2">
        {!isDefault && (
          <button onClick={() => { setStatus(null); setAmount(""); }}
            className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-red-400 border border-white/10 transition-colors">
            초기화
          </button>
        )}
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold transition-colors">
          {saving ? "저장 중..." : "저장"}
        </button>
        <button onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-white border border-white/10 transition-colors">
          취소
        </button>
      </div>
    </div>
  );
}

// ── 메인 페이지 ──
export default function DuesPage() {
  const [month, setMonth] = useState(nowMonth);
  const [defaultAmount, setDefaultAmount] = useState(0);
  const [members, setMembers] = useState<DueMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [summary, setSummary] = useState<Summary>({ initial_balance: 0, total_collected: 0, total_income: 0, total_expenses: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [activeTab, setActiveTab] = useState<"payments" | "expenses" | "balance">("payments");

  // 기본 회비 설정
  const [editingDefault, setEditingDefault] = useState(false);
  const [defaultInput, setDefaultInput] = useState("");
  const [defaultSaving, setDefaultSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // 초기 잔액 설정
  const [editingInitial, setEditingInitial] = useState(false);
  const [initialInput, setInitialInput] = useState("");
  const [initialSaving, setInitialSaving] = useState(false);

  // 멤버 설정 패널
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  // 일괄 납부 선택
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPaying, setBulkPaying] = useState(false);

  // 지출 모달
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expForm, setExpForm] = useState({ title: "", amount: "", category: "기타", used_at: "", memo: "" });
  const [expSaving, setExpSaving] = useState(false);

  // 기타 수입 모달
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [incForm, setIncForm] = useState({ title: "", amount: "", category: "기타", received_at: "", memo: "" });
  const [incSaving, setIncSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/dues/monthly?month=${month}`);
    if (res.ok) {
      const d = await res.json();
      setDefaultAmount(d.default_amount ?? 0);
      setMembers(d.members ?? []);
      setExpenses(d.expenses ?? []);
      setIncome(d.income ?? []);
      setSummary(d.summary ?? { initial_balance: 0, total_collected: 0, total_income: 0, total_expenses: 0, balance: 0 });
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/user/profile").then(r => r.json())
      .then(d => { if (d.role === "owner" || d.role === "treasurer") setCanManage(true); })
      .catch(() => {});
  }, []);

  // 기본 회비 초기화
  const resetDues = async () => {
    setResetting(true);
    await fetch("/api/dues/reset", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    setResetting(false);
    setShowResetConfirm(false);
    load();
  };

  // 기본 회비 저장
  const saveDefault = async () => {
    if (!defaultInput) return;
    setDefaultSaving(true);
    const res = await fetch("/api/dues/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ default_amount: parseInt(defaultInput, 10) }),
    });
    setDefaultSaving(false);
    if (res.ok) { setEditingDefault(false); load(); }
  };

  // 초기 잔액 저장
  const saveInitial = async () => {
    if (initialInput === "") return;
    setInitialSaving(true);
    const res = await fetch("/api/dues/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initial_balance: parseInt(initialInput, 10) }),
    });
    setInitialSaving(false);
    if (res.ok) { setEditingInitial(false); load(); }
  };

  // 납부 처리
  const handlePay = async (userId: string, cancel = false) => {
    const res = await fetch("/api/dues/pay", {
      method: cancel ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, user_id: userId }),
    });
    if (res.ok) load();
  };

  // 일괄 납부 처리
  const handleBulkPay = async () => {
    if (selected.size === 0) return;
    setBulkPaying(true);
    await Promise.all(
      [...selected].map(uid =>
        fetch("/api/dues/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, user_id: uid }),
        })
      )
    );
    setBulkPaying(false);
    setSelected(new Set());
    setSelectMode(false);
    load();
  };

  const toggleSelect = (uid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  // 팀원 설정 저장 (영구)
  const saveMemberSettings = async (userId: string, status: string | null, amountStr: string) => {
    const custom_amount = amountStr === "" ? null : parseInt(amountStr, 10);
    await fetch("/api/dues/member-settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, status, custom_amount }),
    });
    setOpenPanel(null);
    load();
  };

  // 지출 추가
  const createExpense = async () => {
    if (!expForm.title || !expForm.amount || !expForm.used_at) return;
    setExpSaving(true);
    const res = await fetch("/api/dues/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: expForm.title, amount: parseInt(expForm.amount, 10),
        category: expForm.category, used_at: expForm.used_at, memo: expForm.memo || null,
      }),
    });
    setExpSaving(false);
    if (res.ok) { setShowExpenseModal(false); setExpForm({ title: "", amount: "", category: "기타", used_at: "", memo: "" }); load(); }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("지출 내역을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/dues/expenses/${id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  // 기타 수입 추가
  const createIncome = async () => {
    if (!incForm.title || !incForm.amount || !incForm.received_at) return;
    setIncSaving(true);
    const res = await fetch("/api/dues/income", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: incForm.title, amount: parseInt(incForm.amount, 10),
        category: incForm.category, received_at: incForm.received_at, memo: incForm.memo || null,
      }),
    });
    setIncSaving(false);
    if (res.ok) {
      setShowIncomeModal(false);
      setIncForm({ title: "", amount: "", category: "기타", received_at: "", memo: "" });
      load();
    }
  };

  const deleteIncome = async (id: string) => {
    if (!confirm("수입 내역을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/dues/income/${id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  const paid = members.filter(m => m.paid);
  const unpaid = members.filter(m => !m.paid);
  const monthCollected = paid.reduce((s, m) => s + (m.payment_amount ?? 0), 0);
  const paidRate = members.length > 0 ? (paid.length / members.length) * 100 : 0;

  // 멤버 행 렌더
  const renderRow = (m: DueMember, isLast: boolean) => {
    const isOpen = openPanel === m.user_id;
    const isChecked = selected.has(m.user_id);

    return (
      <div key={m.user_id}>
        <div
          className={`flex items-center gap-2 px-4 py-3 transition-colors ${!isLast && !isOpen ? "border-b border-white/[0.03]" : ""} ${
            selectMode && !m.paid ? "cursor-pointer active:bg-white/5" : ""
          } ${isChecked ? "bg-emerald-500/5" : ""}`}
          onClick={() => { if (selectMode && !m.paid) toggleSelect(m.user_id); }}
        >
          {/* 선택 모드: 체크박스 / 일반 모드: 납부 아이콘 */}
          {selectMode ? (
            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
              m.paid
                ? "border-emerald-500/30 text-emerald-500/40"
                : isChecked
                  ? "border-emerald-400 bg-emerald-400"
                  : "border-gray-600"
            }`}>
              {m.paid ? <span className="text-[10px]">✓</span> : isChecked ? <span className="text-[10px] text-gray-900 font-black">✓</span> : null}
            </span>
          ) : (
            <span className={`text-base shrink-0 ${m.paid ? "text-emerald-400" : "text-gray-700"}`}>
              {m.paid ? "✅" : "○"}
            </span>
          )}

          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className={`text-sm font-medium truncate ${m.paid ? "text-white" : selectMode && !m.paid && isChecked ? "text-emerald-300" : "text-gray-400"}`}>
              {m.name}
            </span>
            {m.status && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_BADGE[m.status] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                {m.status}
              </span>
            )}
          </div>

          <span className={`text-sm font-bold shrink-0 ${m.paid ? "text-emerald-400" : "text-gray-500"}`}>
            {fmt(m.paid ? (m.payment_amount ?? m.effective_amount) : m.effective_amount)}
          </span>

          {/* 일반 모드 버튼들 */}
          {!selectMode && canManage && (
            m.paid ? (
              <button onClick={e => { e.stopPropagation(); handlePay(m.user_id, true); }}
                className="text-[10px] text-gray-600 hover:text-red-400 transition-colors px-2 py-1 rounded-lg border border-white/5 shrink-0">
                취소
              </button>
            ) : defaultAmount > 0 || m.custom_amount !== null ? (
              <button onClick={e => { e.stopPropagation(); handlePay(m.user_id); }}
                className="text-[10px] text-emerald-400 font-bold px-2.5 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors shrink-0">
                납부완료
              </button>
            ) : null
          )}

          {!selectMode && canManage && (
            <button onClick={e => { e.stopPropagation(); setOpenPanel(isOpen ? null : m.user_id); }}
              title="상태 및 개인 금액 설정"
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors shrink-0 ${
                isOpen ? "bg-emerald-500/20 text-emerald-400"
                  : (m.status || m.custom_amount !== null)
                    ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                    : "text-gray-600 hover:text-gray-400 hover:bg-white/5"
              }`}>
              ⚙️
            </button>
          )}
        </div>
        {isOpen && canManage && !selectMode && (
          <MemberPanel
            member={m}
            defaultAmount={defaultAmount}
            onSave={saveMemberSettings}
            onClose={() => setOpenPanel(null)}
          />
        )}
      </div>
    );
  };

  return (
    <AppLayout title="💰 회비 관리" helpContent={{ items: [
      { icon: "💵", title: "월별 회비 설정", desc: "상단 설정 버튼으로 월별 회비 금액을 지정해요. 팀원별로 납부 여부를 관리할 수 있어요." },
      { icon: "✅", title: "납부 완료 처리", desc: "각 팀원의 납부 버튼을 눌러 납부 완료로 변경해요. 일괄 납부로 여러 명을 한 번에 처리할 수도 있어요." },
      { icon: "☑️", title: "일괄 납부", desc: "☑ 일괄 납부 버튼 → 팀원 선택 → 납부완료 ✓ 버튼으로 여러 명을 한 번에 처리해요." },
      { icon: "💸", title: "기타 수입/지출", desc: "수입·지출 탭에서 벌금·찬조금 등 기타 수입과 지출을 기록할 수 있어요." },
      { icon: "📊", title: "잔액 현황", desc: "잔액 탭에서 총 수납·기타 수입·지출·잔액을 한눈에 볼 수 있어요." },
    ]}}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* 기본 회비 설정 카드 */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">기본 회비</p>
              <p className="text-[10px] text-gray-600 mt-0.5">한 번 설정하면 매달 자동 적용</p>
            </div>
            {canManage && !editingDefault && (
              <div className="flex items-center gap-3">
                <button onClick={() => { setDefaultInput(String(defaultAmount || "")); setEditingDefault(true); }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">
                  {defaultAmount > 0 ? "수정" : "설정하기"}
                </button>
                {defaultAmount > 0 && (
                  <button onClick={() => setShowResetConfirm(true)}
                    className="text-xs text-red-400 hover:text-red-300 font-semibold">
                    초기화
                  </button>
                )}
              </div>
            )}
          </div>
          {editingDefault ? (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input type="number" value={defaultInput} onChange={e => setDefaultInput(e.target.value)}
                    placeholder="20000" autoFocus
                    className="w-full bg-gray-800 border border-emerald-500/40 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
                </div>
                <button onClick={saveDefault} disabled={defaultSaving || !defaultInput}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-bold whitespace-nowrap">
                  {defaultSaving ? "..." : "저장"}
                </button>
                <button onClick={() => setEditingDefault(false)} className="px-3 py-2.5 text-gray-500 hover:text-white text-sm">취소</button>
              </div>
              <p className="text-[11px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                ⚠️ 변경 시 <span className="font-bold">다음 달부터</span> 적용돼요. 이미 납부 처리된 이번 달은 취소 후 다시 납부해야 새 금액이 반영돼요.
              </p>
            </div>
          ) : (
            <p className={`text-3xl font-black mt-1 ${defaultAmount > 0 ? "text-white" : "text-gray-700"}`}>
              {defaultAmount > 0 ? fmt(defaultAmount) : "미설정"}
            </p>
          )}
        </div>

        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between bg-gray-900 rounded-2xl px-4 py-3 border border-white/5">
          <button onClick={() => setMonth(p => { const pr = prevM(p); return pr < MIN_MONTH ? p : pr; })}
            disabled={month <= MIN_MONTH}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors text-lg">‹</button>
          <div className="text-center">
            <p className="text-base font-black text-white">{getMonthLabel(month)}</p>
            {month === nowMonth() && <p className="text-[10px] text-emerald-400 font-semibold">이번 달</p>}
          </div>
          <button onClick={() => setMonth(p => nextM(p))}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-lg">›</button>
        </div>

        {/* 이달 수금 현황 */}
        {!loading && members.length > 0 && (
          <div className="bg-gray-900 rounded-xl px-4 py-3 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-semibold">{getMonthLabel(month)} 납부 현황</span>
              <span className="text-sm font-bold text-emerald-400">{paid.length}/{members.length}명 · {fmt(monthCollected)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${paidRate}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 shrink-0">{Math.round(paidRate)}%</span>
            </div>
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-white/5">
          {([
            { key: "payments", label: "💳 납부 현황" },
            { key: "expenses", label: "📋 수입·지출" },
            { key: "balance",  label: "💵 잔액 현황" },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.key ? "bg-emerald-500 text-white shadow" : "text-gray-500 hover:text-white"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <div className="text-center py-16 text-gray-600 text-sm">불러오는 중...</div>}

        {/* ── 납부 현황 탭 ── */}
        {!loading && activeTab === "payments" && (
          <div className="space-y-3">
            {/* 일괄 선택 모드 진입/취소 버튼 */}
            {canManage && unpaid.length > 0 && (
              <div className="flex items-center justify-between">
                {selectMode ? (
                  <>
                    <button
                      onClick={() => {
                        const unpaidIds = unpaid.map(m => m.user_id);
                        const allSelected = unpaidIds.every(id => selected.has(id));
                        if (allSelected) setSelected(new Set());
                        else setSelected(new Set(unpaidIds));
                      }}
                      className="text-xs text-gray-400 hover:text-white font-semibold px-3 py-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
                    >
                      {unpaid.every(m => selected.has(m.user_id)) ? "전체 해제" : `전체 선택 (${unpaid.length}명)`}
                    </button>
                    <button onClick={exitSelectMode}
                      className="text-xs text-gray-500 hover:text-white font-semibold px-3 py-2 rounded-xl border border-white/10 transition-colors">
                      취소
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setSelectMode(true); setOpenPanel(null); }}
                    className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 font-semibold px-3 py-2 rounded-xl border border-emerald-500/30 hover:bg-emerald-500/5 transition-colors">
                    ☑ 일괄 납부
                  </button>
                )}
              </div>
            )}

          <div className="bg-gray-900 rounded-2xl border border-white/5 overflow-hidden">
            {members.length === 0 ? (
              <div className="text-center py-12 text-gray-600 text-sm"><p className="text-2xl mb-2">👥</p><p>팀원이 없어요</p></div>
            ) : (
              <>
                {paid.length > 0 && (
                  <div>
                    <div className="px-4 pt-4 pb-2">
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">납부 완료 · {paid.length}명</p>
                    </div>
                    {paid.map((m, i) => renderRow(m, i === paid.length - 1 && unpaid.length === 0))}
                  </div>
                )}
                {paid.length > 0 && unpaid.length > 0 && <div className="border-t border-white/5" />}
                {unpaid.length > 0 && (
                  <div>
                    <div className="px-4 pt-4 pb-2">
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">미납 · {unpaid.length}명</p>
                    </div>
                    {unpaid.map((m, i) => renderRow(m, i === unpaid.length - 1))}
                  </div>
                )}
                {/* 상태별 현황 요약 */}
                {members.some(m => m.status) && (
                  <div className="px-4 py-3 border-t border-white/5 flex flex-wrap gap-2">
                    {STATUS_OPTIONS.filter(o => o.value && members.some(m => m.status === o.value)).map(opt => {
                      const cnt = members.filter(m => m.status === opt.value).length;
                      return (
                        <span key={String(opt.value)} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${opt.color}`}>
                          {opt.label} {cnt}명
                        </span>
                      );
                    })}
                  </div>
                )}
                {/* 기본 회비 미설정 안내 */}
                {canManage && defaultAmount === 0 && (
                  <div className="px-4 py-3 border-t border-white/5 text-center">
                    <p className="text-xs text-gray-600">기본 회비를 먼저 설정하면 납부 체크가 가능해요</p>
                    <button onClick={() => { setActiveTab("payments"); setEditingDefault(true); setDefaultInput(""); }}
                      className="mt-1 text-xs text-emerald-400 font-semibold">지금 설정하기 →</button>
                  </div>
                )}
              </>
            )}
          </div>
          </div>
        )}

        {/* ── 수입·지출 탭 ── */}
        {!loading && activeTab === "expenses" && (
          <div className="space-y-3">
            {/* 추가 버튼 */}
            {canManage && (
              <div className="flex gap-2">
                <button onClick={() => setShowIncomeModal(true)}
                  className="flex-1 py-3 rounded-xl border border-dashed border-emerald-500/40 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/5 transition-colors">
                  + 기타 수입
                </button>
                <button onClick={() => setShowExpenseModal(true)}
                  className="flex-1 py-3 rounded-xl border border-dashed border-red-500/40 text-red-400 text-sm font-semibold hover:bg-red-500/5 transition-colors">
                  + 지출 추가
                </button>
              </div>
            )}

            {/* 요약 */}
            {(income.length > 0 || expenses.length > 0) && (
              <div className="bg-gray-900 rounded-xl px-4 py-3 border border-white/5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-gray-500">기타 수입</span>
                  <span className="text-sm font-bold text-emerald-400">+{fmt(summary.total_income)}</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs text-gray-500">지출</span>
                  <span className="text-sm font-bold text-red-400">-{fmt(summary.total_expenses)}</span>
                </div>
              </div>
            )}

            {/* 기타 수입 목록 */}
            {income.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold px-1 mb-1.5">기타 수입</p>
                <div className="bg-gray-900 rounded-2xl border border-white/5 overflow-hidden">
                  {income.map((inc, i) => (
                    <div key={inc.id} className={`flex items-start gap-3 px-4 py-3.5 ${i < income.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${INCOME_CATEGORY_COLORS[inc.category] ?? INCOME_CATEGORY_COLORS["기타"]}`}>
                            {inc.category}
                          </span>
                          <span className="text-[10px] text-gray-600">
                            {new Date(inc.received_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white">{inc.title}</p>
                        {inc.memo && <p className="text-xs text-gray-500 mt-0.5">{inc.memo}</p>}
                        {inc.created_by_name && <p className="text-[10px] text-gray-600 mt-1">👤 {inc.created_by_name}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black text-emerald-400">+{fmt(inc.amount)}</span>
                        {canManage && (
                          <button onClick={() => deleteIncome(inc.id)} className="text-gray-700 hover:text-red-400 transition-colors text-sm">🗑️</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 지출 목록 */}
            {expenses.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold px-1 mb-1.5">지출</p>
                <div className="bg-gray-900 rounded-2xl border border-white/5 overflow-hidden">
                  {expenses.map((exp, i) => (
                    <div key={exp.id} className={`flex items-start gap-3 px-4 py-3.5 ${i < expenses.length - 1 ? "border-b border-white/[0.03]" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${EXPENSE_CATEGORY_COLORS[exp.category] ?? EXPENSE_CATEGORY_COLORS["기타"]}`}>
                            {exp.category}
                          </span>
                          <span className="text-[10px] text-gray-600">
                            {new Date(exp.used_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white">{exp.title}</p>
                        {exp.memo && <p className="text-xs text-gray-500 mt-0.5">{exp.memo}</p>}
                        {exp.created_by_name && <p className="text-[10px] text-gray-600 mt-1">👤 {exp.created_by_name}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black text-red-400">-{fmt(exp.amount)}</span>
                        {canManage && (
                          <button onClick={() => deleteExpense(exp.id)} className="text-gray-700 hover:text-red-400 transition-colors text-sm">🗑️</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {income.length === 0 && expenses.length === 0 && (
              <div className="text-center py-16 text-gray-600 text-sm"><p className="text-3xl mb-2">📋</p><p>아직 내역이 없어요</p></div>
            )}
          </div>
        )}

        {/* ── 잔액 현황 탭 ── */}
        {!loading && activeTab === "balance" && (
          <div className="space-y-3">
            <div className="bg-gray-900 rounded-2xl p-5 border border-white/5">
              <p className="text-xs text-gray-500 mb-1">현재 잔액</p>
              <p className={`text-4xl font-black mb-4 ${summary.balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(summary.balance)}</p>
              <div>
                <div className="flex items-center justify-between py-3 border-t border-white/5">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-teal-400 shrink-0" /><span className="text-sm text-gray-400">초기 보유 금액</span></div>
                  <span className="text-sm font-bold text-teal-400">+{fmt(summary.initial_balance)}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-white/5">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" /><span className="text-sm text-gray-400">회비 납부 합계</span></div>
                  <span className="text-sm font-bold text-emerald-400">+{fmt(summary.total_collected)}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-white/5">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0" /><span className="text-sm text-gray-400">기타 수입 (벌금·찬조금 등)</span></div>
                  <span className="text-sm font-bold text-green-400">+{fmt(summary.total_income)}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-white/5">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" /><span className="text-sm text-gray-400">총 지출</span></div>
                  <span className="text-sm font-bold text-red-400">-{fmt(summary.total_expenses)}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-white/5">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-white/30 shrink-0" /><span className="text-sm text-white font-semibold">잔액</span></div>
                  <span className={`text-sm font-black ${summary.balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(summary.balance)}</span>
                </div>
              </div>
            </div>

            {canManage && (
              <div className="bg-gray-900 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-white">초기 보유 금액</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">앱 사용 전 이미 있던 회비</p>
                  </div>
                  {!editingInitial && (
                    <button onClick={() => { setInitialInput(String(summary.initial_balance)); setEditingInitial(true); }}
                      className="text-xs text-teal-400 hover:text-teal-300 font-semibold">수정</button>
                  )}
                </div>
                {editingInitial ? (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="relative flex-1">
                      <input type="number" value={initialInput} onChange={e => setInitialInput(e.target.value)}
                        placeholder="0" autoFocus
                        className="w-full bg-gray-800 border border-teal-500/40 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none pr-8" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
                    </div>
                    <button onClick={saveInitial} disabled={initialSaving || initialInput === ""}
                      className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white text-sm font-bold whitespace-nowrap">
                      {initialSaving ? "..." : "저장"}
                    </button>
                    <button onClick={() => setEditingInitial(false)} className="px-3 py-2.5 text-gray-500 hover:text-white text-sm">취소</button>
                  </div>
                ) : (
                  <p className="text-2xl font-black text-teal-400 mt-1">{fmt(summary.initial_balance)}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 일괄 납부 하단 바 */}
      {selectMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-3 bg-gradient-to-t from-gray-950 via-gray-950/95 to-transparent pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
            <div className="flex items-center gap-3 bg-gray-900 border border-white/10 rounded-2xl px-4 py-3 shadow-2xl">
              <div className="flex-1">
                {selected.size === 0 ? (
                  <p className="text-sm text-gray-500">미납자를 선택하세요</p>
                ) : (
                  <>
                    <p className="text-sm font-bold text-white">{selected.size}명 선택됨</p>
                    <p className="text-xs text-emerald-400">
                      {fmt([...selected].reduce((s, uid) => {
                        const m = members.find(x => x.user_id === uid);
                        return s + (m?.effective_amount ?? 0);
                      }, 0))} 납부 처리
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={handleBulkPay}
                disabled={selected.size === 0 || bulkPaying}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-black transition-colors whitespace-nowrap"
              >
                {bulkPaying ? "처리 중..." : `납부완료 ✓`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기타 수입 추가 모달 */}
      {showIncomeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h2 className="text-base font-bold text-white">기타 수입 추가</h2>
              <button onClick={() => setShowIncomeModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-semibold mb-1.5 block">항목명 *</label>
                <input value={incForm.title} onChange={e => setIncForm({ ...incForm, title: e.target.value })}
                  placeholder="예: 지각 벌금, 홍길동 찬조금"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 font-semibold mb-1.5 block">금액 *</label>
                  <div className="relative">
                    <input type="number" value={incForm.amount} onChange={e => setIncForm({ ...incForm, amount: e.target.value })}
                      placeholder="10000"
                      className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 font-semibold mb-1.5 block">날짜 *</label>
                  <input type="date" value={incForm.received_at} onChange={e => setIncForm({ ...incForm, received_at: e.target.value })}
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold mb-1.5 block">카테고리</label>
                <div className="flex gap-2">
                  {["벌금", "찬조금", "기타"].map(cat => (
                    <button key={cat} onClick={() => setIncForm({ ...incForm, category: cat })}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        incForm.category === cat
                          ? INCOME_CATEGORY_COLORS[cat]
                          : "bg-gray-800 text-gray-500 border-white/10 hover:border-white/20"
                      }`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold mb-1.5 block">메모 (선택)</label>
                <input value={incForm.memo} onChange={e => setIncForm({ ...incForm, memo: e.target.value })}
                  placeholder="추가 설명"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <button onClick={createIncome} disabled={incSaving || !incForm.title || !incForm.amount || !incForm.received_at}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-bold transition-colors">
                {incSaving ? "저장 중..." : "수입 내역 추가"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 지출 추가 모달 */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h2 className="text-base font-bold text-white">지출 내역 추가</h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-semibold mb-1.5 block">항목명 *</label>
                <input value={expForm.title} onChange={e => setExpForm({ ...expForm, title: e.target.value })}
                  placeholder="예: 경기장 대여"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 font-semibold mb-1.5 block">금액 *</label>
                  <div className="relative">
                    <input type="number" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })}
                      placeholder="50000"
                      className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">원</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 font-semibold mb-1.5 block">날짜 *</label>
                  <input type="date" value={expForm.used_at} onChange={e => setExpForm({ ...expForm, used_at: e.target.value })}
                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold mb-1.5 block">카테고리</label>
                <div className="flex flex-wrap gap-2">
                  {["장비", "간식/식비", "경기장", "유니폼", "대회", "기타"].map(cat => (
                    <button key={cat} onClick={() => setExpForm({ ...expForm, category: cat })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        expForm.category === cat ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-gray-800 text-gray-500 border-white/10 hover:border-white/20"}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold mb-1.5 block">메모 (선택)</label>
                <input value={expForm.memo} onChange={e => setExpForm({ ...expForm, memo: e.target.value })}
                  placeholder="추가 설명"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <button onClick={createExpense} disabled={expSaving || !expForm.title || !expForm.amount || !expForm.used_at}
                className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-bold transition-colors">
                {expSaving ? "저장 중..." : "지출 내역 추가"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 초기화 확인 모달 */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="text-center">
              <p className="text-4xl mb-3">⚠️</p>
              <h3 className="font-bold text-white text-lg mb-1">회비 초기화</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                기본 회비가 <span className="text-white font-bold">0원</span>으로 초기화되고,<br />
                <span className="text-red-400 font-bold">{month}</span> 납부 기록이 <span className="text-red-400 font-bold">전체 삭제</span>돼요.<br />
                <span className="text-gray-500 text-xs mt-1 block">이 작업은 되돌릴 수 없어요.</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/5 transition-colors">
                취소
              </button>
              <button onClick={resetDues} disabled={resetting}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition-colors disabled:opacity-50">
                {resetting ? "초기화 중..." : "초기화"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
