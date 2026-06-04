import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserId } from "@/lib/team";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { team_id } = await req.json();

  // 해당 팀에 소속돼있는지 확인
  const { data } = await supabaseAdmin
    .from("team_users")
    .select("id")
    .eq("team_id", team_id)
    .eq("user_id", userId)
    .single();

  if (!data) return NextResponse.json({ error: "소속된 팀이 아니에요" }, { status: 403 });

  await supabaseAdmin
    .from("users")
    .update({ active_team_id: team_id })
    .eq("id", userId);

  return NextResponse.json({ success: true });
}
