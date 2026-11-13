// 게시판(사진·건의함)은 서버 저장 공간이 한정돼 있어 지정한 팀(NEXT_PUBLIC_BOARD_TEAM_ID)만 쓴다.
// 화면에서 메뉴를 숨기는 것만으로는 API를 직접 부르는 것을 막지 못하므로, 서버에서도 같은 기준으로 막는다.
export function isBoardTeam(teamId: string | null | undefined): boolean {
  const allowed = process.env.NEXT_PUBLIC_BOARD_TEAM_ID;
  return Boolean(allowed) && teamId === allowed;
}

// 사진 업로드 제한: Vercel 함수는 요청 크기가 4.5MB를 넘으면 플랫폼이 거절하므로 그보다 작게 잡아 안내 문구를 보여준다.
export const GALLERY_MAX_BYTES = 4 * 1024 * 1024;
// 허용하는 이미지 형식과 저장할 확장자 (파일 이름의 확장자는 믿지 않는다)
export const GALLERY_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

// 팀당 사진 수 상한: 무료 저장 공간(약 1GB)을 한 팀이 다 쓰지 않게 한다. (줄인 사진 약 300KB × 300장 ≈ 90MB)
export const GALLERY_MAX_PHOTOS_PER_TEAM = 300;
// 올린 사진은 파일 이름이 매번 달라 바뀌지 않으므로 브라우저가 1년간 다시 내려받지 않게 한다 (초 단위)
export const GALLERY_CACHE_SECONDS = "31536000";
