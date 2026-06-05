"use client";

import { useState } from "react";

interface Props {
  assignmentId: string;
  sessionName: string;
  formationName: string;
  matchTitle?: string | null;
  matchDate?: string | null;
}

export default function KakaoShare({ assignmentId }: Props) {
  const [state, setState] = useState<"idle" | "copied">("idle");

  async function share() {
    const url = `${window.location.origin}/share/${assignmentId}`;
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

    // 모바일: 네이티브 공유 시트 (카카오톡 직접 선택 가능)
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // 취소 or 실패 → 링크 복사로 폴백
      }
    }

    // PC / 폴백: 링크 복사
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const t = document.createElement("textarea");
      t.value = url;
      t.style.cssText = "position:fixed;opacity:0;";
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      document.body.removeChild(t);
    }
    setState("copied");
    setTimeout(() => setState("idle"), 3000);
  }

  return (
    <div className="relative w-full">
      <button
        onClick={share}
        className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-colors whitespace-nowrap ${
          state === "copied"
            ? "bg-blue-500 text-white"
            : "bg-yellow-400 hover:bg-yellow-500 text-gray-900"
        }`}
      >
        <span className="text-lg">{state === "copied" ? "✓" : "💬"}</span>
        {state === "copied" ? "링크 복사됨!" : "카카오 공유"}
      </button>
    </div>
  );
}
