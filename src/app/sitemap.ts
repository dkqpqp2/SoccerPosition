import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.soccerpositionmanagement.com";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    // /join 은 초대 코드 입력 화면이라 noindex 처리했고, noindex 페이지는 사이트맵에 넣지 않는다
  ];
}
