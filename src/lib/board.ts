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
