"use client";

import { useState } from "react";
import Link from "next/link";
import type { LoungeInfo, LoungeInfoStatus } from "./useLoungeInfo";

export const MAX_RULES_LENGTH = 3000;

// 이 창 위의 터치·휠이 뒤의 3D 카메라 확대/축소로 번지지 않게 막는다
const shield = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onWheel: (e: React.WheelEvent) => e.stopPropagation(),
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 회비 잔액 판을 탭했을 때 뜨는 창 */
export function BalanceModal({
  balance,
  status,
  onClose,
}: {
  balance: number | null;
  status: LoungeInfoStatus;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 bg-black/65 flex items-center justify-center px-5" {...shield}>
      <div role="dialog" aria-modal="true" aria-label="팀 회비 잔액" className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-base">💰 팀 회비 잔액</h2>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-full bg-white/10 text-white text-sm font-bold">✕</button>
        </div>
        <div className="text-center py-6">
          {balance !== null ? (
            <p className={`text-4xl font-black ${balance < 0 ? "text-red-300" : "text-emerald-300"}`}>{balance.toLocaleString()}원</p>
          ) : (
            <p className="text-gray-400 text-sm">{status === "loading" ? "불러오는 중…" : "잔액을 불러오지 못했어요"}</p>
          )}
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed mb-4">
          초기 잔액 + 모인 회비 + 기타 수입 − 지출을 합친 금액이에요. 팀원 누구나 볼 수 있어요.
        </p>
        <Link href="/dues" className="block w-full text-center bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl text-sm">
          수입·지출 내역 보러 가기
        </Link>
      </div>
    </div>
  );
}

/** 게시판(팀 규칙)을 탭했을 때 뜨는 창. 관리자급이면 수정할 수 있다 */
export function RulesModal({
  info,
  status,
  canEdit,
  onSave,
  onClose,
}: {
  info: LoungeInfo | null;
  status: LoungeInfoStatus;
  canEdit: boolean;
  onSave: (content: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const rules = info?.rules ?? null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setDraft(rules?.content ?? "");
    setError("");
    setEditing(true);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    const err = await onSave(draft);
    setSaving(false);
    if (err) { setError(err); return; }
    setEditing(false);
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/65 flex items-center justify-center px-5" {...shield}>
      <div role="dialog" aria-modal="true" aria-label="팀 규칙" className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm max-h-[85%] flex flex-col">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="text-white font-black text-base">📜 팀 규칙</h2>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-full bg-white/10 text-white text-sm font-bold">✕</button>
        </div>

        {!editing && (
          <>
            <div className="overflow-y-auto min-h-[120px]">
              {status === "loading" && !info && <p className="text-gray-400 text-sm text-center py-12">불러오는 중…</p>}
              {status === "error" && !info && <p className="text-gray-400 text-sm text-center py-12">규칙을 불러오지 못했어요</p>}
              {info && info.rulesUnavailable && <p className="text-gray-400 text-sm text-center py-12">규칙을 지금은 불러올 수 없어요</p>}
              {info && !info.rulesUnavailable && !rules && (
                <p className="text-gray-400 text-sm text-center py-12 leading-relaxed">
                  아직 등록된 규칙이 없어요{canEdit ? <><br />아래 버튼으로 규칙을 써 주세요</> : null}
                </p>
              )}
              {rules && <p className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap break-words">{rules.content}</p>}
            </div>
            {rules && (rules.updatedAt || rules.updatedByName) && (
              <p className="mt-3 text-[11px] text-gray-500 shrink-0">
                {[rules.updatedByName ? `${rules.updatedByName}님이` : "", formatDate(rules.updatedAt) ? `${formatDate(rules.updatedAt)}에 수정` : ""].filter(Boolean).join(" ")}
              </p>
            )}
            {canEdit && info && !info.rulesUnavailable && (
              <button onClick={startEdit} className="mt-3 w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl text-sm shrink-0">
                {rules ? "규칙 수정하기" : "규칙 쓰기"}
              </button>
            )}
          </>
        )}

        {editing && (
          <>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value.slice(0, MAX_RULES_LENGTH))}
              maxLength={MAX_RULES_LENGTH}
              rows={10}
              placeholder={"1. 경기 3일 전까지 참석 체크\n2. 지각·불참은 미리 알리기\n3. 회비는 매달 5일까지"}
              aria-label="팀 규칙 내용"
              className="w-full flex-1 min-h-[200px] bg-gray-800 border border-white/10 rounded-xl p-3 text-base sm:text-sm text-white placeholder-gray-600 outline-none focus:border-emerald-500/50 resize-none"
            />
            <p className="mt-1 text-right text-[11px] text-gray-500 shrink-0">{draft.length} / {MAX_RULES_LENGTH}</p>
            {error && <p className="text-xs text-red-400 mt-1 shrink-0">{error}</p>}
            <div className="flex gap-2 mt-3 shrink-0">
              <button onClick={() => setEditing(false)} disabled={saving} className="flex-1 bg-gray-800 text-gray-300 font-medium py-2.5 rounded-xl text-sm">취소</button>
              <button onClick={() => void save()} disabled={saving} className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black font-bold py-2.5 rounded-xl text-sm">
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
