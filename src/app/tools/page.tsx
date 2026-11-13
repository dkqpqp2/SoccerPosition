import type { Metadata } from "next";
import Link from "next/link";
import { Shuffle, Calculator } from "lucide-react";

export const metadata: Metadata = {
  title: "풋살·축구 팀 운영 무료 도구 모음",
  description:
    "풋살·축구 동호회 운영에 바로 쓰는 무료 도구 모음. 랜덤 팀 나누기, 1인당 회비 계산기를 로그인 없이 사용해 보세요.",
  alternates: { canonical: "/tools" },
};

const TOOLS = [
  {
    href: "/tools/team-divider",
    icon: Shuffle,
    title: "팀 나누기",
    desc: "참가자 이름을 입력하면 내전 팀을 공평하게 랜덤으로 나눠 줘요.",
  },
  {
    href: "/tools/dues-calculator",
    icon: Calculator,
    title: "회비 계산기",
    desc: "참가 인원과 구장비·음료비로 1인당 회비와 월 회비를 바로 계산해요.",
  },
];

export default function ToolsIndexPage() {
  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">풋살·축구 팀 운영 무료 도구</h1>
      <p className="text-sm text-gray-400 leading-relaxed mb-8">
        동호회를 운영하다 보면 팀 나누기, 회비 정산처럼 매번 반복되는 일이 많아요.
        로그인 없이 바로 쓸 수 있는 도구를 모았어요.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TOOLS.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className="bg-gray-900 border border-white/5 hover:border-emerald-500/40 rounded-2xl p-5 transition-colors"
          >
            <t.icon size={22} className="text-emerald-400 mb-3" strokeWidth={1.75} />
            <h2 className="text-base font-black text-white mb-1">{t.title}</h2>
            <p className="text-sm text-gray-400 leading-relaxed">{t.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
