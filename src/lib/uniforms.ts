import { supabaseAdmin } from "./supabase";

const DEFAULT_CATEGORIES = ["하계", "동계"];

export interface UniformCategory {
  id: string;
  name: string;
  sort_order: number;
}

async function listCategories(teamId: string) {
  return supabaseAdmin
    .from("uniform_categories")
    .select("id, name, sort_order")
    .eq("team_id", teamId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

/** 팀의 유니폼 항목 목록. 하나도 없으면 기본 항목(하계·동계)을 만든다. 동시에 불러도 (team_id, name) 유니크라 중복되지 않는다. */
export async function getUniformCategories(teamId: string): Promise<{ data: UniformCategory[]; error: string | null }> {
  const first = await listCategories(teamId);
  if (first.error) return { data: [], error: first.error.message };
  if (first.data?.length) return { data: first.data, error: null };

  await supabaseAdmin
    .from("uniform_categories")
    .upsert(
      DEFAULT_CATEGORIES.map((name, i) => ({ team_id: teamId, name, sort_order: i })),
      { onConflict: "team_id,name", ignoreDuplicates: true }
    );
  const again = await listCategories(teamId);
  if (again.error) return { data: [], error: again.error.message };
  return { data: again.data ?? [], error: null };
}
