"use client";

export type TacticsMode = "present" | "watch";

/**
 * 전술 구역에서 버튼을 눌렀을 때 화면을 덮는 전술 화면의 틀.
 * 지금은 자리만 잡아 둔 상태 — 다음 단계에서 이 안에 전술판(발표자는 그리기, 관람자는 읽기 전용)이 들어온다.
 */
export default function TacticsSessionPanel({ mode, onClose }: { mode: TacticsMode; onClose: () => void }) {
  const presenting = mode === "present";
  return (
    <div
      className="absolute inset-0 z-50 bg-gray-950/95 flex flex-col"
      // 이 화면 위의 터치·휠이 뒤의 3D 카메라 확대/축소로 번지지 않게 막는다
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${presenting ? "bg-emerald-500 text-black" : "bg-sky-500 text-black"}`}>
            {presenting ? "🎤 설명 중" : "👀 관람 중"}
          </span>
          <span className="text-white text-sm font-bold">전술판</span>
        </div>
        <button onClick={onClose} className="px-3 py-1.5 rounded-full bg-white/10 text-white text-sm font-bold">
          {presenting ? "설명 끝내기" : "나가기"}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
        <div className="w-full max-w-sm aspect-[3/4] rounded-2xl bg-green-800/70 border-2 border-white/60 flex items-center justify-center">
          <p className="text-white/80 text-sm leading-relaxed px-6 whitespace-pre-line">
            {presenting
              ? "여기에 전술판이 열려요.\n선수를 옮기고 선을 그리면 보는 팀원에게 실시간으로 보여요."
              : "여기에 설명하는 사람의 전술판이 실시간으로 보여요."}
          </p>
        </div>
        <p className="text-gray-500 text-xs">(자리만 만들어 둔 화면이에요 — 전술판 연결은 다음 단계)</p>
      </div>
    </div>
  );
}
