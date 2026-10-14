import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "팀 가입",
  description: "초대 코드로 SPM 팀에 가입하세요.",
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
