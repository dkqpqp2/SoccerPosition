import Link from "next/link";
import SpmLogo from "@/components/SpmLogo";

// 로그인 없이 쓰는 무료 도구 페이지 공통 틀: 상단 바 + 하단에 서비스 소개(가입 유도)
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <Link href="/" aria-label="스포츠팀매니저 홈">
            <SpmLogo size="sm" />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-gray-400">
            <Link href="/tools" className="hover:text-white transition-colors">무료 도구</Link>
            <Link href="/" className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-3 py-1.5 rounded-lg transition-colors">앱 시작하기</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">{children}</main>

      <section className="border-t border-white/5 bg-gray-900/50">
        <div className="max-w-3xl mx-auto px-5 py-10 text-center">
          <h2 className="text-lg font-black text-white mb-2">팀 운영, 한곳에서 끝내세요</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-5">
            스포츠팀매니저(SPM)는 풋살·축구 팀의 포지션 배정, 전술판, 경기 기록, 회비 관리를 한곳에서 해결하는 무료 서비스예요.
            카카오 계정으로 1분이면 팀을 만들 수 있어요.
          </p>
          <Link
            href="/"
            className="inline-block bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-black py-3 px-8 rounded-xl transition-colors"
          >
            카카오로 무료 시작
          </Link>
        </div>
      </section>
    </div>
  );
}
