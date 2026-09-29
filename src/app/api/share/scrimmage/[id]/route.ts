import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: scrimmage }, { data: squads }] = await Promise.all([
    supabaseAdmin.from("scrimmages").select("*").eq("id", id).single(),
    supabaseAdmin.from("scrimmage_squads").select("*").eq("scrimmage_id", id).order("sort_order", { ascending: true }),
  ]);

  if (!scrimmage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ scrimmage, squads: squads ?? [] });
}
