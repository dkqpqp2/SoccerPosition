"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "./useLoungeRoom";

const timeFormat = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true });

/**
 * 라운지 대화창: 이 화면에 들어와 있는 동안 오간 대화를 처음부터 볼 수 있다.
 * 대화는 이 화면의 메모리에만 있다 — DB에 저장하지 않고, 이 화면을 나가면 사라진다.
 * (그래서 나중에 들어온 사람은 그 전의 대화를 볼 수 없다)
 */
export default function ChatPanel({ messages, onClose }: { messages: ChatMessage[]; onClose: () => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // 맨 아래를 보고 있을 때만 새 메시지를 따라 내려간다 (위로 올려 읽는 중이면 그대로 둔다)

  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div
      className="absolute inset-x-4 mx-auto max-w-sm z-[55] flex flex-col rounded-2xl bg-gray-900/95 border border-white/10 shadow-2xl h-[46vh] max-h-[420px]"
      // 바닥을 탭하면 걷는 화면이라, 이 창 위의 터치·휠이 뒤의 3D(걷기·카메라 확대)로 번지지 않게 막는다
      style={{ bottom: "calc(max(env(safe-area-inset-bottom), 16px) + 52px)" }}
      onPointerDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <h2 className="text-white font-black text-sm">💬 팀 대화</h2>
          <p className="text-gray-500 text-[11px] mt-0.5">저장되지 않아요 · 이 화면을 나가면 사라져요</p>
        </div>
        <button onClick={onClose} aria-label="대화창 닫기" className="w-8 h-8 rounded-full bg-white/10 text-white text-sm font-bold">✕</button>
      </div>

      <div
        ref={listRef}
        onScroll={e => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto px-3 pb-3 space-y-2"
        // 화면 전체는 터치 이동을 막아 두었으므로, 이 목록만 위아래 스크롤을 허용한다
        style={{ touchAction: "pan-y", overscrollBehavior: "contain" }}
      >
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center pt-12 leading-relaxed">아직 대화가 없어요<br />첫 인사를 남겨 보세요</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
            {!m.mine && <span className="text-sky-300 text-[11px] font-bold mb-0.5 ml-1">{m.name}</span>}
            <div className="flex items-end gap-1.5 max-w-[85%]">
              {m.mine && <span className="text-gray-500 text-[10px] shrink-0">{timeFormat.format(m.at)}</span>}
              <div className={`px-3 py-2 rounded-2xl text-sm break-words min-w-0 ${m.mine ? "bg-emerald-500 text-black rounded-br-md" : "bg-gray-800 text-white rounded-bl-md"}`}>{m.text}</div>
              {!m.mine && <span className="text-gray-500 text-[10px] shrink-0">{timeFormat.format(m.at)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
