"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, X } from "lucide-react";
import { useAiConsent } from "@/components/AiConsent";
import { matchDeposits, type Deposit, type MatchMember, type MatchResult } from "@/lib/duesPhotoMatch";

export interface PhotoCheckMember extends MatchMember {
  user_id: string | null;
}

const MAX_IMAGES = 6;
const MAX_SIDE = 1568; // AI가 읽는 최대 크기 — 이보다 크면 어차피 줄여서 읽는다

interface Shot { id: number; url: string }

const fmt = (n: number) => `${n.toLocaleString()}원`;

/** 사진을 긴 변 1568px 이하 JPEG로 줄여 data URL로 만든다 (요청 용량·AI 읽기 한도에 맞춤) */
async function fileToDataUrl(file: Blob): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image load failed"));
      el.src = src;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(src);
  }
}

export default function DuesPhotoCheckModal({
  month,
  members,
  onClose,
  onApplied,
}: {
  month: string; // "2026-11"
  members: PhotoCheckMember[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const monthNum = Number(month.split("-")[1]);
  const { ensureAccepted, consentModal } = useAiConsent();
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState<"read" | "apply" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [readCount, setReadCount] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const nextId = useRef(1);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: Blob[]) => {
    setError("");
    const images = files.filter(f => f.type.startsWith("image/"));
    if (images.length === 0) return;
    const room = MAX_IMAGES - shotsRef.current.length;
    if (room <= 0) { setError(`사진은 ${MAX_IMAGES}장까지 올릴 수 있어요.`); return; }
    try {
      const urls = await Promise.all(images.slice(0, room).map(fileToDataUrl));
      setShots(prev => [...prev, ...urls.map(url => ({ id: nextId.current++, url }))].slice(0, MAX_IMAGES));
      if (images.length > room) setError(`사진은 ${MAX_IMAGES}장까지만 담겼어요.`);
    } catch {
      setError("사진을 열지 못했어요. 다른 사진으로 시도해 주세요.");
    }
  }, []);

  // 최신 장수를 붙여넣기 핸들러에서도 쓰기 위한 ref
  const shotsRef = useRef<Shot[]>([]);
  shotsRef.current = shots;

  // 화면 어디서든 Ctrl+V / 길게 눌러 붙여넣기로 사진 추가
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.some(f => f.type.startsWith("image/"))) {
        e.preventDefault();
        addFiles(files);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addFiles]);

  async function analyze() {
    if (shots.length === 0 || busy) return;
    if (!(await ensureAccepted())) return;
    setBusy("read");
    setError("");
    try {
      const res = await fetch("/api/dues/photo-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: shots.map(s => s.url) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "사진을 읽지 못했어요."); return; }
      const deposits: Deposit[] = Array.isArray(data.transactions) ? data.transactions : [];
      const r = matchDeposits(deposits, members, monthNum);
      setReadCount(deposits.length);
      setResult(r);
      setChecked(new Set(r.matches.filter(m => m.suggestChecked).map(m => m.member_id)));
    } catch {
      setError("네트워크 오류가 났어요. 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!result || checked.size === 0 || busy) return;
    setBusy("apply");
    setError("");
    const ids = [...checked];
    const post = async (memberId: string) => {
      const m = members.find(x => x.member_id === memberId);
      if (!m) return false;
      const body = m.user_id ? { month, user_id: m.user_id } : { month, user_id: m.member_id, is_manual: true };
      try {
        const res = await fetch("/api/dues/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        return res.ok;
      } catch {
        return false;
      }
    };
    // 그 달 회비 항목이 처음 만들어지는 경우를 피하려고 첫 건을 먼저 처리한 뒤 나머지를 한꺼번에 처리한다
    const first = await post(ids[0]);
    const rest = await Promise.all(ids.slice(1).map(post));
    const failed = [first, ...rest].filter(ok => !ok).length;
    setBusy(null);
    if (failed > 0) {
      setError(`${ids.length - failed}명은 처리했고 ${failed}명은 실패했어요. 화면을 새로고침해서 확인해 주세요.`);
      onApplied();
      return;
    }
    onApplied();
    onClose();
  }

  const toggle = (id: string) =>
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const selectable = result?.matches.filter(m => !m.alreadyPaid) ?? [];
  const alreadyPaid = result?.matches.filter(m => m.alreadyPaid) ?? [];
  const dateOf = (d: Deposit) => (d.month ? `${d.month}/${d.day ?? "?"}` : "");

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="입금 내역 사진으로 회비 확인"
        className="bg-gray-900 border border-white/10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <h2 className="text-base font-black text-white flex items-center gap-2"><Camera size={16} /> 입금 내역으로 회비 확인</h2>
          <button onClick={onClose} aria-label="닫기" className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
        </div>

        <div className="px-4 pb-4 overflow-y-auto space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            {monthNum}월 회비 기준이에요. 통장 입금 내역 화면을 캡처해서 올리면, 입금자 이름과 금액을 팀원·설정한 회비와 비교해 줘요. 사진은 저장하지 않아요.
          </p>

          {!result && (
            <>
              <div
                className="border border-dashed border-white/15 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-500/40 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus size={24} className="mx-auto mb-1.5 text-gray-500" />
                <p className="text-sm text-gray-300 font-medium">사진 선택 또는 붙여넣기 (Ctrl+V)</p>
                <p className="text-[11px] text-gray-600 mt-1">한 화면에 다 안 담기면 나눠서 여러 장(최대 {MAX_IMAGES}장) 올려도 돼요. 겹치는 줄은 한 번만 세요.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => { addFiles([...(e.target.files ?? [])]); e.target.value = ""; }}
                />
              </div>

              {shots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {shots.map(s => (
                    <div key={s.id} className="relative w-16 h-24 rounded-lg overflow-hidden border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.url} alt="올린 입금 내역 사진" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setShots(prev => prev.filter(x => x.id !== s.id))}
                        aria-label="사진 지우기"
                        className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full p-0.5"
                      ><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={analyze}
                disabled={shots.length === 0 || busy !== null}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-sm font-bold"
              >
                {busy === "read" ? "사진 읽는 중… (몇 초 걸려요)" : "AI로 읽어서 비교하기"}
              </button>
            </>
          )}

          {result && (
            <>
              <p className="text-xs text-gray-400">
                사진에서 {readCount}건을 읽었어요. <span className="text-amber-400">읽기 실수가 있을 수 있으니 확인하고 처리하세요.</span>
              </p>

              {selectable.length > 0 && (
                <section>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-1.5">입금 확인 · {selectable.length}명</p>
                  <div className="bg-gray-950/60 rounded-xl border border-white/5 divide-y divide-white/5">
                    {selectable.map(m => (
                      <label key={m.member_id} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer">
                        <input type="checkbox" checked={checked.has(m.member_id)} onChange={() => toggle(m.member_id)} className="mt-1 accent-emerald-500" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold text-white">{m.name}</span>
                            {m.amountResult === "ok" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">금액 일치</span>}
                            {m.amountResult === "over" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">+{fmt(m.total - m.expected)} 더 냄</span>}
                            {m.amountResult === "short" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-300">{fmt(m.expected - m.total)} 부족</span>}
                            {m.amountResult === "no_expected" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-300">설정 금액 없음</span>}
                            {m.nameMatch === "similar" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">이름이 비슷해요</span>}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            입금 {fmt(m.total)} / 설정 {m.expected > 0 ? fmt(m.expected) : "-"} · {m.deposits.map(d => `${d.name}${dateOf(d) ? ` (${dateOf(d)})` : ""}`).join(", ")}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5">납부 처리하면 그 사람의 설정 금액으로 기록돼요. 금액이 안 맞는 사람은 처음엔 체크가 꺼져 있어요.</p>
                </section>
              )}

              {alreadyPaid.length > 0 && (
                <section>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-1">이미 납부 처리됨 · {alreadyPaid.length}명</p>
                  <p className="text-xs text-gray-500">{alreadyPaid.map(m => m.name).join(", ")}</p>
                </section>
              )}

              {result.unmatched.length > 0 && (
                <section>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-1">누구인지 못 찾은 입금 · {result.unmatched.length}건</p>
                  <ul className="text-xs text-gray-400 space-y-0.5">
                    {result.unmatched.map((d, i) => <li key={i}>{d.name} · {fmt(d.amount)}{dateOf(d) ? ` · ${dateOf(d)}` : ""}</li>)}
                  </ul>
                  <p className="text-[10px] text-gray-600 mt-1">이름이 팀원과 다르거나 같은 이름이 여러 명이에요. 필요하면 납부 현황에서 직접 체크해 주세요.</p>
                </section>
              )}

              {result.noDeposit.length > 0 && (
                <section>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-1">입금이 안 보이는 팀원 · {result.noDeposit.length}명</p>
                  <p className="text-xs text-gray-500">{result.noDeposit.map(m => m.name).join(", ")}</p>
                </section>
              )}

              {(result.otherMonth.length > 0 || result.skipped > 0) && (
                <p className="text-[11px] text-gray-600">
                  {result.otherMonth.length > 0 && `${monthNum}월이 아닌 입금 ${result.otherMonth.length}건은 뺐어요. `}
                  {result.skipped > 0 && `출금이거나 구분이 안 되는 ${result.skipped}건도 뺐어요.`}
                </p>
              )}

              {result.matches.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-3">팀원과 맞는 입금을 찾지 못했어요. 사진이 선명한지, {monthNum}월 내역인지 확인해 주세요.</p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => { setResult(null); setChecked(new Set()); }} className="px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium">다시 올리기</button>
                <button
                  onClick={apply}
                  disabled={checked.size === 0 || busy !== null}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-sm font-bold flex items-center justify-center gap-1.5"
                >
                  <Check size={15} strokeWidth={2.5} /> {busy === "apply" ? "처리 중…" : `선택한 ${checked.size}명 납부 처리`}
                </button>
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
      {consentModal}
    </div>
  );
}
