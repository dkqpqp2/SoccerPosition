"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type Bulk = { total: number; done: number; ok: number; failed: number; limited: boolean; running: boolean };

const BULK_CONCURRENCY = 3; // 한 번에 동시에 만드는 선수 수

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

const chip = "text-[11px] font-bold px-2 py-0.5 rounded-full";

function Badge({ row }: { row: Row }) {
  if (row.guide && row.stale) {
    return (
      <span className="flex flex-col items-end gap-1">
        <span className={`${chip} bg-amber-500/15 text-amber-400`}>⚠ 평가가 바뀌었어요</span>
        {row.guide.delivered_at && <span className={`${chip} bg-emerald-500/15 text-emerald-400`}>전달 완료 {md(row.guide.delivered_at)}</span>}
      </span>
    );
  }
  if (row.guide?.delivered_at) return <span className={`${chip} bg-emerald-500/15 text-emerald-400`}>전달 완료 {md(row.guide.delivered_at)}</span>;
  if (row.guide) return <span className={`${chip} bg-sky-500/15 text-sky-400`}>가이드 있음</span>;
  return <span className={`${chip} bg-white/5 text-gray-400`}>아직 안 만듦</span>;
}

/** 팀원 관리 → 코칭 탭 (관리자급 전용): 팀 전체 선수의 AI 코칭 가이드를 한 번에 만들어 저장해 두고, 피드백을 전달했는지 표시한다 */
export default function CoachingTab() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set()); // 가이드를 만드는 중인 선수들
  const [bulk, setBulk] = useState<Bulk | null>(null);
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
  const working = busyIds.size > 0 || bulk?.running === true;

  /** 선수 한 명의 가이드를 만든다. "limit"은 오늘 AI 횟수를 다 쓴 경우 */
  async function requestGuide(r: Row): Promise<"ok" | "limit" | "fail"> {
    setBusyIds(s => new Set(s).add(r.id));
    setError(r.id, "");
    try {
      const res = await fetch(`/api/members/${r.id}/coaching`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(r.id, data.error ?? "가이드를 만들지 못했어요");
        return res.status === 429 ? "limit" : "fail";
      }
      patch(r.id, row => ({ ...row, guide: data.guide, stale: false }));
      return "ok";
    } catch {
      setError(r.id, "네트워크 오류가 났어요. 다시 시도해주세요.");
      return "fail";
    } finally {
      setBusyIds(s => {
        const next = new Set(s);
        next.delete(r.id);
        return next;
      });
    }
  }

  async function generate(r: Row) {
    if (working) return;
    if (!(await ensureAccepted())) return;
    await requestGuide(r);
  }

  /** 장단점이 있는 선수 중 가이드가 없거나 평가가 바뀐 선수를 한 번에 만든다 (3명씩 동시에, 오늘 횟수를 다 쓰면 멈춘다) */
  async function generateAll() {
    if (!rows || working) return;
    const targets = rows.filter(r => r.has_input && (!r.guide || r.stale));
    if (targets.length === 0) return;
    if (!(await ensureAccepted())) return;

    setBulk({ total: targets.length, done: 0, ok: 0, failed: 0, limited: false, running: true });
    let next = 0;
    let stop = false;
    const worker = async () => {
      while (!stop) {
        const i = next++;
        if (i >= targets.length) return;
        const result = await requestGuide(targets[i]);
        if (result === "limit") stop = true;
        setBulk(b => (b ? { ...b, done: b.done + 1, ok: b.ok + (result === "ok" ? 1 : 0), failed: b.failed + (result === "fail" ? 1 : 0), limited: b.limited || result === "limit" } : b));
      }
    };
    await Promise.all(Array.from({ length: BULK_CONCURRENCY }, worker));
    setBulk(b => (b ? { ...b, running: false } : b));
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

  // 장단점이 없고 가이드도 없는 팀원은 아래 "장단점을 추가해 주세요" 칸으로 따로 뺀다
  const ready = rows.filter(r => r.has_input || r.guide);
  const missing = rows.filter(r => !r.has_input && !r.guide);
  const withGuide = rows.filter(r => r.guide);
  const delivered = withGuide.filter(r => r.guide?.delivered_at).length;
  const todo = rows.filter(r => r.has_input && (!r.guide || r.stale)).length;

  return (
    <div className="flex flex-col gap-3">
      {consentModal}
      <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg px-4 py-3">
        <p className="text-sm font-bold text-sky-300 flex items-center gap-1.5"><Sparkles size={14} /> AI 코칭 가이드</p>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
          선수가 정한 희망 포지션과 장단점으로 플레이 방향·피할 것·추천 연습을 정리해요. 감독·코치만 볼 수 있어요.
        </p>
        <p className="text-xs text-gray-500 mt-1.5">가이드 {withGuide.length}명 · 전달 완료 {delivered}명 · 전달 전 {withGuide.length - delivered}명{missing.length > 0 ? ` · 장단점 없음 ${missing.length}명` : ""}</p>

        <button
          onClick={generateAll}
          disabled={working || todo === 0}
          className="mt-3 w-full text-sm font-bold py-2.5 rounded-xl bg-sky-500 text-black disabled:opacity-50"
        >
          {bulk?.running ? `만드는 중… ${bulk.done}/${bulk.total}` : todo > 0 ? `전체 선수 코칭 한 번에 만들기 (${todo}명)` : "모든 선수의 가이드가 최신이에요"}
        </button>
        {todo > 0 && !bulk && (
          <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">장단점이 있는 선수 중 가이드가 없거나 평가가 바뀐 선수만 만들어요. 선수 한 명당 AI를 한 번씩 쓰고, 3명씩 동시에 만들어서 몇 분 걸릴 수 있어요.</p>
        )}
        {bulk && (
          <div className="mt-2.5">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-sky-400 transition-all" style={{ width: `${Math.round((bulk.done / bulk.total) * 100)}%` }} />
            </div>
            {!bulk.running && (
              <p className="text-xs mt-2 leading-relaxed text-gray-300">
                {bulk.ok}명 완료{bulk.failed > 0 ? ` · 실패 ${bulk.failed}명(선수를 눌러 다시 만들 수 있어요)` : ""}
                {bulk.limited ? ` · 오늘 AI 사용 횟수를 다 써서 ${bulk.total - bulk.ok - bulk.failed}명은 만들지 못했어요. 내일 다시 눌러 주세요` : ""}
              </p>
            )}
          </div>
        )}
      </div>

      {ready.map(r => {
        const open = openId === r.id;
        const busy = busyIds.has(r.id);
        return (
          <div key={r.id} className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
            <button onClick={() => setOpenId(open ? null : r.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{r.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{positionLabel(r)}</p>
              </div>
              {busy ? <span className={`${chip} bg-sky-500/15 text-sky-400`}>만드는 중…</span> : <Badge row={r} />}
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
                      <button onClick={() => generate(r)} disabled={working || !r.has_input} className="text-xs font-bold px-3 py-2 rounded-xl bg-white/5 text-sky-300 disabled:opacity-50">{busy ? "만드는 중…" : "다시 만들기"}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 items-start">
                    <p className="text-xs text-gray-400">저장된 가이드가 아직 없어요. 위의 "전체 선수 코칭 한 번에 만들기"로 만들거나, 이 선수만 따로 만들 수 있어요.</p>
                    <button onClick={() => generate(r)} disabled={working} className="text-xs font-bold px-3 py-2 rounded-xl bg-sky-500 text-black disabled:opacity-50">
                      {busy ? "만드는 중… (10~20초)" : "이 선수만 만들기"}
                    </button>
                  </div>
                )}
                {errors[r.id] && <p className="text-xs text-red-400 mt-2">{errors[r.id]}</p>}
              </div>
            )}
          </div>
        );
      })}

      {missing.length > 0 && (
        <div className="bg-gray-900 border border-amber-500/20 rounded-lg overflow-hidden mt-1">
          <p className="px-4 py-3 text-sm font-bold text-amber-300">장단점을 추가해 주세요 <span className="text-amber-400/70 font-semibold">({missing.length}명)</span></p>
          <p className="px-4 -mt-2 pb-2 text-xs text-gray-500">장점이나 단점이 적혀 있어야 코칭 가이드를 만들 수 있어요.</p>
          {missing.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-white/5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{r.name}</p>
                <p className="text-xs text-gray-500">{positionLabel(r)}</p>
              </div>
              <button onClick={() => router.push(`/members/${r.id}`)} className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500 text-black">장단점 추가하기</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
