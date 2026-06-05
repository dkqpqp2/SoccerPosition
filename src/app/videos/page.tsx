"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { extractYouTubeId, ytThumb, ytEmbed, VIDEO_CATEGORIES, VideoCategory } from "@/lib/youtube";

interface Video {
  id: string;
  youtube_id: string;
  youtube_url: string;
  title: string;
  description: string | null;
  category: VideoCategory;
  author_name: string;
  member_id: string;
  created_at: string;
}

export default function VideosPage() {
  const { status, data: session } = useSession();
  const router = useRouter();

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // 추가 폼
  const [form, setForm] = useState({ url: "", title: "", description: "", category: "etc" as VideoCategory });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") fetchVideos();
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") fetchVideos();
  }, [category]);

  async function fetchVideos() {
    setLoading(true);
    const res = await fetch(`/api/videos?category=${category}`);
    const data = await res.json();
    setVideos(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function handleAdd() {
    setFormError("");
    if (!form.url.trim()) { setFormError("YouTube URL을 입력해주세요"); return; }
    if (!form.title.trim()) { setFormError("제목을 입력해주세요"); return; }
    if (!extractYouTubeId(form.url)) { setFormError("올바른 YouTube URL이 아니에요 (youtube.com/watch?v=... 또는 youtu.be/...)"); return; }

    setSaving(true);
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        youtube_url: form.url,
        title: form.title,
        description: form.description,
        category: form.category,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setFormError(data.error ?? "저장에 실패했어요"); return; }

    setShowAdd(false);
    setForm({ url: "", title: "", description: "", category: "etc" });
    fetchVideos();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 영상을 삭제할까요?")) return;
    setDeleting(id);
    await fetch(`/api/videos/${id}`, { method: "DELETE" });
    setDeleting(null);
    setVideos(prev => prev.filter(v => v.id !== id));
  }

  function formatDate(s: string) {
    const d = new Date(s);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  const catLabel = (c: string) => VIDEO_CATEGORIES.find(x => x.value === c)?.label ?? c;

  return (
    <AppLayout title="영상 추천">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-widest">팀 영상 라이브러리</p>
            <p className="text-xs text-gray-700 mt-0.5">팀원 누구나 영상을 추천할 수 있어요</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setFormError(""); }}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            + 영상 추천
          </button>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {VIDEO_CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                category === c.value
                  ? "bg-emerald-500 text-black"
                  : "bg-white/5 text-gray-500 hover:bg-white/10"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* 영상 그리드 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3 opacity-20">🎬</div>
            <p className="text-gray-600">아직 추천된 영상이 없어요</p>
            <p className="text-sm text-gray-700 mt-1">유용한 영상을 팀원들과 공유해보세요!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map(v => (
              <div
                key={v.id}
                className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors group"
              >
                {/* 썸네일 */}
                <div className="relative aspect-video bg-gray-800 cursor-pointer" onClick={() => setPlayingId(v.id)}>
                  {playingId === v.id ? (
                    <iframe
                      src={ytEmbed(v.youtube_id)}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ytThumb(v.youtube_id)}
                        alt={v.title}
                        className="w-full h-full object-cover"
                      />
                      {/* 재생 버튼 오버레이 */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                      {/* 카테고리 뱃지 */}
                      <span className="absolute top-2 left-2 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded-md">
                        {catLabel(v.category)}
                      </span>
                    </>
                  )}
                </div>

                {/* 정보 */}
                <div className="p-3">
                  <p className="text-sm font-semibold text-white line-clamp-2 leading-snug mb-1">{v.title}</p>
                  {v.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{v.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-600">{v.author_name}</span>
                      <span className="text-gray-700 text-[10px]">·</span>
                      <span className="text-[10px] text-gray-600">{formatDate(v.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={v.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                      >
                        YouTube ↗
                      </a>
                      {(v.member_id === session?.user?.id) && (
                        <button
                          onClick={() => handleDelete(v.id)}
                          disabled={deleting === v.id}
                          className="text-[10px] text-red-500/60 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                          {deleting === v.id ? "..." : "삭제"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 영상 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={() => setShowAdd(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white text-lg mb-5">🎬 영상 추천</h3>

            <div className="flex flex-col gap-3">
              {/* YouTube URL */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">YouTube URL *</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={e => {
                    setForm(p => ({ ...p, url: e.target.value }));
                    setFormError("");
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none placeholder-gray-600"
                  autoFocus
                />
                {/* URL 미리보기 */}
                {extractYouTubeId(form.url) && (
                  <div className="mt-2 rounded-xl overflow-hidden aspect-video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ytThumb(extractYouTubeId(form.url)!)}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* 제목 */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="예: 4-3-3 전술 완벽 분석"
                  className="w-full bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none placeholder-gray-600"
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">카테고리</label>
                <div className="flex flex-wrap gap-2">
                  {VIDEO_CATEGORIES.filter(c => c.value !== "all").map(c => (
                    <button
                      key={c.value}
                      onClick={() => setForm(p => ({ ...p, category: c.value as VideoCategory }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        form.category === c.value
                          ? "bg-emerald-500 text-black"
                          : "bg-white/5 text-gray-400 hover:bg-white/10"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 설명 */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">설명 (선택)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="이 영상을 추천하는 이유나 핵심 내용을 적어주세요"
                  rows={3}
                  className="w-full bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none placeholder-gray-600 resize-none"
                />
              </div>

              {formError && <p className="text-red-400 text-xs">{formError}</p>}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "추천하기"}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 font-medium py-2.5 rounded-xl transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
