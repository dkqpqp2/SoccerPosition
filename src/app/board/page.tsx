"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";

const CURRENT_YEAR = new Date().getFullYear();
const CATEGORIES   = ["전체", "회식", "야유회", "경기", "기타"] as const;
const UP_CATS      = ["회식", "야유회", "경기", "기타"] as const;
const MAX_PHOTOS   = 5;

type Tab = "gallery" | "board";

interface Photo {
  id: string;
  group_id: string | null;
  title: string;
  description: string | null;
  image_url: string;
  year: number;
  category: string;
  author_name: string;
  member_id: string | null;
  created_at: string;
}

interface PhotoGroup {
  group_id: string;
  title: string;
  description: string | null;
  category: string;
  year: number;
  author_name: string;
  member_id: string | null;
  created_at: string;
  photos: Photo[];
}

interface Post {
  id: string;
  title: string;
  content: string;
  author_name: string;
  is_anonymous: boolean;
  member_id: string | null;
  created_at: string;
}

const inputCls = "w-full bg-gray-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600";

/** 사진 배열을 group_id 기준으로 묶기 (없으면 photo.id가 키) */
function groupPhotos(photos: Photo[]): PhotoGroup[] {
  const map = new Map<string, PhotoGroup>();
  // API는 created_at DESC로 오므로 순서 유지하면 최신순이 됨
  for (const photo of photos) {
    const key = photo.group_id ?? photo.id;
    if (!map.has(key)) {
      map.set(key, {
        group_id:    key,
        title:       photo.title,
        description: photo.description,
        category:    photo.category,
        year:        photo.year,
        author_name: photo.author_name,
        member_id:   photo.member_id,
        created_at:  photo.created_at,
        photos:      [],
      });
    }
    map.get(key)!.photos.push(photo);
  }
  return Array.from(map.values());
}

export default function BoardPage() {
  const { status } = useSession();
  const router     = useRouter();

  const [tab,         setTab]         = useState<Tab>("gallery");
  const [myMemberId,  setMyMemberId]  = useState<string | null>(null);
  const [userRole,    setUserRole]    = useState<string | null>(null);

  /* ── 갤러리 state ── */
  const [photos,           setPhotos]           = useState<Photo[]>([]);
  const [galleryYear,      setGalleryYear]      = useState(CURRENT_YEAR);
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");

  /* 게시물 상세 보기 */
  const [detailGroup,    setDetailGroup]    = useState<PhotoGroup | null>(null);
  const [detailPhotoIdx, setDetailPhotoIdx] = useState(0);

  /* 업로드 state */
  const [showUpload,  setShowUpload]  = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [uploadStep,  setUploadStep]  = useState(0);
  const [upTitle,     setUpTitle]     = useState("");
  const [upDesc,      setUpDesc]      = useState("");
  const [upYear,      setUpYear]      = useState(CURRENT_YEAR);
  const [upCat,       setUpCat]       = useState<string>("기타");
  const [upFiles,     setUpFiles]     = useState<File[]>([]);
  const [upPreviews,  setUpPreviews]  = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── 건의함 state ── */
  const [posts,       setPosts]       = useState<Post[]>([]);
  const [showWrite,   setShowWrite]   = useState(false);
  const [pTitle,      setPTitle]      = useState("");
  const [pContent,    setPContent]    = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [pLoading,    setPLoading]    = useState(false);

  const isStaff = ["owner", "manager", "president"].includes(userRole ?? "");

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/"); return; }
    if (status === "authenticated")   { init(); }
  }, [status]);

  useEffect(() => { fetchPhotos(); }, [galleryYear]);

  async function init() {
    const res     = await fetch("/api/user/profile");
    const profile = await res.json();
    setUserRole(profile.role ?? null);
    setMyMemberId(profile.member_id ?? null);
    fetchPhotos();
    fetchPosts();
  }

  async function fetchPhotos() {
    const res  = await fetch(`/api/board/gallery?year=${galleryYear}`);
    const data = await res.json();
    setPhotos(Array.isArray(data) ? data : []);
  }

  async function fetchPosts() {
    const res  = await fetch("/api/board/posts");
    const data = await res.json();
    setPosts(Array.isArray(data) ? data : []);
  }

  /* 파일 선택 */
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    const canAdd   = MAX_PHOTOS - upFiles.length;
    const newFiles = selected.slice(0, canAdd);
    setUpFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setUpPreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(idx: number) {
    setUpFiles(prev    => prev.filter((_, i) => i !== idx));
    setUpPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  function resetUpload() {
    setShowUpload(false);
    setUpTitle(""); setUpDesc(""); setUpFiles([]); setUpPreviews([]);
    setUpCat("기타"); setUpYear(CURRENT_YEAR);
    setUploadError(""); setUploadStep(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  /* 사진 업로드 — 함께 올리는 사진은 같은 group_id 공유 */
  async function uploadPhotos(e: React.FormEvent) {
    e.preventDefault();
    if (upFiles.length === 0 || !upTitle.trim()) return;

    setUploading(true);
    setUploadError("");

    const groupId = crypto.randomUUID(); // 이 업로드 묶음의 공유 ID

    for (let i = 0; i < upFiles.length; i++) {
      setUploadStep(i + 1);

      const fd = new FormData();
      fd.append("file",        upFiles[i]);
      fd.append("title",       upTitle.trim()); // 모두 같은 제목
      fd.append("description", upDesc.trim());
      fd.append("year",        String(upYear));
      fd.append("category",    upCat);
      fd.append("group_id",    groupId);        // 묶음 ID

      const res = await fetch("/api/board/gallery", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setUploadError(`${i + 1}번째 사진 업로드 실패: ${err.error ?? "알 수 없는 오류"}`);
        setUploading(false);
        return;
      }
    }

    setUploading(false);
    resetUpload();
    fetchPhotos();
  }

  /* 게시물(그룹) 전체 삭제 */
  async function deleteGroup(group: PhotoGroup) {
    if (!confirm(`"${group.title}" 게시물을 삭제할까요?\n사진 ${group.photos.length}장이 모두 삭제됩니다.`)) return;
    for (const photo of group.photos) {
      await fetch(`/api/board/gallery/${photo.id}`, { method: "DELETE" });
    }
    setDetailGroup(null);
    fetchPhotos();
  }

  /* 건의 등록 */
  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!pTitle.trim() || !pContent.trim()) return;
    setPLoading(true);
    await fetch("/api/board/posts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title: pTitle.trim(), content: pContent.trim(), is_anonymous: isAnonymous }),
    });
    setPLoading(false);
    setShowWrite(false);
    setPTitle(""); setPContent(""); setIsAnonymous(false);
    fetchPosts();
  }

  async function deletePost(id: string) {
    if (!confirm("삭제할까요?")) return;
    await fetch(`/api/board/posts/${id}`, { method: "DELETE" });
    fetchPosts();
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  }

  const allGroups      = groupPhotos(photos);
  const filteredGroups = selectedCategory === "전체"
    ? allGroups
    : allGroups.filter(g => g.category === selectedCategory);

  return (
    <AppLayout title="게시판">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* 탭 */}
        <div className="flex bg-gray-900 border border-white/5 rounded-xl p-1 mb-5">
          {([["gallery", "📸 사진"], ["board", "📢 건의함"]] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 text-sm font-bold py-2 rounded-lg transition-colors ${
                tab === key ? "bg-emerald-500 text-black" : "text-gray-500 hover:text-white"
              }`}>{label}</button>
          ))}
        </div>

        {/* ══════ 사진 탭 ══════ */}
        {tab === "gallery" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1">
                <button onClick={() => setGalleryYear(y => y - 1)}
                  className="w-8 h-8 flex items-center justify-center bg-gray-900 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded-xl transition-colors text-sm">‹</button>
                <span className="text-white font-bold text-sm px-2">{galleryYear}년</span>
                <button onClick={() => setGalleryYear(y => y + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-gray-900 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded-xl transition-colors text-sm">›</button>
              </div>
              <button onClick={() => setShowUpload(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors">
                + 사진 올리기
              </button>
            </div>

            {/* 카테고리 필터 */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    selectedCategory === cat
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-white/3 text-gray-500 border-white/5 hover:text-white"
                  }`}>{cat}</button>
              ))}
            </div>

            {filteredGroups.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-3 opacity-20">📸</div>
                <p className="text-gray-600">{galleryYear}년 사진이 없어요</p>
                <button onClick={() => setShowUpload(true)}
                  className="mt-3 text-sm text-emerald-400 hover:underline">첫 사진 올리기 →</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredGroups.map(group => (
                  <button key={group.group_id}
                    onClick={() => { setDetailGroup(group); setDetailPhotoIdx(0); }}
                    className="rounded-xl overflow-hidden bg-gray-800 relative group cursor-pointer text-left">
                    <div className="aspect-square relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={group.photos[0].image_url} alt={group.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      {/* 그라디언트 오버레이 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                      {/* 카테고리 배지 */}
                      <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                        {group.category}
                      </span>

                      {/* 사진 장수 배지 (2장 이상일 때만) */}
                      {group.photos.length > 1 && (
                        <span className="absolute top-2 right-2 text-[10px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <span>📷</span>{group.photos.length}
                        </span>
                      )}

                      {/* 제목 + 날짜 (항상 표시) */}
                      <div className="absolute bottom-0 left-0 right-0 p-2.5">
                        <p className="text-xs text-white font-bold truncate">{group.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(group.created_at)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════ 건의함 탭 ══════ */}
        {tab === "board" && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowWrite(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors">
                ✏️ 건의하기
              </button>
            </div>

            {posts.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-3 opacity-20">📢</div>
                <p className="text-gray-600">아직 건의 사항이 없어요</p>
                <button onClick={() => setShowWrite(true)}
                  className="mt-3 text-sm text-emerald-400 hover:underline">첫 건의 남기기 →</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {posts.map(post => {
                  const canDelete = isStaff || post.member_id === myMemberId;
                  const expanded  = expandedId === post.id;
                  return (
                    <div key={post.id} className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
                      <button className="w-full text-left px-4 py-4 hover:bg-white/3 transition-colors"
                        onClick={() => setExpandedId(expanded ? null : post.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{post.title}</p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {post.is_anonymous ? "익명" : post.author_name} · {formatDate(post.created_at)}
                            </p>
                          </div>
                          <span className={`text-gray-500 text-xs shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▼</span>
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-4 pb-4 border-t border-white/5">
                          <p className="text-sm text-gray-300 whitespace-pre-wrap mt-3 leading-relaxed">{post.content}</p>
                          {canDelete && (
                            <button onClick={() => deletePost(post.id)}
                              className="mt-3 text-xs text-red-400 hover:text-red-300 transition-colors">삭제</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════ 사진 업로드 모달 ══════ */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto"
          onClick={() => !uploading && resetUpload()}>
          <div className="flex min-h-full items-end sm:items-center justify-center px-4 py-0 sm:py-6">
          <form onSubmit={uploadPhotos}
            className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}>

            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-white">📸 사진 올리기</h3>
                <p className="text-[11px] text-gray-600 mt-0.5">최대 {MAX_PHOTOS}장까지 선택 가능</p>
              </div>
              <button type="button" onClick={() => !uploading && resetUpload()}
                className="text-gray-500 hover:text-white text-xl font-bold">✕</button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">

              {/* 사진 선택 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-semibold">사진 선택 ({upFiles.length}/{MAX_PHOTOS})</p>
                  {upFiles.length < MAX_PHOTOS && (
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">+ 추가</button>
                  )}
                </div>

                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFileChange} />

                {upPreviews.length === 0 ? (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full h-36 border-2 border-dashed border-white/10 hover:border-emerald-500/40 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-emerald-400 transition-colors">
                    <span className="text-3xl">📷</span>
                    <span className="text-xs font-medium">이미지 선택 (1~{MAX_PHOTOS}장)</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {upPreviews.map((src, i) => (
                      <div key={i} className="aspect-square rounded-xl overflow-hidden relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/70 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-red-500/80 transition-colors">✕</button>
                        <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1 py-0.5 rounded-full">{i + 1}</span>
                      </div>
                    ))}
                    {upFiles.length < MAX_PHOTOS && (
                      <button type="button" onClick={() => fileRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-emerald-500/30 flex flex-col items-center justify-center gap-1 text-gray-600 hover:text-emerald-400 transition-colors">
                        <span className="text-2xl">+</span>
                        <span className="text-[10px]">추가</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 제목 */}
              <input type="text" value={upTitle} onChange={e => setUpTitle(e.target.value)}
                placeholder="제목 (예: 6월 회식)" required className={inputCls} />

              {/* 설명 */}
              <textarea value={upDesc} onChange={e => setUpDesc(e.target.value)}
                placeholder="설명 (선택)" rows={2} className={`${inputCls} resize-none`} />

              {/* 연도 / 카테고리 */}
              <div className="grid grid-cols-2 gap-2">
                <select value={upYear} onChange={e => setUpYear(Number(e.target.value))} className={inputCls}>
                  {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
                <select value={upCat} onChange={e => setUpCat(e.target.value)} className={inputCls}>
                  {UP_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {uploadError && (
                <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-xl">{uploadError}</p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-white/5 shrink-0">
              <button type="submit"
                disabled={upFiles.length === 0 || !upTitle.trim() || uploading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-colors">
                {uploading
                  ? `업로드 중... (${uploadStep}/${upFiles.length})`
                  : upFiles.length > 1 ? `${upFiles.length}장 올리기` : "올리기"}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* ══════ 건의 작성 모달 ══════ */}
      {showWrite && (
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto"
          onClick={() => setShowWrite(false)}>
          <div className="flex min-h-full items-end sm:items-center justify-center px-4 py-0 sm:py-6">
          <form onSubmit={submitPost}
            className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-white">📢 건의하기</h3>
              <button type="button" onClick={() => setShowWrite(false)}
                className="text-gray-500 hover:text-white text-xl font-bold">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <input type="text" value={pTitle} onChange={e => setPTitle(e.target.value)}
                placeholder="제목" required className={inputCls} />
              <textarea value={pContent} onChange={e => setPContent(e.target.value)}
                placeholder="건의 내용을 적어주세요" required rows={5}
                className={`${inputCls} resize-none`} />
              <button type="button" onClick={() => setIsAnonymous(p => !p)}
                className="flex items-center gap-2.5">
                <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${isAnonymous ? "bg-emerald-500" : "bg-gray-700"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isAnonymous ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-gray-400 select-none">익명으로 올리기</span>
              </button>
            </div>
            <div className="px-5 py-4 border-t border-white/5">
              <button type="submit" disabled={!pTitle.trim() || !pContent.trim() || pLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-colors">
                {pLoading ? "등록 중..." : "건의하기"}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* ══════ 게시물 상세 보기 모달 ══════ */}
      {detailGroup && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col"
          onClick={() => setDetailGroup(null)}>
          <div className="flex flex-col h-full max-w-lg mx-auto w-full"
            onClick={e => e.stopPropagation()}>

            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold text-base truncate">{detailGroup.title}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  <span className="bg-white/10 px-1.5 py-0.5 rounded-full mr-1.5">{detailGroup.category}</span>
                  {detailGroup.author_name} · {formatDate(detailGroup.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {(isStaff || detailGroup.member_id === myMemberId) && (
                  <button onClick={() => deleteGroup(detailGroup)}
                    className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-xl transition-colors">
                    삭제
                  </button>
                )}
                <button onClick={() => setDetailGroup(null)}
                  className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white rounded-full transition-colors text-lg">
                  ✕
                </button>
              </div>
            </div>

            {/* 메인 사진 영역 */}
            <div className="flex-1 relative min-h-0 flex items-center justify-center px-12">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={detailGroup.photos[detailPhotoIdx]?.image_url}
                alt=""
                className="max-w-full max-h-full object-contain rounded-xl"
                style={{ maxHeight: "calc(100vh - 220px)" }}
              />

              {/* 이전/다음 버튼 */}
              {detailGroup.photos.length > 1 && (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); setDetailPhotoIdx(i => Math.max(0, i - 1)); }}
                    disabled={detailPhotoIdx === 0}
                    className="absolute left-1 w-10 h-10 bg-black/60 hover:bg-black/80 disabled:opacity-20 text-white rounded-full flex items-center justify-center transition-all text-xl">
                    ‹
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setDetailPhotoIdx(i => Math.min(detailGroup.photos.length - 1, i + 1)); }}
                    disabled={detailPhotoIdx === detailGroup.photos.length - 1}
                    className="absolute right-1 w-10 h-10 bg-black/60 hover:bg-black/80 disabled:opacity-20 text-white rounded-full flex items-center justify-center transition-all text-xl">
                    ›
                  </button>
                </>
              )}
            </div>

            {/* 설명 + 페이지 번호 */}
            <div className="shrink-0 px-4 py-2 text-center">
              {detailGroup.photos.length > 1 && (
                <p className="text-gray-600 text-xs mb-1">
                  {detailPhotoIdx + 1} / {detailGroup.photos.length}
                </p>
              )}
              {detailGroup.description && (
                <p className="text-gray-400 text-sm">{detailGroup.description}</p>
              )}
            </div>

            {/* 썸네일 줄 (2장 이상일 때) */}
            {detailGroup.photos.length > 1 && (
              <div className="shrink-0 flex gap-2 px-4 pb-6 overflow-x-auto justify-center">
                {detailGroup.photos.map((photo, i) => (
                  <button key={photo.id}
                    onClick={e => { e.stopPropagation(); setDetailPhotoIdx(i); }}
                    className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${
                      i === detailPhotoIdx
                        ? "ring-2 ring-emerald-400 opacity-100 scale-110"
                        : "opacity-50 hover:opacity-75"
                    }`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
