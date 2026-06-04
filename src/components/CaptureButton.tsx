"use client";

import { useState } from "react";

export default function CaptureButton({ targetId }: { targetId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleCapture() {
    setLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const el = document.getElementById(targetId);
      if (!el) return;

      const canvas = await html2canvas(el, {
        backgroundColor: "#f9fafb", // bg-gray-50
        scale: 2, // 고해상도
        useCORS: true,
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `참가인원_${new Date().toLocaleDateString("ko-KR").replace(/\. /g, "-").replace(".", "")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleCapture}
      disabled={loading}
      className="w-full mt-4 flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold py-3 rounded-2xl shadow-sm transition-colors disabled:opacity-50"
    >
      {loading ? (
        <>
          <span className="animate-spin text-base">⏳</span> 캡쳐 중...
        </>
      ) : (
        <>
          📸 이미지로 저장
        </>
      )}
    </button>
  );
}
