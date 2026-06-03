"use client";

import { useState, useRef, useEffect } from "react";
import { POSITIONS, POSITION_GROUPS, POSITION_MAP } from "@/lib/positions";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function PositionSelect({ value, onChange, placeholder = "선택 안 함" }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = value ? POSITION_MAP[value] : null;

  return (
    <div ref={ref} className="relative">
      {/* 선택된 값 표시 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 hover:border-green-400 transition-colors"
      >
        {selected ? (
          <span className="font-medium text-gray-800">
            {selected.label}
            <span className="ml-1.5 text-gray-400 font-normal">({selected.description})</span>
          </span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <span className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* 선택 안 함 */}
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); setExpandedGroup(null); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-50 border-b border-gray-100"
          >
            선택 안 함
          </button>

          {/* 그룹 목록 */}
          {POSITION_GROUPS.map(group => (
            <div key={group.label}>
              {/* 그룹 헤더 */}
              <button
                type="button"
                onClick={() => setExpandedGroup(expandedGroup === group.label ? null : group.label)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <span>{group.label}</span>
                <span className={`transition-transform ${expandedGroup === group.label ? "rotate-180" : ""}`}>▾</span>
              </button>

              {/* 그룹 포지션 목록 */}
              {expandedGroup === group.label && (
                <div className="bg-gray-50">
                  {POSITIONS.filter(p => group.values.includes(p.value)).map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => { onChange(p.value); setOpen(false); setExpandedGroup(null); }}
                      className={`w-full text-left px-6 py-2 text-sm transition-colors flex items-center gap-2 ${value === p.value ? "bg-green-50 text-green-700 font-semibold" : "text-gray-700 hover:bg-green-50 hover:text-green-700"}`}
                    >
                      <span className="font-bold w-10 shrink-0">{p.label}</span>
                      <span className="text-gray-400 text-xs">{p.description}</span>
                      {value === p.value && <span className="ml-auto text-green-500">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
