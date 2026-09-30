"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options?: SelectOption[];
  groups?: SelectGroup[];
}

function OptionRow({ opt, active, onSelect }: { opt: SelectOption; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center justify-between text-left text-sm px-3 py-2 rounded-lg transition-colors ${
        active ? "bg-emerald-500/10 text-emerald-300" : "text-gray-200 hover:bg-white/5"
      }`}
    >
      {opt.label}
      {active && <Check size={13} className="text-emerald-400 shrink-0" />}
    </button>
  );
}

export default function ScrimmageSelect({ value, onChange, placeholder, options = [], groups = [] }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const allOptions = [...options, ...groups.flatMap(g => g.options)];
  const selected = allOptions.find(o => o.value === value);

  function select(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between bg-gray-800 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2.5 text-sm text-left transition-colors"
      >
        <span className={`truncate ${selected ? "text-white" : "text-gray-500"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={15} className={`text-gray-500 transition-transform shrink-0 ml-2 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 left-0 right-0 bg-gray-900 border border-white/10 rounded-xl shadow-xl max-h-64 overflow-y-auto themed-scroll p-1.5">
          {options.map(opt => (
            <OptionRow key={opt.value} opt={opt} active={opt.value === value} onSelect={() => select(opt.value)} />
          ))}
          {groups.map(group => (
            <div key={group.label} className="mt-1 first:mt-0">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest px-3 py-1.5">{group.label}</p>
              {group.options.map(opt => (
                <OptionRow key={opt.value} opt={opt} active={opt.value === value} onSelect={() => select(opt.value)} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
