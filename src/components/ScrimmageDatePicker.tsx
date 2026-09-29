"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseDate(v: string) {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
}

export default function ScrimmageDatePicker({ value, onChange, placeholder = "날짜 선택" }: Props) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const parsed = parseDate(value);
  const [viewYear, setViewYear] = useState(parsed?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function openPicker() {
    const p = parseDate(value);
    setViewYear(p?.y ?? today.getFullYear());
    setViewMonth(p?.m ?? today.getMonth());
    setOpen(v => !v);
  }

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: { y: number; m: number; d: number; inMonth: boolean }[] = [];
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ y, m, d: prevMonthDays - i, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ y: viewYear, m: viewMonth, d, inMonth: true });
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  let trailingDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ y: nextYear, m: nextMonth, d: trailingDay, inMonth: false });
    trailingDay++;
  }

  const displayLabel = parsed
    ? new Date(parsed.y, parsed.m, parsed.d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })
    : null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={openPicker}
        className="w-full flex items-center justify-between bg-gray-800 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2.5 text-sm text-left transition-colors"
      >
        <span className={displayLabel ? "text-white" : "text-gray-500"}>{displayLabel ?? placeholder}</span>
        <CalendarIcon size={15} className="text-gray-500 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 left-0 bg-gray-900 border border-white/10 rounded-2xl shadow-xl p-4 w-[280px]">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => shiftMonth(-1)} className="w-7 h-7 flex items-center justify-center rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <p className="text-sm font-bold text-emerald-400">{viewYear}년 {viewMonth + 1}월</p>
            <button type="button" onClick={() => shiftMonth(1)} className="w-7 h-7 flex items-center justify-center rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`text-center text-[11px] font-semibold py-1 ${i === 0 ? "text-red-400" : "text-gray-500"}`}>{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((c, i) => {
              const isSelected = parsed && parsed.y === c.y && parsed.m === c.m && parsed.d === c.d;
              const isToday = c.y === today.getFullYear() && c.m === today.getMonth() && c.d === today.getDate();
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { onChange(toDateStr(c.y, c.m, c.d)); setOpen(false); }}
                  className={`mx-auto w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-emerald-500 text-black font-bold"
                      : !c.inMonth
                      ? "text-gray-700 hover:bg-white/5"
                      : isToday
                      ? "border border-emerald-500/50 text-emerald-300"
                      : "text-gray-200 hover:bg-white/10"
                  }`}
                >
                  {c.d}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-xs text-gray-500 hover:text-white transition-colors">삭제</button>
            <button
              type="button"
              onClick={() => { onChange(toDateStr(today.getFullYear(), today.getMonth(), today.getDate())); setOpen(false); }}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
            >
              오늘
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
