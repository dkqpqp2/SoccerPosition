import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, isOwner } from "@/lib/team";

// GET - 모든 매칭 등록 조회 (기간 지난 글 자동 삭제)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 날짜가 설정된 경우, 희망 날짜가 지난 글 자동 삭제
  const today = new Date().toISOString().slice(0, 10);
  await supabaseAdmin
    .from("match_listings")
    .delete()
    .lt("preferred_date", today)
    .not("preferred_date", "is", null);

  const { data, error } = await supabaseAdmin
    .from("match_listings")
    .select("*, teams(id, name, color)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST - 매칭 등록 생성
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "팀이 없어요" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) return NextResponse.json({ error: "팀장만 이용할 수 있어요" }, { status: 403 });

  const body = await req.json();

  const { data, error } = await supabaseAdmin
    .from("match_listings")
    .insert({
      team_id: teamId,
      game_type: body.game_type ?? "풋살",
      preferred_date: body.preferred_date || null,
      preferred_time: body.preferred_time || null,
      preferred_end_time: body.preferred_end_time || null,
      location: body.location || null,
      place_lat: body.place_lat ?? null,
      place_lng: body.place_lng ?? null,
      message: body.message || null,
    })
    .select("*, teams(id, name, color)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
