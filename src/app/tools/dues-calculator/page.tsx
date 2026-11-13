import type { Metadata } from "next";
import Link from "next/link";
import DuesCalculator from "./DuesCalculator";
import ToolFaq, { type FaqItem } from "../ToolFaq";

const PATH = "/tools/dues-calculator";

export const metadata: Metadata = {
  title: "회비 계산기 - 풋살·축구 1인당 구장비 정산",
  description:
    "참가 인원과 구장 대여료, 음료·간식비만 넣으면 1인당 회비와 월 회비를 바로 계산해 드려요. 풋살·축구 동호회 총무를 위한 무료 회비 정산 계산기예요.",
  keywords: ["회비 계산기", "풋살 회비", "축구 회비 계산", "구장비 정산", "1인당 구장비", "동호회 회비", "총무 회비 관리"],
  alternates: { canonical: PATH },
  openGraph: {
    title: "회비 계산기 - 풋살·축구 1인당 구장비 정산 | 스포츠팀매니저",
    description: "참가 인원과 비용만 넣으면 1인당 회비와 월 회비를 바로 계산해 드려요. 로그인 없이 무료.",
    url: PATH,
    type: "website",
    locale: "ko_KR",
  },
};

const FAQ: FaqItem[] = [
  {
    q: "1인당 금액은 어떻게 계산되나요?",
    a: "구장 대여료, 음료·간식비, 기타 비용을 모두 더한 총액을 참가 인원으로 나눈 뒤, 선택한 올림 단위(100원·500원·1,000원)로 올려서 보여줘요. 예를 들어 총 100,000원을 9명이 나누면 11,111원이지만 1,000원 단위로 올려 12,000원이 돼요.",
  },
  {
    q: "'남는 돈'은 무엇인가요?",
    a: "거스름돈을 피하려고 금액을 올려 받다 보니 총 필요 금액보다 더 걷히는 돈이에요. 위 예시라면 12,000원 × 9명 = 108,000원이 걷혀서 8,000원이 남아요. 이 돈은 다음 경기 음료비나 공 구입비로 쓰면 돼요.",
  },
  {
    q: "월 회비는 어떻게 정하면 좋을까요?",
    a: "한 달에 몇 번 경기를 하는지 입력하면 '1인당 금액 × 경기 횟수'로 월 회비를 보여줘요. 불참하는 사람이 있어도 구장비는 그대로이므로, 참가 인원은 평소 실제로 나오는 인원 기준으로 넣는 게 안전해요.",
  },
  {
    q: "경기에 못 나온 사람도 회비를 내야 하나요?",
    a: "팀마다 규칙이 달라요. 월 회비로 운영하는 팀은 불참해도 내고, 경기 단위로 걷는 팀은 참가한 사람끼리만 나눠요. 이 계산기는 입력한 참가 인원 기준으로 나누므로, 어떤 방식이든 맞춰서 쓰면 돼요.",
  },
  {
    q: "입력한 금액이 저장되나요?",
    a: "아니요. 계산은 지금 쓰는 기기의 브라우저 안에서만 이루어지고, 입력한 값은 서버로 전송되거나 저장되지 않아요.",
  },
];

export default function DuesCalculatorPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "회비 계산기 - 풋살·축구 1인당 구장비 정산",
    url: `https://www.soccerpositionmanagement.com${PATH}`,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    inLanguage: "ko",
    offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    isPartOf: { "@type": "WebSite", name: "스포츠팀매니저", url: "https://www.soccerpositionmanagement.com" },
  };

  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">회비 계산기 · 1인당 구장비 정산</h1>
      <p className="text-sm text-gray-400 leading-relaxed mb-6">
        총무라면 매번 계산기를 두드리게 되는 구장비 정산, 인원과 비용만 넣으면 1인당 금액과 월 회비를 바로 알려 드려요.
        거스름돈이 생기지 않게 금액을 올려서 계산하고, 남는 돈도 함께 보여줘요.
      </p>

      <DuesCalculator />

      <section className="mt-12">
        <h2 className="text-lg font-black text-white mb-3">사용 방법</h2>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-300 leading-relaxed">
          <li>이번 경기에 참가하는 인원을 입력해요.</li>
          <li>구장 대여료와 음료·간식비, 기타 비용을 입력해요. 쓰지 않는 칸은 비워 두면 돼요.</li>
          <li>거스름돈이 불편하면 올림 단위를 골라요. 1,000원 단위가 가장 간편해요.</li>
          <li>한 달 경기 횟수를 입력하면 월 회비까지 한 번에 확인할 수 있어요.</li>
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-black text-white mb-3">회비를 깔끔하게 운영하는 팁</h2>
        <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-300 leading-relaxed">
          <li>입금 내역과 지출 내역을 매번 기록해 두면 팀원들이 &quot;회비가 어디에 쓰였나요?&quot;라고 물을 때 바로 보여줄 수 있어요.</li>
          <li>남는 돈은 따로 적립해서 대회 참가비나 유니폼 구입처럼 큰 지출에 쓰면 부담이 줄어요.</li>
          <li>월 회비는 실제로 나오는 평균 인원 기준으로 정하면 적자를 막을 수 있어요.</li>
          <li>미납자를 단체 채팅방에서 직접 독촉하기 부담스럽다면, 납부 현황을 한눈에 보이게 해 두는 게 서로 편해요.</li>
        </ul>
      </section>

      <ToolFaq items={FAQ} />

      <section className="mt-12 bg-gray-900 border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-black text-white mb-1">회비 납부 현황까지 관리하고 싶다면</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          스포츠팀매니저에서는 팀원별 납부 여부와 수입·지출 내역을 기록하고 한눈에 볼 수 있어요.
          <Link href="/" className="text-emerald-400 hover:text-emerald-300 font-bold ml-1">무료로 시작하기</Link>
        </p>
        <p className="text-sm text-gray-400 mt-3">
          내전 팀 구성이 고민이라면
          <Link href="/tools/team-divider" className="text-emerald-400 hover:text-emerald-300 font-bold mx-1">팀 나누기</Link>
          도구도 써 보세요.
        </p>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
