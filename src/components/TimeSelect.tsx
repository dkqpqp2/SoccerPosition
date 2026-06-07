"use client";

interface Props {
  value: string; // "HH:MM"
  onChange: (val: string) => void;
  placeholder?: string;
}

export default function TimeSelect({ value, onChange, placeholder = "시간 선택" }: Props) {
  const [hour, minute] = value ? value.split(":") : ["", ""];

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = ["00", "10", "20", "30", "40", "50"];

  function handleHour(h: string) {
    onChange(`${h}:${minute || "00"}`);
  }
  function handleMinute(m: string) {
    onChange(`${hour || "00"}:${m}`);
  }

  const selectCls = "flex-1 bg-gray-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer";

  return (
    <div className="flex gap-2 items-center">
      <select value={hour} onChange={e => handleHour(e.target.value)} className={selectCls}>
        <option value="" disabled>시</option>
        {hours.map(h => (
          <option key={h} value={h}>{h}시</option>
        ))}
      </select>
      <span className="text-gray-500 font-bold shrink-0">:</span>
      <select value={minute} onChange={e => handleMinute(e.target.value)} className={selectCls}>
        <option value="" disabled>분</option>
        {minutes.map(m => (
          <option key={m} value={m}>{m}분</option>
        ))}
      </select>
    </div>
  );
}
