import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://soccer-position-project.vercel.app";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/join"],
      disallow: ["/dashboard", "/members", "/matches", "/assign", "/formations", "/feedback", "/mypage", "/admin"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
