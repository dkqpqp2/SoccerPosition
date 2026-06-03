import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function getUserId(kakaoId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("kakao_id", kakaoId)
    .single();
  return data?.id;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.id);
  if (!userId) return NextResponse.json([], { status: 200 });

  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");

  let query = supabaseAdmin
    .from("position_assignments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (matchId) {
    // 특정 경기 쿼터만
    query = query.eq("match_id", matchId);
  } else {
    // 경기에 연결되지 않은 배정만 (직접 포지션 배정)
    query = query.is("match_id", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { session_name, formation_name, formation_id, formation_slots, result, match_id } = await req.json();

  const { data, error } = await supabaseAdmin
    .from("position_assignments")
    .insert({ user_id: userId, session_name, formation_name, formation_id, formation_slots, result, match_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
