import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOperatorUserId } from "@/lib/operator";
import { isReportTarget } from "@/lib/moderation";

// POST - 신고 처리 (운영자 전용): { target_type, target_ids: string[], action: "remove" | "dismiss" }
//  remove: 사진·댓글을 삭제하고 신고를 '삭제됨'으로 기록 / dismiss: 문제없다고 보고 신고를 '기각'으로 기록
export async function POST(req: NextRequest) {
  if (!(await getOperatorUserId())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const ids: unknown = body?.target_ids;
  if (
    !isReportTarget(body?.target_type) ||
    (action !== "remove" && action !== "dismiss") ||
    !Array.isArray(ids) || ids.length === 0 || ids.length > 50 || !ids.every(i => typeof i === "string")
  ) {
    return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });
  }
  const targetIds = ids as string[];
  const type = body.target_type as "gallery_photo" | "vote_comment";

  // 열려 있는 신고가 실제로 있는 대상만 처리한다
  const { data: open } = await supabaseAdmin
    .from("content_reports")
    .select("target_id")
    .eq("target_type", type)
    .eq("status", "open")
    .in("target_id", targetIds);
  const reported = [...new Set((open ?? []).map(r => r.target_id as string))];
  if (reported.length === 0) return NextResponse.json({ error: "처리할 신고가 없어요" }, { status: 404 });

  if (action === "remove") {
    if (type === "vote_comment") {
      const { error } = await supabaseAdmin.from("vote_comments").delete().in("id", reported);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { data: photos } = await supabaseAdmin.from("gallery_photos").select("id, image_url").in("id", reported);
      const paths: string[] = [];
      (photos ?? []).forEach(p => {
        try {
          const path = new URL(p.image_url as string).pathname.split("/object/public/gallery/")[1];
          if (path) paths.push(decodeURIComponent(path));
        } catch { /* 주소를 읽지 못하면 파일 삭제는 건너뛴다 */ }
      });
      if (paths.length) await supabaseAdmin.storage.from("gallery").remove(paths);
      const { error } = await supabaseAdmin.from("gallery_photos").delete().in("id", reported);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { error } = await supabaseAdmin
    .from("content_reports")
    .update({ status: action === "remove" ? "removed" : "dismissed", handled_at: new Date().toISOString() })
    .eq("target_type", type)
    .eq("status", "open")
    .in("target_id", reported);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
