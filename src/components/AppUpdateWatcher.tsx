"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// 이 화면을 만든 배포의 식별자(빌드할 때 박힌다). 비어 있으면(로컬 개발 등) 아무것도 하지 않는다.
const CURRENT_BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

const MIN_CHECK_GAP_MS = 30_000; // 서버에 너무 자주 묻지 않는다
const POLL_MS = 10 * 60_000; // 켜 둔 채로 쓰는 동안은 10분마다 확인
const HEARTBEAT_MS = 15_000; // 앱이 잠들었다 깨어난 걸 알아채려고 15초마다 시계를 본다
const AWAY_RELOAD_MS = 5 * 60_000; // 이만큼 이상 앱을 떠났다 돌아왔을 때만 자동으로 새로고침한다
const RELOAD_GUARD_MS = 5 * 60_000; // 자동 새로고침은 5분에 한 번까지만 (혹시 모를 반복 방지)
const GUARD_KEY = "spm:updateReloadAt";

// 만들던 내용이 날아가면 안 되는 화면: 자동 새로고침 대신 안내만 띄운다
const NO_AUTO_RELOAD = [/^\/tactics\/[^/]+/];

function isTyping() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

function reloadedRecently() {
  try {
    const at = Number(sessionStorage.getItem(GUARD_KEY) ?? 0);
    return Date.now() - at < RELOAD_GUARD_MS;
  } catch {
    return false;
  }
}

function markReloaded() {
  try {
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    // 저장이 막혀 있어도 새로고침 자체는 한다
  }
}

/**
 * 새 배포가 올라갔는데 앱·탭에 옛날 화면이 남아 있으면 알아채서 새로고침한다.
 *  - 앱을 5분 이상 떠났다 돌아왔고, 글을 쓰는 중이 아니고, 편집 화면이 아니면 → 바로 새로고침
 *  - 그 밖의 경우(잠깐 나갔다 옴, 쓰는 도중, 켜 둔 채로 쓰는 중) → 아래쪽에 "새로고침" 안내만 띄운다
 * 서버의 /api/version 과 이 화면에 박힌 식별자를 비교한다.
 */
export default function AppUpdateWatcher() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!CURRENT_BUILD) return;
    let alive = true;
    let lastCheck = 0;
    let lastBeat = Date.now();
    let hiddenAt: number | null = null;

    async function check(awayMs: number) {
      const now = Date.now();
      if (now - lastCheck < MIN_CHECK_GAP_MS) return;
      lastCheck = now;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!alive || !res.ok) return;
        const { id } = (await res.json()) as { id?: string };
        if (!id || id === CURRENT_BUILD) return; // 같은 배포이거나 식별자를 모르면 그대로 둔다

        const canAuto =
          awayMs >= AWAY_RELOAD_MS &&
          !isTyping() &&
          !NO_AUTO_RELOAD.some(re => re.test(pathRef.current)) &&
          !reloadedRecently();
        if (canAuto) {
          markReloaded();
          window.location.reload();
          return;
        }
        setStale(true);
      } catch {
        // 네트워크가 안 되면 다음 기회에
      }
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else {
        const away = hiddenAt ? Date.now() - hiddenAt : 0;
        hiddenAt = null;
        lastBeat = Date.now();
        void check(away);
      }
    }

    // 앱이 잠들면 타이머도 멈춘다. 깨어난 뒤 첫 박자에서 시계가 크게 건너뛰었으면 그만큼 떠나 있었던 것으로 본다
    const beat = setInterval(() => {
      const now = Date.now();
      const gap = now - lastBeat;
      lastBeat = now;
      if (document.visibilityState === "visible" && gap > 60_000) void check(gap);
    }, HEARTBEAT_MS);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void check(0);
    }, POLL_MS);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    return () => {
      alive = false;
      clearInterval(beat);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
    };
  }, []);

  if (!stale) return null;

  return (
    <div
      role="status"
      className="fixed left-3 right-3 z-[60] bottom-[calc(72px+env(safe-area-inset-bottom,0px))] md:left-auto md:right-6 md:bottom-6 md:w-80 bg-gray-900 border border-emerald-500/40 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3"
    >
      <p className="flex-1 min-w-0 text-xs text-gray-200 leading-snug">새 버전이 나왔어요. 새로고침하면 최신 화면으로 바뀌어요.</p>
      <button
        onClick={() => window.location.reload()}
        className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-3 py-2 rounded-lg transition-colors"
      >
        새로고침
      </button>
      <button
        onClick={() => setStale(false)}
        aria-label="나중에"
        className="shrink-0 text-gray-500 hover:text-gray-300 text-sm px-1"
      >
        ✕
      </button>
    </div>
  );
}
