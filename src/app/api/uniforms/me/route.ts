import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";
import { getUniformCategories } from "@/lib/uniforms";

// 내가 이 팀에서 가진 팀원 행 id. 없으면(팀 없음·나감·용병) null.
// user_id로 조회하므로 과거 중복 행이 있어도 에러 나지 않게 .limit(1) 사용
async function myMemberId(userId: string, teamId: string) {
  const { data } = await supabaseAdmin
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("is_mercenary", false)
    .is("left_at", null)
    .limit(1);
  return data?.[0]?.id ?? null;
}

// GET - 내 유니폼: 팀의 항목 목록과 내가 가진 항목 id들 (모든 팀원)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ categories: [], owned: [] });

  const memberId = await myMemberId(userId, teamId);
  if (!memberId) return NextResponse.json({ categories: [], owned: [] });

  const [cats, records] = await Promise.all([
    getUniformCategories(teamId),
    supabaseAdmin.from("uniform_records").select("category_id").eq("team_id", teamId).eq("member_id", memberId),
  ]);
  if (cats.error) return NextResponse.json({ error: cats.error }, { status: 500 });
  if (records.error) return NextResponse.json({ error: records.error.message }, { status: 500 });

  return NextResponse.json({
    categories: cats.data,
    owned: (records.data ?? []).map(r => r.category_id as string),
  });
}

// PUT - 내 보유 여부 저장: { category_id, has_item } — 항상 내 팀원 행에만 저장하고, 다른 사람 id는 받지 않는다
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const categoryId = body?.category_id;
  const hasItem = body?.has_item;
  if (typeof categoryId !== "string" || typeof hasItem !== "boolean") {
    return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }

  const memberId = await myMemberId(userId, teamId);
  if (!memberId) return NextResponse.json({ error: "팀원 정보를 찾을 수 없어요" }, { status: 404 });

  const { data: category, error: catErr } = await supabaseAdmin
    .from("uniform_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("team_id", teamId)
    .limit(1);
  if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });
  if (!category?.length) return NextResponse.json({ error: "항목을 찾을 수 없어요" }, { status: 404 });

  const { error } = hasItem
    ? await supabaseAdmin
        .from("uniform_records")
        .upsert({ team_id: teamId, member_id: memberId, category_id: categoryId }, { onConflict: "member_id,category_id" })
    : await supabaseAdmin
        .from("uniform_records")
        .delete()
        .eq("team_id", teamId)
        .eq("member_id", memberId)
        .eq("category_id", categoryId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
