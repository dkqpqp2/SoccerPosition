import type { Metadata } from "next";
import Link from "next/link";
import TeamDivider from "./TeamDivider";
import ToolFaq, { type FaqItem } from "../ToolFaq";

const PATH = "/tools/team-divider";

export const metadata: Metadata = {
  title: "팀 나누기 - 풋살·축구 랜덤 팀 뽑기",
  description:
    "참가자 이름만 입력하면 풋살·축구 내전 팀을 공평하게 랜덤으로 나눠 드려요. 2~6팀, 인원 자동 균등 배분, 결과 복사까지. 로그인 없이 무료로 쓸 수 있어요.",
  keywords: ["팀 나누기", "랜덤 팀 뽑기", "풋살 팀 나누기", "축구 팀 나누기", "내전 팀 짜기", "팀 짜기", "랜덤 팀 배정"],
  alternates: { canonical: PATH },
  openGraph: {
    title: "팀 나누기 - 풋살·축구 랜덤 팀 뽑기 | 스포츠팀매니저",
    description: "참가자 이름만 입력하면 내전 팀을 공평하게 랜덤으로 나눠 드려요. 로그인 없이 무료.",
    url: PATH,
    type: "website",
    locale: "ko_KR",
  },
};

const FAQ: FaqItem[] = [
  {
    q: "팀은 어떤 방식으로 나뉘나요?",
    a: "입력한 이름을 무작위로 섞은 뒤 팀 순서대로 한 명씩 배정해요. 그래서 팀 인원은 항상 최대 1명 차이로 고르게 나뉘고, 누가 어느 팀이 될지는 완전히 랜덤이에요.",
  },
  {
    q: "인원이 홀수이면 어떻게 되나요?",
    a: "예를 들어 11명을 2팀으로 나누면 6명과 5명으로 나뉘어요. 한 명이 더 들어가는 팀도 무작위로 정해져요.",
  },
  {
    q: "실력을 맞춰서 나눌 수도 있나요?",
    a: "이 도구는 순수 랜덤 방식이에요. 실력 차이를 줄이고 싶다면 결과를 보고 서로 비슷한 실력의 선수끼리 바꾸거나, 팀장이 직접 번갈아 뽑는 방식을 같이 쓰면 좋아요.",
  },
  {
    q: "입력한 이름이 서버에 저장되나요?",
    a: "아니요. 이름은 서버로 전송되지 않고 지금 쓰는 기기의 브라우저에만 임시로 기억돼요. 다음에 다시 열었을 때 명단을 다시 쓰지 않아도 되도록 하기 위한 거예요.",
  },
  {
    q: "결과를 단체 채팅방에 공유하려면요?",
    a: "결과 아래의 '결과 복사' 버튼을 누른 뒤 카카오톡 같은 메신저에 붙여넣으면 팀별 명단이 그대로 올라가요.",
  },
];

export default function TeamDividerPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "팀 나누기 - 랜덤 팀 뽑기",
    url: `https://www.soccerpositionmanagement.com${PATH}`,
    applicationCategory: "SportsApplication",
    operatingSystem: "Any",
    inLanguage: "ko",
    offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    isPartOf: { "@type": "WebSite", name: "스포츠팀매니저", url: "https://www.soccerpositionmanagement.com" },
  };

  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">팀 나누기 · 랜덤 팀 뽑기</h1>
      <p className="text-sm text-gray-400 leading-relaxed mb-6">
        풋살·축구 내전을 할 때 팀을 어떻게 나눌지 고민되시죠? 참가자 이름을 입력하고 버튼만 누르면
        공평하게 랜덤으로 팀을 나눠 드려요. 로그인 없이 무료로 쓸 수 있어요.
      </p>

      <TeamDivider />

      <section className="mt-12">
        <h2 className="text-lg font-black text-white mb-3">사용 방법</h2>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-300 leading-relaxed">
          <li>참가자 이름을 한 줄에 한 명씩 입력해요.</li>
          <li>나눌 팀 수를 2~6팀 중에서 골라요.</li>
          <li>&apos;팀 나누기&apos;를 누르면 팀이 바로 정해져요. 마음에 들지 않으면 &apos;다시 섞기&apos;로 다시 뽑을 수 있어요.</li>
          <li>&apos;결과 복사&apos;로 단체 채팅방에 공유해요.</li>
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-black text-white mb-3">공평한 내전 팀을 짜는 팁</h2>
        <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-300 leading-relaxed">
          <li>골키퍼를 맡을 사람이 정해져 있다면 팀 수만큼 먼저 한 명씩 나눠 가진 뒤, 나머지 인원만 이 도구로 나누세요.</li>
          <li>실력 차이가 큰 경기는 재미가 떨어져요. 랜덤 결과가 한쪽으로 치우쳤다면 한 번 더 섞어 보세요.</li>
          <li>3팀 이상이면 한 팀이 쉬는 로테이션 방식(이긴 팀 유지)으로 운영하면 경기를 더 많이 뛸 수 있어요.</li>
          <li>매번 같은 멤버로 팀이 나뉘지 않도록, 새로 섞을 때마다 결과를 기록해 두면 좋아요.</li>
        </ul>
      </section>

      <ToolFaq items={FAQ} />

      <section className="mt-12 bg-gray-900 border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-black text-white mb-1">다른 무료 도구</h2>
        <p className="text-sm text-gray-400">
          <Link href="/tools/dues-calculator" className="text-emerald-400 hover:text-emerald-300 font-bold">회비 계산기</Link>
          로 구장비·음료비를 1인당 금액으로 바로 계산해 보세요.
        </p>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
