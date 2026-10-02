import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage, sanitizeResult } from "@/lib/team";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json([], { status: 200 });

  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");
  const all = searchParams.get("all");

  let query = supabaseAdmin
    .from("position_assignments")
    .select("*, matches(title, match_date)")
    .eq("team_id", teamId)
    .order(all ? "created_at" : "session_name", { ascending: !all });

  if (all) {
    // 전체 세션 조회 (전술판 "배정 불러오기" 등에서 사용) — match 유무 상관없이 전부
  } else if (matchId) {
    query = query.eq("match_id", matchId);
  } else {
    query = query.is("match_id", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (all) {
    // "불러오기"용 전체 조회일 땐 이미 지난 경기의 배정은 제외 (독립 세션은 날짜 개념이 없어 그대로 둠)
    const today = new Date().toISOString().slice(0, 10);
    const filtered = (data ?? []).filter((item: any) => !item.matches || item.matches.match_date >= today);
    return NextResponse.json(filtered);
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) {
    return NextResponse.json({ error: "포지션 배정 권한이 없어요. 팀장 또는 부팀장만 가능해요." }, { status: 403 });
  }

  const { session_name, formation_name, formation_id, formation_slots, result, match_id, attending_members } = await req.json();

  // 같은 경기(또는 같은 팀)에서 중복 이름 방지
  const dupQuery = supabaseAdmin
    .from("position_assignments")
    .select("id")
    .eq("team_id", teamId)
    .eq("session_name", session_name.trim());
  if (match_id) dupQuery.eq("match_id", match_id);
  else          dupQuery.is("match_id", null);
  const { data: dup } = await dupQuery.limit(1);
  if (dup && dup.length > 0) {
    return NextResponse.json({ error: `"${session_name}" 이름이 이미 있어요. 다른 이름을 사용해주세요.` }, { status: 409 });
  }

  // result에 담긴 member id가 실제 이 팀 소속인지 검증 — 아니면 미배정(null) 처리
  const safeResult = await sanitizeResult(result, teamId);

  const { data, error } = await supabaseAdmin
    .from("position_assignments")
    .insert({ user_id: userId, team_id: teamId, session_name: session_name.trim(), formation_name, formation_id, formation_slots, result: safeResult, match_id, attending_members: attending_members ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 배정 생성 시 자동으로 알리지 않음 — 관리자급이 "배정 알리기" 버튼을 눌러야 해당 쿼터만 알림 발송됨
  // (POST /api/assignments/[id]/notify 참고)

  return NextResponse.json(data);
}
