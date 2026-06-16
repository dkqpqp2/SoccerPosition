"use client";

import { useState } from "react";
import { toBlob } from "html-to-image";

interface Props {
  targetId: string;
  filename?: string;
  bgColor?: string;
}

export default function CaptureButton({ targetId, filename, bgColor = "#030712" }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleCapture() {
    setLoading(true);

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    // 클릭 시점(사용자 제스처) 안에서 미리 빈 탭을 열어둬야 나중에 팝업 차단을 피할 수 있음
    const preOpenedWin = isMobile ? window.open("", "_blank") : null;

    try {
      const el = document.getElementById(targetId);
      if (!el) {
        preOpenedWin?.close();
        alert("캡쳐 영역을 찾을 수 없어요.");
        return;
      }

      const blob = await toBlob(el, {
        backgroundColor: bgColor,
        pixelRatio: 2,
      });
      if (!blob) {
        preOpenedWin?.close();
        alert("캡쳐 실패: 이미지를 생성할 수 없어요.");
        return;
      }

      const name = filename ?? `캡쳐_${new Date().toLocaleDateString("ko-KR").replace(/\. /g, "-").replace(".", "")}.png`;
      const file = new File([blob], name, { type: "image/png" });

      // 모바일은 공유 시트로 먼저 시도 (카톡으로 바로 전달 가능)
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (isMobile && nav.canShare && nav.canShare({ files: [file] })) {
        try {
          preOpenedWin?.close();
          await navigator.share({ files: [file] });
          return;
        } catch (shareErr) {
          if (shareErr instanceof DOMException && shareErr.name === "AbortError") return; // 공유 취소
          // 공유 실패 시 아래 폴백으로 진행
        }
      }

      const url = URL.createObjectURL(blob);

      // 모바일에서 공유 미지원/실패 시: 새 탭에 이미지를 열어 길게 눌러 저장하도록 안내
      if (isMobile) {
        if (preOpenedWin) {
          preOpenedWin.document.write(
            `<body style="margin:0;background:#030712;display:flex;justify-content:center"><img src="${url}" style="max-width:100%" /></body>`
          );
          alert("이미지를 길게 눌러 '이미지 저장'을 선택해주세요.");
        } else {
          alert("팝업이 차단됐어요. 브라우저 팝업 차단을 해제한 후 다시 시도해주세요.");
        }
        return;
      }

      const link = document.createElement("a");
      link.download = name;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      preOpenedWin?.close();
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
