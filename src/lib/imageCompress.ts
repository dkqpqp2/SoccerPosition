// 사진을 올리기 전에 브라우저에서 줄인다: 긴 변 1600px, JPEG 화질 82%. 폰 사진 한 장이 4MB 안팎에서 200~400KB 정도로 줄어
// 무료 서버의 저장 공간과 전송량을 아끼고, 서버 업로드 크기 제한(4MB)에도 걸리지 않는다.
const MAX_SIDE = 1600;
const QUALITY = 0.82;

/** 줄이지 못하거나(브라우저가 못 읽는 형식 등) 줄여도 더 커지면 원본을 그대로 돌려준다. */
export async function compressImage(file: File): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

    // 폰으로 세로로 찍은 사진이 눕지 않도록 촬영 방향을 반영한다
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff"; // 투명한 PNG가 JPEG로 바뀔 때 검게 되지 않도록 흰 배경
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
