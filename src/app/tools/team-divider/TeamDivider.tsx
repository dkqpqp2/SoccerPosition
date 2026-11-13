"use client";

import { useEffect, useState } from "react";
import { Shuffle, Copy, Check } from "lucide-react";

const STORAGE_KEY = "spm_tool_team_divider";
const MAX_NAMES = 60;
const TEAM_STYLES = [
  { label: "A팀", box: "border-emerald-500/40 bg-emerald-500/5", title: "text-emerald-400" },
  { label: "B팀", box: "border-sky-500/40 bg-sky-500/5", title: "text-sky-400" },
  { label: "C팀", box: "border-amber-500/40 bg-amber-500/5", title: "text-amber-400" },
  { label: "D팀", box: "border-rose-500/40 bg-rose-500/5", title: "text-rose-400" },
  { label: "E팀", box: "border-violet-500/40 bg-violet-500/5", title: "text-violet-400" },
  { label: "F팀", box: "border-orange-500/40 bg-orange-500/5", title: "text-orange-400" },
];

// 이름을 줄바꿈·쉼표로 나눠 빈 칸을 지운다
function parseNames(text: string) {
  return text.split(/[\n,]/).map(s => s.trim()).filter(Boolean).slice(0, MAX_NAMES);
}

// 암호학적 난수를 쓰는 Fisher-Yates 섞기 (Math.random의 쏠림 없이 공평하게)
function shuffle<T>(list: T[]) {
  const a = [...list];
  const buf = new Uint32Array(1);
  for (let i = a.length - 1; i > 0; i--) {
    let j: number;
    // 나머지 연산 쏠림 방지: 범위를 넘는 값은 버리고 다시 뽑는다
    const limit = Math.floor(0x100000000 / (i + 1)) * (i + 1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    j = buf[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function divide(names: string[], teamCount: number) {
  const teams: string[][] = Array.from({ length: teamCount }, () => []);
  // 인원이 남을 때 항상 A팀이 한 명 더 가져가지 않도록, 배정 순서도 섞는다
  const order = shuffle(Array.from({ length: teamCount }, (_, i) => i));
  shuffle(names).forEach((name, i) => teams[order[i % teamCount]].push(name));
  return teams;
}

export default function TeamDivider() {
  const [text, setText] = useState("");
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<string[][] | null>(null);
  const [copied, setCopied] = useState(false);

  // 지난번에 입력한 명단을 기억해 두면 매번 다시 안 써도 된다 (이 기기 브라우저에만 저장)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setText(saved);
    } catch { /* 저장소를 못 쓰는 환경은 무시 */ }
  }, []);

  const names = parseNames(text);
  const tooFew = names.length < teamCount;

  function handleChange(value: string) {
    setText(value);
    setTeams(null);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* 무시 */ }
  }

  function run() {
    if (tooFew) return;
    setTeams(divide(names, teamCount));
    setCopied(false);
  }

  async function copyResult() {
    if (!teams) return;
    const body = teams.map((t, i) => `${TEAM_STYLES[i].label} (${t.length}명)\n${t.join(", ")}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* 복사 권한이 없으면 화면의 결과를 직접 복사 */ }
  }

  return (
    <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
      <label htmlFor="names" className="block text-sm font-bold text-white mb-1">참가자 이름</label>
      <p className="text-xs text-gray-500 mb-2">한 줄에 한 명씩, 또는 쉼표로 구분해서 입력하세요. (최대 {MAX_NAMES}명)</p>
      <textarea
        id="names"
        value={text}
        onChange={e => handleChange(e.target.value)}
        rows={8}
        placeholder={"예)\n김철수\n이영희\n박민수\n..."}
        className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 resize-y"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="team-count" className="text-gray-300">나눌 팀 수</label>
          <select
            id="team-count"
            value={teamCount}
            onChange={e => { setTeamCount(Number(e.target.value)); setTeams(null); }}
            className="bg-gray-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
          >
            {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}팀</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-500">현재 <span className="text-emerald-400 font-bold">{names.length}명</span></p>
      </div>

      <button
        onClick={run}
        disabled={tooFew}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-black font-black py-3 rounded-xl transition-colors"
      >
        <Shuffle size={16} strokeWidth={2.5} /> {teams ? "다시 섞기" : "팀 나누기"}
      </button>
      {tooFew && names.length > 0 && (
        <p className="text-xs text-amber-400 mt-2">팀 수({teamCount}팀)보다 참가자가 적어요. 이름을 더 입력해 주세요.</p>
      )}

      {teams && (
        <div className="mt-6" aria-live="polite">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teams.map((t, i) => (
              <div key={i} className={`border rounded-xl p-4 ${TEAM_STYLES[i].box}`}>
                <h3 className={`text-sm font-black mb-2 ${TEAM_STYLES[i].title}`}>{TEAM_STYLES[i].label} · {t.length}명</h3>
                <ul className="space-y-1">
                  {t.map((n, k) => <li key={k} className="text-sm text-white">{n}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <button
            onClick={copyResult}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-white/10 text-gray-200 font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            {copied ? <><Check size={15} /> 복사했어요</> : <><Copy size={15} /> 결과 복사 (카카오톡에 붙여넣기)</>}
          </button>
        </div>
      )}
    </div>
  );
}
