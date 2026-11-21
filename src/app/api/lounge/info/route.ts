import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { canManage, getUserAndTeam, getUserRole } from "@/lib/team";
import { isLoungeEnabled } from "@/lib/lounge";

export const dynamic = "force-dynamic";

const MAX_RULES_LENGTH = 3000;
const PAGE = 1000; // Supabase는 한 번에 최대 1000행까지만 주므로 나눠서 읽는다

type RulesInfo = { content: string; updatedAt: string | null; updatedByName: string | null };

// 로컬 개발에서 로그인 없이 화면을 볼 때만 쓰는 예시 데이터 (규칙은 서버를 다시 켤 때까지 메모리에만 남는다)
let devRules: RulesInfo | null = {
  content: "1. 경기 3일 전까지 참석 여부를 체크해요.\n2. 지각·불참은 미리 단톡에 알려 주세요.\n3. 회비는 매달 5일까지 입금해요.\n4. 서로 존중하는 말투를 써요.",
  updatedAt: new Date().toISOString(),
  updatedByName: "김정호",
};

/** 한 테이블에서 팀의 금액 합계를 구한다 (1000행씩 나눠 읽음) */
async function sumAmounts(table: "dues_expenses" | "dues_income", teamId: string): Promise<number> {
  let total = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin.from(table).select("amount").eq("team_id", teamId).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) total += Number(r.amount) || 0;
    if (!data || data.length < PAGE) return total;
  }
}

/** 회비 화면의 "잔액 현황"과 같은 계산: 초기 잔액 + 회비 수납 + 기타 수입 − 지출 */
async function teamBalance(teamId: string): Promise<number | null> {
  try {
    const [{ data: settings }, { data: dues }] = await Promise.all([
      supabaseAdmin.from("dues_settings").select("initial_balance").eq("team_id", teamId).limit(1),
      supabaseAdmin.from("dues").select("id").eq("team_id", teamId),
    ]);
    const dueIds = (dues ?? []).map(d => d.id as string);

    let collected = 0;
    // dues_payments에는 team_id가 없어서 이 팀의 dues id로 거른다 (한 번에 너무 많은 id를 넣지 않게 나눠서)
    for (let i = 0; i < dueIds.length; i += 100) {
      const ids = dueIds.slice(i, i + 100);
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabaseAdmin.from("dues_payments").select("amount").in("dues_id", ids).range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        for (const r of data ?? []) collected += Number(r.amount) || 0;
        if (!data || data.length < PAGE) break;
      }
    }
    const [income, expenses] = await Promise.all([sumAmounts("dues_income", teamId), sumAmounts("dues_expenses", teamId)]);
    const initial = Number(settings?.[0]?.initial_balance) || 0;
    return initial + collected + income - expenses;
  } catch (e) {
    console.error("lounge balance error:", e instanceof Error ? e.message : String(e));
    return null; // 잔액을 못 읽었을 때는 0원이라고 잘못 보여 주지 않는다
  }
}

/** 이 팀 규칙. 테이블이 아직 없거나 읽기에 실패하면 unavailable */
async function readRules(teamId: string): Promise<{ rules: RulesInfo | null; unavailable: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("team_rules")
    .select("content, updated_at, updated_by")
    .eq("team_id", teamId)
    .limit(1);
  if (error) {
    console.error("lounge rules read error:", error.message);
    return { rules: null, unavailable: true };
  }
  const row = data?.[0];
  if (!row || !String(row.content ?? "").trim()) return { rules: null, unavailable: false };
  let updatedByName: string | null = null;
  if (row.updated_by) {
    const { data: u } = await supabaseAdmin.from("users").select("name").eq("id", row.updated_by).limit(1);
    updatedByName = (u?.[0]?.name as string | undefined) ?? null;
  }
  return { rules: { content: row.content as string, updatedAt: (row.updated_at as string) ?? null, updatedByName }, unavailable: false };
}

/** GET /api/lounge/info — 라운지 벽에 보여 줄 팀 회비 잔액과 팀 규칙 */
export async function GET() {
  const isDev = process.env.NODE_ENV === "development";
  const demo = () => NextResponse.json({ balance: 1234000, rules: devRules, canEditRules: true, demo: true });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    if (isDev) return demo();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId || !isLoungeEnabled(teamId)) {
    if (isDev) return demo();
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const role = await getUserRole(userId, teamId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [balance, { rules, unavailable }] = await Promise.all([teamBalance(teamId), readRules(teamId)]);
  return NextResponse.json({ balance, rules, rulesUnavailable: unavailable, canEditRules: canManage(role) });
}

/** PUT /api/lounge/info { content } — 팀 규칙 저장 (관리자급만). 내용을 비우면 규칙이 없는 상태가 된다 */
export async function PUT(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";

  let body: { content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청이 올바르지 않아요." }, { status: 400 });
  }
  if (typeof body.content !== "string") return NextResponse.json({ error: "내용을 입력해 주세요." }, { status: 400 });
  const content = body.content.replace(/\r\n?/g, "\n").trim();
  if (content.length > MAX_RULES_LENGTH) {
    return NextResponse.json({ error: `규칙은 ${MAX_RULES_LENGTH}자까지 쓸 수 있어요.` }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    if (isDev) {
      devRules = content ? { content, updatedAt: new Date().toISOString(), updatedByName: "김정호" } : null;
      return NextResponse.json({ rules: devRules });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId || !isLoungeEnabled(teamId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) return NextResponse.json({ error: "관리자·회장·코치만 쓸 수 있어요." }, { status: 403 });

  const updatedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("team_rules")
    .upsert({ team_id: teamId, content, updated_by: userId, updated_at: updatedAt }, { onConflict: "team_id" });
  if (error) {
    console.error("lounge rules save error:", error.message);
    return NextResponse.json({ error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  const { data: u } = await supabaseAdmin.from("users").select("name").eq("id", userId).limit(1);
  return NextResponse.json({
    rules: content ? { content, updatedAt, updatedByName: (u?.[0]?.name as string | undefined) ?? null } : null,
  });
}
