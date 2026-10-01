import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";

// GET - 내 팀의 전체 전술판 목록 (관리자급 전용)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json([]);

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("tactics_boards")
    .select("id, title, formation_name, published, created_at, updated_at")
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST - 새 전술판 생성
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const { title, formation_name, tokens, arrows } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "이름을 입력해주세요" }, { status: 400 });
  if (!formation_name) return NextResponse.json({ error: "포메이션을 선택해주세요" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("tactics_boards")
    .insert({
      team_id: teamId,
      title: title.trim(),
      formation_name,
      tokens: tokens ?? [],
      arrows: arrows ?? [],
      created_by: userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
