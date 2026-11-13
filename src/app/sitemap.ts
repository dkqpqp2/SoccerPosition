import { MetadataRoute } from "next";

// 도구 페이지 내용을 크게 고쳤을 때만 이 날짜를 바꾼다 (요청마다 현재 시각을 넣으면 검색엔진이 변경 표시를 믿지 않음)
const TOOLS_UPDATED = new Date("2026-11-13");

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.soccerpositionmanagement.com";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: TOOLS_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/tools/team-divider`,
      lastModified: TOOLS_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools/dues-calculator`,
      lastModified: TOOLS_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/support`,
      lastModified: TOOLS_UPDATED,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: TOOLS_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    // /join 은 초대 코드 입력 화면이라 noindex 처리했고, noindex 페이지는 사이트맵에 넣지 않는다
  ];
}
