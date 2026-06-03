"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    script.async = true;
    script.onload = () => {
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY!);
      }
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  function share() {
    const shareUrl = `${window.location.origin}/share/${assignmentId}`;
    const title = matchTitle
      ? `${matchTitle} - ${sessionName}`
      : `⚽ ${sessionName} 포지션 배정`;
    const desc = `${formationName} 포메이션으로 배정됐어요!${matchDate ? ` · ${new Date(matchDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}` : ""}`;

    if (window.Kakao?.isInitialized()) {
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
    } else {
      // Kakao SDK 없으면 링크 복사
      navigator.clipboard.writeText(shareUrl);
      alert("링크가 복사됐어요! 카카오톡에 붙여넣기 하세요.");
    }
  }

  return (
    <button
      onClick={share}
      className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3 rounded-xl transition-colors"
    >
      <span className="text-lg">💬</span>
      카카오톡으로 공유
    </button>
  );
}
