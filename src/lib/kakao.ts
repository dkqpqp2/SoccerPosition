/* Kakao Maps JS SDK 싱글턴 로더 */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any;
  }
}

let _promise: Promise<void> | null = null;

/**
 * Kakao Maps JS SDK를 한 번만 로드하는 싱글턴 함수.
 * - services 라이브러리(장소검색)를 포함해 로드
 * - 이미 로드됐으면 즉시 resolve
 */
export function loadKakaoSDK(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.kakao?.maps?.services) return Promise.resolve();
  if (_promise) return _promise;

  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
  if (!key) {
    console.warn("NEXT_PUBLIC_KAKAO_JS_KEY is not set");
    return Promise.resolve();
  }

  _promise = new Promise<void>((resolve) => {
    // 이미 <script> 태그가 있으면 load 이벤트 대기
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="dapi.kakao.com/v2/maps"]'
    );
    if (existing) {
      if (window.kakao?.maps) {
        window.kakao.maps.load(resolve);
      } else {
        existing.addEventListener("load", () => window.kakao.maps.load(resolve));
      }
      return;
    }

    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`;
    script.onload  = () => window.kakao.maps.load(resolve);
    script.onerror = () => { _promise = null; resolve(); };
    document.head.appendChild(script);
  });

  return _promise;
}
