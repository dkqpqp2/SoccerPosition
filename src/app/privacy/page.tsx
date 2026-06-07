"use client";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 헤더 */}
      <header className="bg-gray-900 border-b border-white/5 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <span className="text-2xl">⚽</span>
          <div>
            <p className="font-black text-white text-sm">SPM</p>
            <p className="text-gray-500 text-xs">Soccer Position Management</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-black text-white">개인정보처리방침</h1>
          <p className="text-gray-500 text-sm mt-2">최종 수정일: 2026년 6월 6일</p>
        </div>

        <Section title="1. 개요">
          <p>
            SPM(Soccer Position Management, 이하 &quot;서비스&quot;)은 사용자의 개인정보를 소중히 여기며,
            「개인정보 보호법」 및 관련 법령을 준수합니다.
            본 방침은 서비스가 수집하는 개인정보의 항목, 수집 목적, 보유 기간, 제3자 제공 여부 등을 안내합니다.
          </p>
        </Section>

        <Section title="2. 수집하는 개인정보 항목">
          <ul className="list-disc list-inside space-y-1">
            <li>카카오 계정 정보: 이름, 이메일 주소, 프로필 사진</li>
            <li>서비스 이용 정보: 팀 이름, 팀원 정보(이름·포지션), 경기 기록</li>
            <li>접속 로그: IP 주소, 접속 일시, 서비스 이용 기록</li>
          </ul>
        </Section>

        <Section title="3. 개인정보 수집 및 이용 목적">
          <ul className="list-disc list-inside space-y-1">
            <li>회원 가입 및 로그인 처리</li>
            <li>팀 포지션 배정, 경기 관리, 통계 등 서비스 핵심 기능 제공</li>
            <li>서비스 운영 및 이용자 문의 처리</li>
            <li>서비스 품질 개선 및 오류 분석</li>
          </ul>
        </Section>

        <Section title="4. 개인정보 보유 및 이용 기간">
          <ul className="list-disc list-inside space-y-1">
            <li>회원 탈퇴 시 즉시 삭제</li>
            <li>단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관</li>
            <li>전자상거래법에 따른 거래 기록: 5년</li>
            <li>로그인 기록: 3개월</li>
          </ul>
        </Section>

        <Section title="5. 개인정보의 제3자 제공">
          <p>
            서비스는 원칙적으로 사용자의 개인정보를 제3자에게 제공하지 않습니다.
            다만, 아래의 경우는 예외로 합니다.
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>사용자가 사전에 동의한 경우</li>
            <li>법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
          </ul>
        </Section>

        <Section title="6. 개인정보 처리 위탁">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-gray-400 font-semibold">수탁업체</th>
                  <th className="text-left py-2 text-gray-400 font-semibold">위탁 업무</th>
                </tr>
              </thead>
              <tbody className="space-y-1">
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-gray-300">Kakao Corp.</td>
                  <td className="py-2 text-gray-300">소셜 로그인 인증</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-gray-300">Supabase Inc.</td>
                  <td className="py-2 text-gray-300">데이터베이스 저장 및 관리</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-gray-300">Vercel Inc.</td>
                  <td className="py-2 text-gray-300">서비스 호스팅</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="7. 이용자 권리">
          <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>개인정보 열람 요청</li>
            <li>개인정보 정정·삭제 요청</li>
            <li>개인정보 처리 정지 요청</li>
            <li>서비스 내 계정 삭제(탈퇴)를 통한 개인정보 삭제</li>
          </ul>
          <p className="mt-2">
            요청은 아래 이메일로 문의해 주세요.
          </p>
        </Section>

        <Section title="8. 쿠키(Cookie) 사용">
          <p>
            서비스는 로그인 상태 유지를 위해 세션 쿠키를 사용합니다.
            브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 로그인 등 일부 서비스 이용이 제한될 수 있습니다.
          </p>
        </Section>

        <Section title="9. 개인정보 보호책임자">
          <div className="space-y-1">
            <p><span className="text-gray-400">서비스명:</span> SPM (Soccer Position Management)</p>
            <p><span className="text-gray-400">이메일:</span> dkqpqp2@gmail.com</p>
          </div>
        </Section>

        <Section title="10. 방침 변경 안내">
          <p>
            본 개인정보처리방침은 법령·정책 변경 또는 서비스 변경에 따라 내용이 변경될 수 있습니다.
            변경 시 서비스 내 공지사항을 통해 안내드립니다.
          </p>
        </Section>

        <div className="pt-4 border-t border-white/5 text-center">
          <p className="text-gray-600 text-xs">본 방침은 2026년 6월 6일부터 적용됩니다.</p>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-gray-900 border border-white/5 rounded-2xl p-6 space-y-3">
      <h2 className="font-bold text-emerald-400 text-base">{title}</h2>
      <div className="text-gray-300 text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
