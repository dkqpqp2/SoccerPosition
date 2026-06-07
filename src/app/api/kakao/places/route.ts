import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/kakao/places?q={검색어}
 * Kakao Local REST API 프록시 — 서버사이드에서 호출해 도메인 제한 없이 동작
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ documents: [] });
  }

  const key = process.env.KAKAO_REST_API_KEY ?? process.env.KAKAO_CLIENT_ID;
  if (!key) {
    return NextResponse.json({ error: "KAKAO_REST_API_KEY not set" }, { status: 500 });
  }

  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=5`;

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${key}` },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
