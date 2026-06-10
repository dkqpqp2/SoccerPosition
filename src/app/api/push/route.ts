import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

// POST - 구독 등록
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { endpoint, keys } = await req.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await supabaseAdmin.from("push_subscriptions").upsert({
    user_id: userId,
    team_id: teamId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }, { onConflict: "user_id,endpoint" });

  return NextResponse.json({ success: true });
}

// DELETE - 구독 해제
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await getUserAndTeam(session.user.id);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { endpoint } = await req.json();
  await supabaseAdmin.from("push_subscriptions").delete()
    .eq("user_id", userId).eq("endpoint", endpoint);

  return NextResponse.json({ success: true });
}
