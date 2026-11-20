"use client";

import LoungeGate from "./LoungeGate";

// 방 상태(열림·없음·종료)에 따라 화면을 정하는 입구. 방의 3D 장면은 LoungeGate가 방에 들어갈 때만 불러온다.
export default function LoungeClient() {
  return <LoungeGate />;
}
