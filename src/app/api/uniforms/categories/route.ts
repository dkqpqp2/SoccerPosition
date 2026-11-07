import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageUniforms } from "@/lib/team";

const MAX_CATEGORIES = 20;
const MAX_NAME_LENGTH = 20;

// POST - 항목 추가 (예: 조끼, 신가드)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageUniforms(role)) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "항목 이름을 입력해주세요" }, { status: 400 });
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `항목 이름은 ${MAX_NAME_LENGTH}자까지 쓸 수 있어요` }, { status: 400 });
  }

  const { data: existing, error: listErr } = await supabaseAdmin
    .from("uniform_categories")
    .select("sort_order")
    .eq("team_id", teamId)
    .order("sort_order", { ascending: false });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  if ((existing?.length ?? 0) >= MAX_CATEGORIES) {
    return NextResponse.json({ error: `항목은 최대 ${MAX_CATEGORIES}개까지 만들 수 있어요` }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("uniform_categories")
    .insert({ team_id: teamId, name, sort_order: (existing?.[0]?.sort_order ?? -1) + 1 })
    .select("id, name, sort_order")
    .single();
  if (error) {
    // (team_id, name) 유니크 위반
    if (error.code === "23505") return NextResponse.json({ error: "이미 있는 항목이에요" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
