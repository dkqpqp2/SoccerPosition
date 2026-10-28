import type { Metadata } from "next";
import { buildShareMetadata, formatKoDate, getScrimmagePreview, joinDescription } from "@/lib/sharePreview";

const SPORT_LABEL: Record<string, string> = { soccer: "축구", futsal: "풋살" };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = await getScrimmagePreview(id);
  if (!s) return { title: "공유된 내전" };

  return buildShareMetadata(
    `${s.title || "내전"} 팀 구성`,
    joinDescription([SPORT_LABEL[s.sport], formatKoDate(s.matchDate)], "SPM에서 공유한 내전 팀 구성이에요."),
    `/share/scrimmage/${id}`,
  );
}

export default function ShareScrimmageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
