"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/** 마이페이지: 서비스 운영자에게만 보이는 '신고 관리' 바로가기 (처리 안 한 신고 수 표시). 운영자가 아니면 아무것도 보이지 않는다. */
export default function OperatorReportsLink() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/operator/reports")
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (Array.isArray(data)) setCount(data.length); })
      .catch(() => {});
  }, []);

  if (count === null) return null;

  return (
    <Link href="/reports" className="flex items-center justify-between bg-gray-900 border border-white/5 rounded-2xl p-5 hover:bg-gray-800/60 transition-colors">
      <span className="font-bold text-white text-sm flex items-center gap-2"><ShieldAlert size={15} strokeWidth={2} /> 신고 관리</span>
      <span className={`text-xs font-bold ${count > 0 ? "text-red-400" : "text-gray-500"}`}>{count > 0 ? `처리할 신고 ${count}건` : "처리할 신고 없음"}</span>
    </Link>
  );
}
