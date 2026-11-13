"use client";

import { useState } from "react";

const MAX_VALUE = 100_000_000;
const ROUND_UNITS = [100, 500, 1000];

// 입력칸 문자열에서 숫자만 남기고, 음수·너무 큰 값은 막는다
function toNumber(value: string) {
  const n = Number(value.replace(/[^0-9]/g, ""));
  return Math.min(Number.isFinite(n) ? n : 0, MAX_VALUE);
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function NumberField({ id, label, hint, value, onChange, suffix }: {
  id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; suffix: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-white mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-1.5">{hint}</p>}
      <div className="relative">
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="0"
          className="w-full bg-gray-800 border border-white/10 rounded-xl pl-3 pr-12 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{suffix}</span>
      </div>
    </div>
  );
}

export default function DuesCalculator() {
  const [people, setPeople] = useState("");
  const [field, setField] = useState("");
  const [drink, setDrink] = useState("");
  const [etc, setEtc] = useState("");
  const [games, setGames] = useState("");
  const [roundUnit, setRoundUnit] = useState(1000);

  const n = toNumber(people);
  const total = toNumber(field) + toNumber(drink) + toNumber(etc);
  const monthlyGames = toNumber(games);
  const ready = n > 0 && total > 0;

  // 1인당 금액은 올림 단위로 올려서 거스름돈 문제를 없앤다. 올려서 더 걷힌 금액은 '남는 돈'으로 보여준다.
  const perPerson = ready ? Math.ceil(total / n / roundUnit) * roundUnit : 0;
  const collected = perPerson * n;
  const surplus = collected - total;
  const monthly = ready && monthlyGames > 0 ? perPerson * monthlyGames : 0;

  return (
    <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberField id="people" label="참가 인원" value={people} onChange={setPeople} suffix="명" />
        <NumberField id="field" label="구장 대여료" hint="한 경기 기준 총액" value={field} onChange={setField} suffix="원" />
        <NumberField id="drink" label="음료·간식비" value={drink} onChange={setDrink} suffix="원" />
        <NumberField id="etc" label="기타 비용" hint="공, 조끼 세탁, 심판비 등" value={etc} onChange={setEtc} suffix="원" />
        <NumberField id="games" label="한 달 경기 횟수 (선택)" hint="입력하면 월 회비도 계산해요" value={games} onChange={setGames} suffix="회" />
        <div>
          <label htmlFor="round" className="block text-sm font-bold text-white mb-1">금액 올림 단위</label>
          <p className="text-xs text-gray-500 mb-1.5">거스름돈이 생기지 않게 올려서 받아요</p>
          <select
            id="round"
            value={roundUnit}
            onChange={e => setRoundUnit(Number(e.target.value))}
            className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
          >
            {ROUND_UNITS.map(u => <option key={u} value={u}>{u.toLocaleString("ko-KR")}원 단위</option>)}
          </select>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4" aria-live="polite">
        {ready ? (
          <>
            <p className="text-xs text-gray-400 mb-1">1인당 내야 하는 금액</p>
            <p className="text-3xl font-black text-emerald-400">{won(perPerson)}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-400">총 필요 금액</dt>
              <dd className="text-right text-white font-bold">{won(total)}</dd>
              <dt className="text-gray-400">걷히는 금액</dt>
              <dd className="text-right text-white font-bold">{won(collected)}</dd>
              <dt className="text-gray-400">남는 돈 (다음 경기로)</dt>
              <dd className="text-right text-white font-bold">{won(surplus)}</dd>
              {monthly > 0 && (
                <>
                  <dt className="text-gray-400">월 회비 ({monthlyGames}회 기준)</dt>
                  <dd className="text-right text-emerald-400 font-bold">{won(monthly)}</dd>
                </>
              )}
            </dl>
          </>
        ) : (
          <p className="text-sm text-gray-500">참가 인원과 비용을 입력하면 1인당 금액이 바로 계산돼요.</p>
        )}
      </div>
    </div>
  );
}
