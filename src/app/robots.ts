import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://www.soccerpositionmanagement.com";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/join"],
      // 로그인해야 쓰는 앱 화면 (검색에 나올 이유가 없음). /share 는 noindex 헤더로 처리(next.config.ts) — 막으면 noindex를 못 읽음
      disallow: [
        "/dashboard", "/members", "/matches", "/assign", "/formations", "/feedback", "/mypage", "/admin",
        "/tactics", "/stats", "/votes", "/dues", "/scrimmage", "/scrimmage-league", "/board", "/videos", "/matching", "/status",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
