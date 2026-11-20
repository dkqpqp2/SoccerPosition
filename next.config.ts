import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 이 배포의 식별자. 화면(클라이언트)과 /api/version 이 같은 값을 쓰므로, 새 배포가 올라가면 켜 둔 화면과 서로 달라진다(AppUpdateWatcher).
  // Vercel이 아닌 곳에서 빌드하면 빈 값이 되어 감지 기능이 꺼진다.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
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
        source: "/:section(dashboard|members|matches|assign|formations|feedback|mypage|admin|tactics|stats|votes|dues|scrimmage|scrimmage-league|board|videos|matching|status|share|join|lounge)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
