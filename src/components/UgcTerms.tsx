"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "spm_ugc_terms_ok";

/**
 * 사진·댓글을 처음 올리기 전에 커뮤니티 이용 규칙에 동의받는다 (App Store 심사 규정: 사용자 콘텐츠가 있는 앱은 이용 약관 동의 필수).
 * 사용법: const { ensureAccepted, termsModal } = useUgcTerms();  올리기 직전에 if (!(await ensureAccepted())) return;  화면에 {termsModal} 을 둔다.
 * 동의 여부는 이 기기 브라우저에 기억해서 한 번만 묻는다.
 */
export function useUgcTerms(): { ensureAccepted: () => Promise<boolean>; termsModal: ReactNode } {
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

  const termsModal = open ? (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center px-5">
      <div role="dialog" aria-modal="true" aria-label="커뮤니티 이용 규칙" className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm">
        <h2 className="text-white font-black text-base mb-3">커뮤니티 이용 규칙</h2>
        <ul className="space-y-2 text-sm text-gray-300 leading-relaxed list-disc list-inside mb-4">
          <li>욕설·비하, 음란물, 불법 내용, 스팸·광고는 올릴 수 없어요.</li>
          <li>다른 사람이 불쾌한 내용을 보면 <b className="text-white">신고</b>하거나 그 사용자를 <b className="text-white">차단</b>할 수 있어요.</li>
          <li>신고된 내용은 운영자가 확인하고, 규칙에 어긋나면 삭제하며 반복하면 이용을 제한해요.</li>
          <li>자세한 내용은 <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">이용약관</a>에서 볼 수 있고, 문의는 <a href="/support" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">고객 지원</a>으로 보내 주세요.</li>
        </ul>
        <div className="flex gap-2">
          <button onClick={() => answer(false)} className="flex-1 bg-gray-800 text-gray-300 font-medium py-2.5 rounded-xl text-sm">취소</button>
          <button onClick={() => answer(true)} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl text-sm">동의하고 계속</button>
        </div>
      </div>
    </div>
  ) : null;

  return { ensureAccepted, termsModal };
}
