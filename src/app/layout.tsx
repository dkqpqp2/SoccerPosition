import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "SPM - Soccer Position Management",
  description: "SPM은 축구팀 포지션 배정, 경기 관리, 팀원 관리를 스마트하게 도와주는 서비스입니다. 쉽고 빠른 포지션 배정으로 팀 운영을 더 효율적으로.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  keywords: ["SPM", "축구 포지션", "포지션 배정", "축구팀 관리", "Soccer Position Management", "풋살 팀 관리", "팀원 관리"],
  authors: [{ name: "SPM" }],
  openGraph: {
    title: "SPM - Soccer Position Management",
    description: "축구팀 포지션 배정과 경기 관리를 스마트하게. SPM으로 팀 운영을 더 쉽게.",
    url: "https://soccerpositionmanagement.com",
    siteName: "SPM",
    locale: "ko_KR",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "xuo4NRmpodQQyAEAj6YKz160rJV8-x5kuMTKA3E5AA8",
    other: {
      "naver-site-verification": ["2bad6202fac9e50d31cef0c590cd6901efb7ec80"],
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-full flex flex-col">
        <SessionProvider>{children}</SessionProvider>
        <Analytics />
        <footer className="w-full border-t border-white/5 bg-gray-950 py-4 px-6 mt-auto">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-gray-600">
            <span>© 2026 SPM · SportsPositionManagement</span>
            <a href="/privacy" className="hover:text-gray-400 transition-colors">개인정보처리방침</a>
            <a href="mailto:dkqpqp2@gmail.com" className="hover:text-gray-400 transition-colors">문의하기</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
