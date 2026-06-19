import { createClient } from "@supabase/supabase-js";

/** 브라우저(클라이언트 컴포넌트)에서만 사용 — service role key를 포함하지 않음 */
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
