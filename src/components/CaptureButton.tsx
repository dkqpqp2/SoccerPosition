"use client";

import { useState } from "react";
import { toPng } from "html-to-image";

interface Props {
  targetId: string;
  filename?: string;
  bgColor?: string;
}

export default function CaptureButton({ targetId, filename, bgColor = "#030712" }: Props) {
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
        backgroundColor: bgColor,
        pixelRatio: 2,
      });

      const name = filename ?? `캡쳐_${new Date().toLocaleDateString("ko-KR").replace(/\. /g, "-").replace(".", "")}.png`;

      const link = document.createElement("a");
      link.download = name;
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
      className="w-full mt-4 flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-300 hover:text-white font-semibold py-3 rounded-2xl transition-colors disabled:opacity-50"
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
