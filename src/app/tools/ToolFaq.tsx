export interface FaqItem {
  q: string;
  a: string;
}

/** 자주 묻는 질문 목록 + 검색엔진용 FAQ 구조화 데이터(JSON-LD). 내용은 화면에 보이는 것과 같아야 한다. */
export default function ToolFaq({ items }: { items: FaqItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(i => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };

  return (
    <section className="mt-12">
      <h2 className="text-lg font-black text-white mb-4">자주 묻는 질문</h2>
      <div className="space-y-4">
        {items.map(i => (
          <div key={i.q} className="bg-gray-900 border border-white/5 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-1.5">{i.q}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{i.a}</p>
          </div>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
