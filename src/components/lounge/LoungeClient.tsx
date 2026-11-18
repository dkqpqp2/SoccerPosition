"use client";

import dynamic from "next/dynamic";

// three.js는 브라우저에서만 돌고 용량도 커서, 라운지 화면에 들어올 때만 불러온다 (다른 화면에는 영향 없음)
const LoungeScene = dynamic(() => import("./LoungeScene"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-gray-950 flex items-center justify-center text-gray-400 text-sm">라운지 불러오는 중…</div>
  ),
});

export default function LoungeClient({ canManage }: { canManage: boolean }) {
  return <LoungeScene canManage={canManage} />;
}
