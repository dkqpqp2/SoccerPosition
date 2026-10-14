import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "SPM이 수집하는 개인정보의 항목, 이용 목적, 보관 기간과 이용자의 권리를 안내합니다.",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
