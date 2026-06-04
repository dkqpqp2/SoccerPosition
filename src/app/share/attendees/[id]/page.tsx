import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";

interface Member {
  id: string;
  name: string;
  position_1st: string | null;
  position_2nd: string | null;
  is_mercenary?: boolean;
  is_cafe_mercenary?: boolean;
  referrer?: string | null;
}

interface SharedData {
  members: Member[];
  match_info?: { match_date: string; title: string | null } | null;
}

export default async function ShareAttendeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("shared_lists")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const { members, match_info } = data.data as SharedData;
  const regular = members.filter(m => !m.is_mercenary);
  const mercenary = members.filter(m => m.is_mercenary);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <p className="text-green-600 font-bold text-lg">⚽ {data.team_name}</p>
          {match_info && (
            <p className="text-gray-500 text-sm mt-1">
              {formatDate(match_info.match_date)}
              {match_info.title && <span className="ml-1">· {match_info.title}</span>}
            </p>
          )}
          <h1 className="text-2xl font-black text-gray-800 mt-2">오늘 참가 인원</h1>
          <p className="text-gray-400 text-sm mt-1">총 {members.length}명</p>
        </div>

        {/* 정규 팀원 */}
        {regular.length > 0 && (
          <div className="bg-white rounded-2xl shadow mb-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-600">👥 정규 팀원 <span className="text-green-600">{regular.length}명</span></p>
            </div>
            <div className="divide-y divide-gray-50">
              {regular.map((m, i) => (
                <div key={m.id} className="flex items-center px-4 py-3 gap-3">
                  <span className="text-xs text-gray-300 w-5">{i + 1}</span>
                  <span className="flex-1 text-sm font-semibold text-gray-800">{m.name}</span>
                  <div className="flex gap-1">
                    {m.position_1st && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{m.position_1st}</span>}
                    {m.position_2nd && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{m.position_2nd}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 용병 */}
        {mercenary.length > 0 && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-orange-100">
              <p className="text-sm font-bold text-orange-500">⚡ 용병 <span>{mercenary.length}명</span></p>
            </div>
            <div className="divide-y divide-orange-50">
              {mercenary.map((m, i) => (
                <div key={m.id} className="flex items-center px-4 py-3 gap-3 bg-orange-50/30">
                  <span className="text-xs text-gray-300 w-5">{i + 1}</span>
                  <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-orange-700">{m.name}</span>
                    {m.is_cafe_mercenary
                      ? <span className="text-xs text-sky-500 bg-sky-50 px-1.5 py-0.5 rounded-full">☕카페</span>
                      : m.referrer
                      ? <span className="text-xs text-orange-400 bg-orange-100 px-1.5 py-0.5 rounded-full">{m.referrer}지인</span>
                      : null}
                  </div>
                  <div className="flex gap-1">
                    {m.position_1st && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{m.position_1st}</span>}
                    {m.position_2nd && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{m.position_2nd}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 mt-6">
          {new Date(data.created_at).toLocaleString("ko-KR")} 공유됨
        </p>
      </div>
    </div>
  );
}
