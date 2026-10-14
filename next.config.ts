import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      "k.kakaocdn.net",
      "img1.kakaocdn.net",
      "t1.kakaocdn.net",
    ],
  },
  serverExternalPackages: ["web-push"],
  // 검색에 나오면 안 되는 화면: 로그인 필요한 앱 화면, 팀원 이름이 담긴 공유 링크, 초대 코드 입력 화면
  async headers() {
    return [
      {
        source: "/:section(dashboard|members|matches|assign|formations|feedback|mypage|admin|tactics|stats|votes|dues|scrimmage|scrimmage-league|board|videos|matching|status|share|join)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
