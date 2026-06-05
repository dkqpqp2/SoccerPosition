"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    Kakao: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: object) => void;
      };
    };
  }
}

interface Props {
  assignmentId: string;
  sessionName: string;
  formationName: string;
  matchTitle?: string | null;
  matchDate?: string | null;
}

export default function KakaoShare({ assignmentId, sessionName, formationName, matchTitle, matchDate }: Props) {
  const [copied, setCopied] = useState(false);
  const [kakaoReady, setKakaoReady] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    script.async = true;
    script.onload = () => {
      try {
        if (window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY!);
        }
        setKakaoReady(true);
      } catch {
        setKakaoReady(false);
      }
    };
    document.head.appendChild(script);
    return () => {
      try { document.head.removeChild(script); } catch { /* ignore */ }
    };
  }, []);

  async function share() {
    const shareUrl = `${window.location.origin}/share/${assignmentId}`;
    const title = matchTitle
      ? `${matchTitle} - ${sessionName}`
      : `⚽ ${sessionName} 포지션 배정`;
    const desc = `${formationName} 포메이션으로 배정됐어요!${matchDate ? ` · ${new Date(matchDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}` : ""}`;

    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

    // 모바일: 네이티브 공유 시트 (카카오톡 포함)
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ title, text: desc, url: shareUrl });
        return;
      } catch {
        // 사용자가 공유 취소했거나 실패 → 링크 복사로 폴백
      }
    }

    // PC: Kakao SDK 사용
    if (kakaoReady && window.Kakao?.isInitialized()) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title,
            description: desc,
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Soccerball.svg/240px-Soccerball.svg.png",
            link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
          },
          buttons: [{ title: "포지션 확인하기", link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
        });
        return;
      } catch {
        // Kakao 실패 → 링크 복사로 폴백
      }
    }

    // 최후 폴백: 링크 복사
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // clipboard API 실패 시 구형 방식
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button
      onClick={share}
      className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-colors ${
        copied
          ? "bg-blue-500 text-white"
          : "bg-yellow-400 hover:bg-yellow-500 text-gray-900"
      }`}
    >
      <span className="text-lg">{copied ? "✓" : "💬"}</span>
      {copied ? "링크 복사됨!" : "카카오톡으로 공유"}
    </button>
  );
}
