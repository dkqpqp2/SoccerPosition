import Link from "next/link";
import SpmLogo from "@/components/SpmLogo";

/** 지원·이용약관 같은 안내 페이지의 공통 틀 (로그인 없이 볼 수 있고, 앱스토어 심사에서 확인하는 주소들이다). */
export default function LegalShell({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link href="/" aria-label="스포츠팀매니저 홈"><SpmLogo size="sm" /></Link>
          <nav className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/support" className="hover:text-white transition-colors">지원</Link>
            <Link href="/terms" className="hover:text-white transition-colors">이용약관</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">개인정보처리방침</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-black text-white">{title}</h1>
          {updated && <p className="text-gray-500 text-sm mt-2">최종 수정일: {updated}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-white mb-2">{title}</h2>
      <div className="text-sm text-gray-400 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
