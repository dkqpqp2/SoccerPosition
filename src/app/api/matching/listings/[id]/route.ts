import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function getMyTeamId(kakaoId: string) {
  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("kakao_id", kakaoId).single();
  if (!user) return null;
  const { data: team } = await supabaseAdmin
    .from("teams").select("id").eq("owner_id", user.id).single();
  return team?.id ?? null;
}

// PATCH - 상태 변경 (open → closed)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const teamId = await getMyTeamId(session.user.id);
  if (!teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { data: listing } = await supabaseAdmin
    .from("match_listings").select("team_id").eq("id", id).single();
  if (!listing || listing.team_id !== teamId)
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("match_listings")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE - 매칭 등록 삭제
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const teamId = await getMyTeamId(session.user.id);
  if (!teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { data: listing } = await supabaseAdmin
    .from("match_listings").select("team_id").eq("id", id).single();
  if (!listing || listing.team_id !== teamId)
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { error } = await supabaseAdmin.from("match_listings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
