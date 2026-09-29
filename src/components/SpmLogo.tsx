"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";

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
      <Image
        src="/spm-logo.png"
        alt="SPM"
        width={iconSize}
        height={iconSize}
        className="shrink-0"
        priority
      />

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
