import type { Metadata } from "next";
import LegalShell, { LegalSection } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "이용약관",
  description: "스포츠팀매니저(SPM) 서비스 이용약관과 커뮤니티 이용 규칙이에요.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalShell title="이용약관" updated="2026년 11월 14일">
      <LegalSection title="1. 서비스 소개">
        <p>스포츠팀매니저(SPM, 이하 &quot;서비스&quot;)는 풋살·축구 등 스포츠팀의 팀원 관리, 포지션 배정, 경기 기록, 회비, 투표를 돕는 서비스예요. 이 약관은 서비스를 이용하는 모든 분께 적용돼요.</p>
      </LegalSection>

      <LegalSection title="2. 계정">
        <ul className="list-disc list-inside space-y-1">
          <li>카카오 또는 Apple 계정으로 로그인해서 이용해요.</li>
          <li>계정과 팀 안의 활동에 대한 책임은 이용자 본인에게 있어요.</li>
          <li>마이페이지에서 언제든 회원 탈퇴를 할 수 있고, 탈퇴하면 개인정보가 삭제돼요.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. 커뮤니티 이용 규칙">
        <p>서비스에서 사진, 댓글 같은 콘텐츠를 올릴 때 아래 내용은 금지돼요.</p>
        <ul className="list-disc list-inside space-y-1">
          <li>욕설, 비하, 혐오, 괴롭힘, 위협</li>
          <li>음란하거나 폭력적인 내용, 불법 내용</li>
          <li>타인의 개인정보나 초상을 동의 없이 올리는 행위</li>
          <li>스팸, 광고, 사칭</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. 신고와 차단, 운영자의 조치">
        <ul className="list-disc list-inside space-y-1">
          <li>다른 이용자의 부적절한 사진·댓글은 &quot;신고&quot; 버튼으로 알릴 수 있고, 작성자를 차단하면 그 사람의 콘텐츠가 보이지 않아요.</li>
          <li>신고된 내용은 운영자가 24시간 안에 확인하고, 규칙에 어긋나면 삭제해요.</li>
          <li>규칙을 반복해서 어기면 서비스 이용을 제한할 수 있어요.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. 서비스 변경과 중단">
        <p>서비스는 기능을 추가·변경하거나 점검을 위해 일시 중단될 수 있어요. 중요한 변경은 서비스 안에서 미리 알려요.</p>
      </LegalSection>

      <LegalSection title="6. 책임의 한계">
        <p>이용자가 올린 콘텐츠의 책임은 올린 사람에게 있어요. 서비스는 이용자 간의 분쟁이나 팀 운영(회비 정산 등)에서 생기는 문제에 직접 개입하지 않아요. 서비스는 가능한 한 안정적으로 제공하려 노력하지만, 무료로 제공되는 만큼 데이터 손실이나 중단에 대한 책임에는 한계가 있어요.</p>
      </LegalSection>

      <LegalSection title="7. 문의">
        <p>약관과 서비스에 대한 문의는 <a href="mailto:dkqpqp2@gmail.com" className="text-emerald-400 hover:text-emerald-300">dkqpqp2@gmail.com</a>으로 보내 주세요.</p>
      </LegalSection>
    </LegalShell>
  );
}
