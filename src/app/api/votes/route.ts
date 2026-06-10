import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";
import { sendPushToTeam } from "@/lib/push";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { data: votes, error } = await supabaseAdmin
    .from("votes")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!votes?.length) return NextResponse.json([]);

  const voteIds = votes.map((v) => v.id);

  // 선택지 + 응답 + 댓글 + 팀원 수 병렬 조회
  const [
    { data: options },
    { data: responses },
    { data: comments },
    { count: memberCount },
  ] = await Promise.all([
    supabaseAdmin.from("vote_options").select("*").in("vote_id", voteIds).order("order_num"),
    supabaseAdmin.from("vote_responses").select("*").in("vote_id", voteIds),
    supabaseAdmin.from("vote_comments").select("*").in("vote_id", voteIds).order("created_at", { ascending: true }),
    supabaseAdmin.from("team_users").select("*", { count: "exact", head: true }).eq("team_id", teamId),
  ]);

  // 투표자 + 작성자 + 댓글 작성자 이름 한 번에 조회
  const voterIds = [...new Set((responses ?? []).map((r) => r.user_id))];
  const creatorIds = [...new Set(votes.map((v) => v.created_by).filter(Boolean))];
  const commenterIds = [...new Set((comments ?? []).map((c) => c.user_id))];
  const allUserIds = [...new Set([...voterIds, ...creatorIds, ...commenterIds])];

  const { data: userData } =
    allUserIds.length > 0
      ? await supabaseAdmin.from("users").select("id, name").in("id", allUserIds)
      : { data: [] };

  const userMap: Record<string, string> = {};
  (userData ?? []).forEach((u) => { userMap[u.id] = u.name; });

  const result = votes.map((vote) => {
    const voteOptions = (options ?? [])
      .filter((o) => o.vote_id === vote.id)
      .sort((a, b) => a.order_num - b.order_num);

    const voteResponses = (responses ?? []).filter((r) => r.vote_id === vote.id);
    const myResponses = voteResponses.filter((r) => r.user_id === userId).map((r) => r.option_id);

    const optionCounts = voteOptions.map((opt) => {
      const optionResponses = voteResponses.filter((r) => r.option_id === opt.id);
      return {
        ...opt,
        count: optionResponses.length,
        voters: optionResponses.map((r) => ({
          user_id: r.user_id,
          name: userMap[r.user_id] ?? "알 수 없음",
        })),
      };
    });

    const uniqueVoters = new Set(voteResponses.map((r) => r.user_id)).size;

    const voteComments = (comments ?? [])
      .filter((c) => c.vote_id === vote.id)
      .map((c) => ({
        id: c.id,
        user_id: c.user_id,
        user_name: userMap[c.user_id] ?? "알 수 없음",
        content: c.content,
        created_at: c.created_at,
        is_mine: c.user_id === userId,
      }));

    return {
      ...vote,
      created_by_name: vote.created_by ? (userMap[vote.created_by] ?? null) : null,
      options: optionCounts,
      my_responses: myResponses,
      total_voters: uniqueVoters,
      team_member_count: memberCount ?? 0,
      comments: voteComments,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (role !== "owner") return NextResponse.json({ error: "관리자만 투표를 생성할 수 있습니다" }, { status: 403 });

  const { title, description, vote_date, end_at, is_multiple, options } = await req.json();

  if (!title?.trim()) return NextResponse.json({ error: "제목은 필수입니다" }, { status: 400 });
  const validOptions = (options ?? []).filter((o: string) => o?.trim());
  if (validOptions.length < 2) return NextResponse.json({ error: "선택지를 최소 2개 입력해주세요" }, { status: 400 });

  const { data: vote, error } = await supabaseAdmin
    .from("votes")
    .insert({
      team_id: teamId,
      title: title.trim(),
      description: description?.trim() || null,
      vote_date: vote_date || null,
      end_at: end_at || null,
      is_multiple: is_multiple ?? false,
      created_by: userId,
      status: "open",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: optErr } = await supabaseAdmin.from("vote_options").insert(
    validOptions.map((label: string, i: number) => ({
      vote_id: vote.id,
      label: label.trim(),
      order_num: i,
    }))
  );

  if (optErr) return NextResponse.json({ error: optErr.message }, { status: 500 });

  // ── 팀원 전체에게 알림 전송 (작성자 본인 제외) ──
  try {
    const { data: members } = await supabaseAdmin
      .from("team_users")
      .select("user_id")
      .eq("team_id", teamId)
      .neq("user_id", userId);

    if (members && members.length > 0) {
      const notifications = members.map((m) => ({
        user_id: m.user_id,
        type: "vote_created",
        title: "새 투표가 등록됐어요 🗳️",
        body: `"${vote.title}" 투표에 참여해보세요!`,
        link: "/votes",
        is_read: false,
      }));
      await supabaseAdmin.from("notifications").insert(notifications);
    }
  } catch (e) {
    console.error("vote notification error:", e);
  }

  // 푸시 알림 발송
  sendPushToTeam(teamId, {
    title: "새 투표가 등록됐어요 🗳️",
    body: `"${vote.title}" 투표에 참여해보세요!`,
    url: "/votes",
  }, userId).catch(console.error);

  return NextResponse.json(vote);
}
