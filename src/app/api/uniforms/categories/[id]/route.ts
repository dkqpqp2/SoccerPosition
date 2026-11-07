import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageUniforms } from "@/lib/team";

const MAX_NAME_LENGTH = 20;

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };

  const role = await getUserRole(userId, teamId);
  if (!canManageUniforms(role)) return { error: NextResponse.json({ error: "권한이 없어요" }, { status: 403 }) };
  return { teamId };
}

// PATCH - 항목 이름 바꾸기
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "항목 이름을 입력해주세요" }, { status: 400 });
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `항목 이름은 ${MAX_NAME_LENGTH}자까지 쓸 수 있어요` }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("uniform_categories")
    .update({ name })
    .eq("id", id)
    .eq("team_id", auth.teamId)
    .select("id, name, sort_order");
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "이미 있는 항목이에요" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: "항목을 찾을 수 없어요" }, { status: 404 });
  return NextResponse.json(data[0]);
}

// DELETE - 항목 삭제 (그 항목의 팀원별 기록도 함께 삭제)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("uniform_categories")
    .delete()
    .eq("id", id)
    .eq("team_id", auth.teamId)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "항목을 찾을 수 없어요" }, { status: 404 });
  return NextResponse.json({ success: true });
}
