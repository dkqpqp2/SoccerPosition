"use client";

import { useState } from "react";
import { toPng } from "html-to-image";

export default function CaptureButton({ targetId }: { targetId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleCapture() {
    setLoading(true);
    try {
      const el = document.getElementById(targetId);
      if (!el) {
        alert("캡쳐 영역을 찾을 수 없어요.");
        return;
      }

      const dataUrl = await toPng(el, {
        backgroundColor: "#f9fafb",
        pixelRatio: 2,
      });

      const link = document.createElement("a");
      link.download = `참가인원_${new Date().toLocaleDateString("ko-KR").replace(/\. /g, "-").replace(".", "")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      alert("캡쳐 실패: " + String(e));
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
        <>📸 이미지로 저장</>
      )}
    </button>
  );
}
