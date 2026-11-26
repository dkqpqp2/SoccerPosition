"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Sparkles } from "lucide-react";
import { POSITION_MAP } from "@/lib/positions";
import { useAiConsent } from "@/components/AiConsent";

type Guide = {
  content: { play: string; avoid: string; drills: string[]; talk: string };
  delivered_at: string | null;
  updated_at: string;
};

type Row = {
  id: string;
  name: string;
  position_1st: string | null;
  position_2nd: string | null;
  has_input: boolean; // 장점·단점이 하나라도 적혀 있는지
  guide: Guide | null;
  stale: boolean; // 가이드를 만든 뒤 희망 포지션·장점·단점이 바뀜
};

const md = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

function positionLabel(r: Row): string {
  const a = r.position_1st ? POSITION_MAP[r.position_1st]?.label ?? r.position_1st : null;
  const b = r.position_2nd ? POSITION_MAP[r.position_2nd]?.label ?? r.position_2nd : null;
  return [a, b].filter(Boolean).join(" / ") || "포지션 미지정";
}

function guideText(r: Row, g: Guide): string {
  return [
    `[${r.name} · ${positionLabel(r)}]`,
    `✓ 이 자리에서 이렇게: ${g.content.play}`,
    `⚠ 피할 것: ${g.content.avoid}`,
    `🏃 추천 연습:\n${g.content.drills.map((d, i) => `${i + 1}) ${d}`).join("\n")}`,
    `💬 이렇게 말해 주면 좋아요: ${g.content.talk}`,
  ].join("\n");
}

function Badge({ row }: { row: Row }) {
  if (row.guide && row.stale) {
    return (
      <span className="flex flex-col items-end gap-1">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">⚠ 평가가 바뀌었어요</span>
        {row.guide.delivered_at && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">전달 완료 {md(row.guide.delivered_at)}</span>}
      </span>
    );
  }
  if (row.guide?.delivered_at) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">전달 완료 {md(row.guide.delivered_at)}</span>;
  if (row.guide) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400">가이드 있음</span>;
  if (!row.has_input) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-500">장단점 필요</span>;
  return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-400">아직 안 만듦</span>;
}

/** 팀원 관리 → 코칭 탭 (관리자급 전용): 선수별 AI 코칭 가이드를 만들어 저장해 두고, 피드백을 전달했는지 표시한다 */
export default function CoachingTab() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null); // 가이드를 만드는 중인 선수
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { ensureAccepted, consentModal } = useAiConsent();

  useEffect(() => {
    let alive = true;
    fetch("/api/members/coaching")
      .then(async res => {
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (alive) setRows(Array.isArray(data) ? data : []);
      })
      .catch(() => alive && setLoadError("코칭 목록을 불러오지 못했어요"));
    return () => { alive = false; };
  }, []);

  const patch = (id: string, fn: (r: Row) => Row) => setRows(cur => cur && cur.map(r => (r.id === id ? fn(r) : r)));
  const setError = (id: string, msg: string) => setErrors(e => ({ ...e, [id]: msg }));

  async function generate(r: Row) {
    if (busyId) return;
    if (!(await ensureAccepted())) return;
    setBusyId(r.id);
    setError(r.id, "");
    try {
      const res = await fetch(`/api/members/${r.id}/coaching`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(r.id, data.error ?? "가이드를 만들지 못했어요"); return; }
      patch(r.id, row => ({ ...row, guide: data.guide, stale: false }));
    } catch {
      setError(r.id, "네트워크 오류가 났어요. 다시 시도해주세요.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDelivered(r: Row) {
    if (!r.guide) return;
    const next = !r.guide.delivered_at;
    setError(r.id, "");
    try {
      const res = await fetch(`/api/members/${r.id}/coaching`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delivered: next }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(r.id, data.error ?? "저장하지 못했어요"); return; }
      patch(r.id, row => (row.guide ? { ...row, guide: { ...row.guide, delivered_at: data.delivered_at ?? null } } : row));
    } catch {
      setError(r.id, "네트워크 오류가 났어요. 다시 시도해주세요.");
    }
  }

  async function copy(r: Row) {
    if (!r.guide) return;
    try {
      await navigator.clipboard.writeText(guideText(r, r.guide));
      setCopiedId(r.id);
      setTimeout(() => setCopiedId(cur => (cur === r.id ? null : cur)), 2000);
    } catch {
      setError(r.id, "복사하지 못했어요");
    }
  }

  if (loadError) return <p className="text-center py-16 text-sm text-red-400">{loadError}</p>;
  if (!rows) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (rows.length === 0) return <p className="text-center py-16 text-gray-600">정규 팀원이 없어요</p>;

  const withGuide = rows.filter(r => r.guide);
  const delivered = withGuide.filter(r => r.guide?.delivered_at).length;

  return (
    <div className="flex flex-col gap-3">
      {consentModal}
      <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg px-4 py-3">
        <p className="text-sm font-bold text-sky-300 flex items-center gap-1.5"><Sparkles size={14} /> AI 코칭 가이드</p>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
          선수가 정한 희망 포지션과 장단점으로 플레이 방향·피할 것·추천 연습을 정리해요. 감독·코치만 볼 수 있어요.
        </p>
        <p className="text-xs text-gray-500 mt-1.5">가이드 {withGuide.length}명 · 전달 완료 {delivered}명 · 전달 전 {withGuide.length - delivered}명</p>
      </div>

      {rows.map(r => {
        const open = openId === r.id;
        const busy = busyId === r.id;
        return (
          <div key={r.id} className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
            <button onClick={() => setOpenId(open ? null : r.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{r.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{positionLabel(r)}</p>
              </div>
              <Badge row={r} />
            </button>

            {open && (
              <div className="px-4 pb-4 border-t border-white/5 pt-3">
                {r.guide ? (
                  <div className="flex flex-col gap-3 text-sm">
                    <section><p className="text-xs font-bold text-emerald-400 mb-1">✓ 이 자리에서 이렇게</p><p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{r.guide.content.play}</p></section>
                    <section><p className="text-xs font-bold text-amber-400 mb-1">⚠ 피할 것</p><p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{r.guide.content.avoid}</p></section>
                    <section>
                      <p className="text-xs font-bold text-sky-400 mb-1">🏃 추천 연습</p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-200 leading-relaxed">{r.guide.content.drills.map((d, i) => <li key={i}>{d}</li>)}</ol>
                    </section>
                    <section><p className="text-xs font-bold text-violet-400 mb-1">💬 이렇게 말해 주면 좋아요</p><p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{r.guide.content.talk}</p></section>
                    {r.stale && <p className="text-xs text-amber-400">이 가이드를 만든 뒤 희망 포지션이나 장단점이 바뀌었어요. 다시 만들면 최신 내용으로 바뀌어요.</p>}
                    <p className="text-[11px] text-gray-600">{md(r.guide.updated_at)}에 만들어졌어요</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => toggleDelivered(r)} className={`text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 ${r.guide.delivered_at ? "bg-white/5 text-gray-300" : "bg-emerald-500 text-black"}`}>
                        <ClipboardCheck size={13} /> {r.guide.delivered_at ? "전달 완료 취소" : "전달 완료로 표시"}
                      </button>
                      <button onClick={() => copy(r)} className="text-xs font-bold px-3 py-2 rounded-xl bg-white/5 text-gray-300">{copiedId === r.id ? "복사했어요 ✓" : "복사하기"}</button>
                      <button onClick={() => generate(r)} disabled={busy || !r.has_input} className="text-xs font-bold px-3 py-2 rounded-xl bg-white/5 text-sky-300 disabled:opacity-50">{busy ? "만드는 중…" : "다시 만들기"}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 items-start">
                    {r.has_input ? (
                      <p className="text-xs text-gray-400">저장된 가이드가 아직 없어요. 만들면 이 자리에 저장돼요.</p>
                    ) : (
                      <p className="text-xs text-gray-400">장점이나 단점을 먼저 적어야 가이드를 만들 수 있어요. 평가 탭에서 이 선수의 장단점을 적어 주세요.</p>
                    )}
                    <button onClick={() => generate(r)} disabled={busy || !r.has_input} className="text-xs font-bold px-3 py-2 rounded-xl bg-sky-500 text-black disabled:opacity-50">
                      {busy ? "만드는 중… (10~20초)" : "AI 코칭 가이드 만들기"}
                    </button>
                  </div>
                )}
                {errors[r.id] && <p className="text-xs text-red-400 mt-2">{errors[r.id]}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
