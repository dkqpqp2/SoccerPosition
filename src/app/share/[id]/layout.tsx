import type { Metadata } from "next";
import { buildShareMetadata, formatKoDate, getAssignmentPreview, joinDescription } from "@/lib/sharePreview";

// 페이지가 클라이언트 컴포넌트라 메타데이터는 같은 폴더의 layout에서 만든다 (카톡 미리보기용)
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const a = await getAssignmentPreview(id);
  if (!a) return { title: "공유된 배정" };

  return buildShareMetadata(
    `${a.sessionName} 라인업 · ${a.formationName}`,
    joinDescription([a.match?.title, formatKoDate(a.match?.match_date)], "SPM에서 공유한 포지션 배정이에요. 라인업을 확인해 보세요."),
    `/share/${id}`,
    true, // 같은 폴더의 opengraph-image.tsx(포메이션 구장 그림)를 사용
  );
}

export default function ShareAssignmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
