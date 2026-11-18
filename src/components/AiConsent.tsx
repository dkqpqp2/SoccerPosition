"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "spm_ai_consent_ok";

/**
 * AI 기능(포지션 배정·선수 평가 다듬기·전술 제안)을 처음 쓰기 전에, 입력한 정보가 외부 AI 서비스(Anthropic)로 전송된다는 걸 알리고 동의받는다.
 * (App Store 심사 규정 5.1.2(i): 개인정보를 외부 AI에 공유하기 전에 명시적으로 알리고 허락을 받아야 함)
 * 사용법: const { ensureAccepted, consentModal } = useAiConsent();  AI 요청을 보내기 직전에 if (!(await ensureAccepted())) return;  화면에 {consentModal} 을 둔다.
 * 동의 여부는 이 기기 브라우저에 기억해서 한 번만 묻는다.
 */
export function useAiConsent(): { ensureAccepted: () => Promise<boolean>; consentModal: ReactNode } {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ensureAccepted = useCallback(
    () =>
      new Promise<boolean>(resolve => {
        try {
          if (localStorage.getItem(STORAGE_KEY) === "1") return resolve(true);
        } catch { /* 저장소를 못 쓰는 환경이면 매번 묻는다 */ }
        resolver.current = resolve;
        setOpen(true);
      }),
    []
  );

  function answer(ok: boolean) {
    if (ok) {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* 무시 */ }
    }
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  }

  const consentModal = open ? (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center px-5">
      <div role="dialog" aria-modal="true" aria-label="AI 기능 이용 안내" className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm">
        <h2 className="text-white font-black text-base mb-3">AI 기능 이용 안내</h2>
        <ul className="space-y-2 text-sm text-gray-300 leading-relaxed list-disc list-inside mb-4">
          <li>AI 기능을 쓰면 <b className="text-white">팀원 이름, 선호 포지션, 평가 메모(장점·단점), 전술판 내용</b>이 결과를 만들기 위해 외부 AI 서비스인 <b className="text-white">Anthropic(미국)</b>으로 전송돼요.</li>
          <li>이 기능을 누를 때만 전송되고, 전송된 정보는 결과를 만드는 데만 쓰여요.</li>
          <li>원하지 않으면 AI 기능을 쓰지 않아도 다른 기능은 모두 이용할 수 있어요.</li>
          <li>자세한 내용은 <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">개인정보처리방침</a>에서 볼 수 있어요.</li>
        </ul>
        <div className="flex gap-2">
          <button onClick={() => answer(false)} className="flex-1 bg-gray-800 text-gray-300 font-medium py-2.5 rounded-xl text-sm">취소</button>
          <button onClick={() => answer(true)} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl text-sm">동의하고 계속</button>
        </div>
      </div>
    </div>
  ) : null;

  return { ensureAccepted, consentModal };
}
