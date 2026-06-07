import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/kakao/staticmap?lat=&lng=
 * Kakao 정적 지도 이미지를 서버사이드로 프록시 — JS SDK / 도메인 등록 불필요
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng) return new NextResponse("Missing lat/lng", { status: 400 });

  const key = process.env.KAKAO_REST_API_KEY ?? process.env.KAKAO_CLIENT_ID;
  if (!key) return new NextResponse("No API key", { status: 500 });

  // Kakao Static Map API: center는 경도,위도 / markers는 위도,경도
  const marker = encodeURIComponent(`color:red|${lat},${lng}`);
  const url = `https://dapi.kakao.com/v2/maps/staticmap.png?center=${lng},${lat}&level=4&markers=${marker}&width=400&height=192`;

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
  });

  if (!res.ok) {
    return new NextResponse("Map fetch failed", { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
