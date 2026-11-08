import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageUniforms } from "@/lib/team";
import { getUniformCategories } from "@/lib/uniforms";

// 유니폼 관리 화면에 필요한 전부: 항목(하계·동계·조끼 등), 팀원, 팀원별 보유 기록
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ categories: [], members: [], records: [] });

  const role = await getUserRole(userId, teamId);
  if (!canManageUniforms(role)) return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });

  const cats = await getUniformCategories(teamId);
  if (cats.error) return NextResponse.json({ error: cats.error }, { status: 500 });

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
    categories: cats.data,
    members: membersRes.data ?? [],
    records: recordsRes.data ?? [],
  });
}
