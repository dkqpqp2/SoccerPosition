import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function getUserId(kakaoId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("kakao_id", kakaoId)
    .single();
  return data?.id;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.id);
  const { data } = await supabaseAdmin
    .from("users")
    .select("team_color")
    .eq("id", userId)
    .single();

  return NextResponse.json({ team_color: data?.team_color || "#facc15" });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.id);
  const { team_color } = await req.json();

  await supabaseAdmin
    .from("users")
    .update({ team_color })
    .eq("id", userId);

  return NextResponse.json({ success: true });
}
