/** YouTube URL에서 video ID 추출 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,           // youtube.com/watch?v=
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,        // youtu.be/
    /embed\/([a-zA-Z0-9_-]{11})/,            // youtube.com/embed/
    /shorts\/([a-zA-Z0-9_-]{11})/,           // youtube.com/shorts/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** YouTube 썸네일 URL */
export function ytThumb(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

/** YouTube 임베드 URL */
export function ytEmbed(videoId: string) {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
}

/** YouTube 원본 URL */
export function ytUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export const VIDEO_CATEGORIES = [
  { value: "all",       label: "전체" },
  { value: "tactics",   label: "⚽ 전술/포메이션" },
  { value: "position",  label: "🎯 포지션" },
  { value: "training",  label: "💪 훈련/체력" },
  { value: "mental",    label: "🧠 멘탈/집중" },
  { value: "etc",       label: "📌 기타" },
] as const;

export type VideoCategory = "tactics" | "position" | "training" | "mental" | "etc";
