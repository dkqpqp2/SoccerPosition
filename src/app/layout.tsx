import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable.css";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { Analytics } from "@vercel/analytics/next";

const SITE_TITLE = "SPM - 축구·풋살 팀 관리 | Sports Position Management";
const SITE_DESCRIPTION = "풋살·축구 등 스포츠팀의 포지션 배정, 전술판, 경기 기록, 회비 관리를 한곳에서 해결하는 무료 팀 관리 서비스. 카카오 계정으로 바로 시작하세요.";

export const metadata: Metadata = {
  // og:image 같은 상대 경로를 실제 도메인으로 바꾸는 기준 (없으면 빌드 주소로 잘못 나옴)
  metadataBase: new URL("https://www.soccerpositionmanagement.com"),
  title: { default: SITE_TITLE, template: "%s | SPM" },
  description: SITE_DESCRIPTION,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    title: "스포츠팀매니저",
  },
  keywords: ["SPM", "스포츠팀 관리", "축구 포지션", "포지션 배정", "축구팀 관리", "풋살 팀 관리", "Sports Position Management", "팀원 관리"],
  authors: [{ name: "SPM" }],
  // og:image / twitter:image 는 같은 폴더의 opengraph-image.png, twitter-image.png 파일에서 자동으로 붙음
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "https://www.soccerpositionmanagement.com",
    siteName: "SPM",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "xuo4NRmpodQQyAEAj6YKz160rJV8-x5kuMTKA3E5AA8",
    other: {
      "naver-site-verification": [
        "2bad6202fac9e50d31cef0c590cd6901efb7ec80",
        "b275d8c5fbbd748c2772ad572b80765790e7a0ea",
      ],
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
