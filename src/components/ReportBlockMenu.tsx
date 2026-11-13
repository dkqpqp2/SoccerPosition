"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";

type Target = "gallery_photo" | "vote_comment";

const REASONS = ["욕설·비하", "음란·부적절한 내용", "스팸·광고", "기타"] as const;

/** 사진·댓글 옆의 "신고" 버튼. 누르면 신고 또는 작성자 차단을 고를 수 있다. 처리 후 onDone으로 목록을 다시 불러오게 한다. */
export default function ReportBlockMenu({
  targetType,
  targetId,
  onDone,
  className = "",
}: {
  targetType: Target;
  targetId: string;
  onDone: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  async function send(url: string, body: Record<string, string>, doneText: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "처리하지 못했어요. 잠시 후 다시 시도해 주세요."); return; }
      setMessage(doneText);
      setDone(true);
    } catch {
      setError("처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  // 처리가 끝난 뒤 창을 닫을 때 목록을 새로 불러온다 (그 전에 불러오면 완료 안내가 사라진다)
  function close() {
    setOpen(false);
    setMessage("");
    setError("");
    if (done) { setDone(false); onDone(); }
  }

  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        aria-label="신고 또는 차단"
        className={`inline-flex items-center gap-1 text-gray-600 hover:text-gray-300 transition-colors ${className}`}
      >
        <Flag size={11} /> <span>신고</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center" onClick={e => { e.stopPropagation(); close(); }}>
          <div className="bg-gray-900 border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-bold text-sm">{message ? "처리했어요" : "신고 · 차단"}</p>
              <button onClick={close} aria-label="닫기" className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>

            {message ? (
              <>
                <p className="text-sm text-gray-300 leading-relaxed mb-4">{message}</p>
                <button onClick={close} className="w-full bg-gray-800 text-gray-200 font-medium py-2.5 rounded-xl text-sm">확인</button>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">신고 사유를 고르면 바로 접수돼요. 신고한 내용은 내 화면에서 바로 사라져요.</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {REASONS.map(r => (
                    <button
                      key={r}
                      disabled={busy}
                      onClick={() => send("/api/reports", { reason: r }, "신고가 접수됐어요. 운영자가 확인 후 조치할게요.")}
                      className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-white/10 text-gray-200 py-2.5 rounded-xl text-xs font-medium transition-colors"
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button
                  disabled={busy}
                  onClick={() => send("/api/blocks", {}, "이 사용자를 차단했어요. 이 사용자의 사진과 댓글이 보이지 않아요. 마이페이지에서 해제할 수 있어요.")}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 border border-red-500/30 text-red-300 py-2.5 rounded-xl text-sm font-bold transition-colors"
                >
                  이 사용자 차단하기
                </button>
                {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
