import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageUniforms } from "@/lib/team";

// PUT - 팀원 한 명의 한 항목 보유 여부 저장: { member_id, category_id, has_item }
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageUniforms(role)) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const memberId = body?.member_id;
  const categoryId = body?.category_id;
  const hasItem = body?.has_item;
  if (typeof memberId !== "string" || typeof categoryId !== "string" || typeof hasItem !== "boolean") {
    return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }

  // 팀원과 항목이 둘 다 이 팀 소속인지 따로 확인 (다른 팀 id를 섞어 넣는 것 방지)
  const [memberRes, categoryRes] = await Promise.all([
    supabaseAdmin.from("team_members").select("id").eq("id", memberId).eq("team_id", teamId).eq("is_mercenary", false).is("left_at", null).limit(1),
    supabaseAdmin.from("uniform_categories").select("id").eq("id", categoryId).eq("team_id", teamId).limit(1),
  ]);
  if (memberRes.error || categoryRes.error) {
    return NextResponse.json({ error: (memberRes.error ?? categoryRes.error)!.message }, { status: 500 });
  }
  if (!memberRes.data?.length) return NextResponse.json({ error: "팀원을 찾을 수 없어요" }, { status: 404 });
  if (!categoryRes.data?.length) return NextResponse.json({ error: "항목을 찾을 수 없어요" }, { status: 404 });

  // 기록이 있으면 보유, 없으면 미보유
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
