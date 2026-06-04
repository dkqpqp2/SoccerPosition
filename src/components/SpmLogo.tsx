"use client";

import { useRouter } from "next/navigation";

interface SpmLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  clickable?: boolean;
}

export default function SpmLogo({ size = "md", showText = true, clickable = false }: SpmLogoProps) {
  const router = useRouter();
  const iconSize = size === "sm" ? 28 : size === "md" ? 36 : 56;
  const fontSize = size === "sm" ? "text-base" : size === "md" ? "text-lg" : "text-3xl";
  const subSize = size === "sm" ? "text-[9px]" : size === "md" ? "text-[10px]" : "text-sm";

  return (
    <div
      className={`flex items-center gap-2.5 ${clickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
      onClick={clickable ? () => router.push("/dashboard") : undefined}
    >
      {/* SPM 아이콘 */}
      <div
        className="relative flex items-center justify-center rounded-xl shrink-0"
        style={{
          width: iconSize,
          height: iconSize,
          background: "linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)",
          boxShadow: "0 0 12px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        {/* 축구공 라인 느낌의 장식 */}
        <div
          className="absolute inset-0 rounded-xl opacity-20"
          style={{
            background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 60%)",
          }}
        />
        {/* S·P·M 텍스트 */}
        <span
          className="relative font-black tracking-tighter text-white"
          style={{
            fontSize: iconSize * 0.38,
            letterSpacing: "-1px",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}
        >
          SPM
        </span>
      </div>

      {/* 텍스트 */}
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-black text-white tracking-tight ${fontSize}`} style={{ letterSpacing: "-0.5px" }}>
            Soccer Position
          </span>
          <span className={`font-bold text-emerald-400 tracking-widest uppercase ${subSize}`}>
            Management
          </span>
        </div>
      )}
    </div>
  );
}
