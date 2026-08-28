const PROFANITY_WORDS = [
  "시발", "씨발", "씨팔", "시팔", "씨바", "시바", "씨불", "시불",
  "개새끼", "개새기", "개새키", "개색기", "개색끼",
  "병신", "븅신", "ㅄ",
  "지랄", "좆", "존나", "졸라",
  "썅", "쌍놈", "쌍년",
  "fuck", "shit", "bitch", "asshole",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

/** 제목/내용에 비속어가 포함되어 있는지 확인 */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  return PROFANITY_WORDS.some(word => normalized.includes(word));
}
