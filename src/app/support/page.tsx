import type { Metadata } from "next";
import Link from "next/link";
import LegalShell, { LegalSection } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "고객 지원",
  description: "스포츠팀매니저(SPM) 사용 방법과 자주 묻는 질문, 문의 방법을 안내해요.",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <LegalShell title="고객 지원">
      <LegalSection title="문의하기">
        <p>
          사용 중 불편한 점이나 궁금한 점, 신고하고 싶은 내용은 아래 이메일로 보내 주세요. 보통 영업일 기준 1~2일 안에 답변드려요.
          부적절한 콘텐츠 신고는 <b className="text-white">24시간 안에</b> 확인하고 조치해요.
        </p>
        <p>
          <a href="mailto:dkqpqp2@gmail.com" className="text-emerald-400 hover:text-emerald-300 font-bold">dkqpqp2@gmail.com</a>
        </p>
        <p>문의할 때 사용 중인 기기(아이폰/안드로이드/웹)와 어떤 화면에서 문제가 생겼는지 함께 알려 주시면 더 빨리 도와드릴 수 있어요.</p>
      </LegalSection>

      <LegalSection title="자주 묻는 질문">
        <div className="space-y-4">
          <div>
            <p className="font-bold text-white">로그인은 어떻게 하나요?</p>
            <p>카카오 계정 또는 Apple 계정으로 로그인해요. 처음 로그인하면 내 팀이 자동으로 만들어져요.</p>
          </div>
          <div>
            <p className="font-bold text-white">팀원은 어떻게 초대하나요?</p>
            <p>팀 화면에서 초대 코드나 링크를 만들어 카카오톡 등으로 보내세요. 받은 사람이 링크를 열고 로그인하면 팀에 합류해요.</p>
          </div>
          <div>
            <p className="font-bold text-white">알림이 오지 않아요.</p>
            <p>
              앱에서는 마이페이지의 &quot;앱 알림&quot;에서 알림을 켤 수 있어요. 폰에서 차단되어 있다면 기기 설정의 앱 알림 허용을 확인해 주세요.
              웹과 홈 화면에 추가한 웹앱은 마이페이지의 &quot;알림 설정&quot;을 확인해 주세요.
            </p>
          </div>
          <div>
            <p className="font-bold text-white">불쾌한 사진이나 댓글을 신고하거나 차단하려면요?</p>
            <p>사진이나 댓글 옆의 &quot;신고&quot; 버튼을 눌러 사유를 고르거나 작성자를 차단할 수 있어요. 차단한 사용자는 마이페이지의 &quot;차단한 사용자&quot;에서 해제할 수 있어요.</p>
          </div>
          <div>
            <p className="font-bold text-white">회원 탈퇴는 어떻게 하나요?</p>
            <p>마이페이지 맨 아래의 &quot;회원 탈퇴&quot;에서 직접 할 수 있어요. 탈퇴하면 이름·이메일·사진 등 개인정보가 삭제되고, 팀의 경기 기록에는 &quot;탈퇴한 회원&quot;으로 남아요.</p>
          </div>
          <div>
            <p className="font-bold text-white">비용이 드나요?</p>
            <p>지금은 무료예요. 광고도 없어요.</p>
          </div>
        </div>
      </LegalSection>

      <LegalSection title="관련 안내">
        <p>
          <Link href="/terms" className="text-emerald-400 hover:text-emerald-300">이용약관</Link>
          {" · "}
          <Link href="/privacy" className="text-emerald-400 hover:text-emerald-300">개인정보처리방침</Link>
        </p>
      </LegalSection>
    </LegalShell>
  );
}
