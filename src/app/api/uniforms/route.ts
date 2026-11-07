import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageUniforms } from "@/lib/team";

const DEFAULT_CATEGORIES = ["하계", "동계"];

// 유니폼 관리 화면에 필요한 전부: 항목(하계·동계·조끼 등), 팀원, 팀원별 보유 기록
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ categories: [], members: [], records: [] });

  const role = await getUserRole(userId, teamId);
  if (!canManageUniforms(role)) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  let { data: categories, error: catErr } = await supabaseAdmin
    .from("uniform_categories")
    .select("id, name, sort_order")
    .eq("team_id", teamId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });

  // 처음 열었을 때(항목이 하나도 없을 때) 기본 항목을 만든다. 동시에 열어도 (team_id, name) 유니크라 중복되지 않는다.
  if (!categories?.length) {
    await supabaseAdmin
      .from("uniform_categories")
      .upsert(
        DEFAULT_CATEGORIES.map((name, i) => ({ team_id: teamId, name, sort_order: i })),
        { onConflict: "team_id,name", ignoreDuplicates: true }
      );
    const again = await supabaseAdmin
      .from("uniform_categories")
      .select("id, name, sort_order")
      .eq("team_id", teamId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (again.error) return NextResponse.json({ error: again.error.message }, { status: 500 });
    categories = again.data;
  }

  const [membersRes, recordsRes] = await Promise.all([
    supabaseAdmin
      .from("team_members")
      .select("id, name, jersey_number")
      .eq("team_id", teamId)
      .eq("is_mercenary", false)
      .is("left_at", null)
      .order("name", { ascending: true }),
    supabaseAdmin.from("uniform_records").select("member_id, category_id").eq("team_id", teamId),
  ]);
  if (membersRes.error) return NextResponse.json({ error: membersRes.error.message }, { status: 500 });
  if (recordsRes.error) return NextResponse.json({ error: recordsRes.error.message }, { status: 500 });

  return NextResponse.json({
    categories: categories ?? [],
    members: membersRes.data ?? [],
    records: recordsRes.data ?? [],
  });
}
