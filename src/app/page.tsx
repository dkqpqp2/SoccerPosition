"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SpmLogo from "@/components/SpmLogo";

const FEATURES = [
  {
    icon: "🎯",
    title: "포지션 배정",
    desc: "드래그앤드롭으로 선수를 포지션에 배치하세요. 용병·카페 멤버 구분, 출전 명단 자동 정리.",
    color: "emerald",
  },
  {
    icon: "🟩",
    title: "포메이션 관리",
    desc: "4-3-3, 4-4-2 등 나만의 포메이션을 저장하고 재사용. 포지션별 슬롯 커스터마이징.",
    color: "sky",
  },
  {
    icon: "📅",
    title: "경기 일정 관리",
    desc: "경기 일정 등록부터 참석 여부 확인까지. 출전 가능 인원을 한눈에 파악.",
    color: "violet",
  },
  {
    icon: "📝",
    title: "경기 피드백",
    desc: "감독·코치가 쿼터별로 선수 개인 피드백 작성. 팀 전체 피드백도 함께 공유.",
    color: "amber",
  },
  {
    icon: "📊",
    title: "팀 통계",
    desc: "누가 얼마나 출전했는지 자동 집계. 포지션별 출전 기록으로 균형잡힌 운영.",
    color: "rose",
  },
  {
    icon: "🎬",
    title: "영상 추천",
    desc: "팀원 누구나 유용한 YouTube 영상 추천. 전술, 포지션, 훈련 카테고리별 라이브러리.",
    color: "pink",
  },
  {
    icon: "💬",
    title: "팀 게시판",
    desc: "공지, 자유글, 투표 등 팀 전용 커뮤니티. 팀원들과 소통을 한 곳에서.",
    color: "cyan",
  },
  {
    icon: "🔗",
    title: "간편 공유",
    desc: "포메이션과 피드백을 링크 하나로 공유. 카카오톡, 단톡방에 바로 붙여넣기.",
    color: "teal",
  },
];

const STEPS = [
  {
    num: "01",
    title: "팀 만들기",
    desc: "카카오 로그인 후 팀을 생성하고 팀원을 초대하세요. 1분이면 완료.",
  },
  {
    num: "02",
    title: "포메이션 설정",
    desc: "우리 팀 스타일에 맞는 포메이션을 만들고 포지션별 선수를 저장하세요.",
  },
  {
    num: "03",
    title: "경기 운영",
    desc: "경기 일정 등록 → 포지션 배정 → 피드백 작성 → 통계 확인까지 한 사이클로.",
  },
];

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    sky: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    pink: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    teal: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── 상단 네비 ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-gray-950/90 backdrop-blur border-b border-white/5" : "bg-transparent"}`}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <SpmLogo size="sm" />
          <button
            onClick={() => signIn("kakao")}
            className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            💬 카카오로 시작하기
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-24 px-5 text-center overflow-hidden">
        {/* 배경 그라디언트 */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,_rgba(16,185,129,0.15)_0%,_transparent_65%)] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-40 bg-gradient-to-b from-emerald-500/30 to-transparent" />

        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            ⚽ 풋살/축구 팀 관리 플랫폼
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tight mb-5">
            팀 운영,{" "}
            <span className="text-emerald-400">이제 하나로</span>
          </h1>

          <p className="text-gray-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-8">
            포지션 배정부터 경기 피드백, 팀 통계까지.<br />
            풋살·축구팀 운영에 필요한 모든 것을 한 곳에서.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => signIn("kakao")}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-4 px-8 rounded-2xl transition-colors text-base shadow-2xl shadow-yellow-400/20"
            >
              <span>💬</span> 카카오로 무료 시작
            </button>
            <p className="text-xs text-gray-600">회원가입 없이 카카오 계정으로 바로 시작</p>
          </div>
        </div>

        {/* 기능 미리보기 카드들 */}
        <div className="relative max-w-4xl mx-auto mt-16 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {[
            { icon: "🎯", label: "포지션 배정" },
            { icon: "📅", label: "경기 관리" },
            { icon: "📝", label: "경기 피드백" },
            { icon: "📊", label: "팀 통계" },
            { icon: "🟩", label: "포메이션" },
            { icon: "🎬", label: "영상 추천" },
            { icon: "💬", label: "팀 게시판" },
            { icon: "🔗", label: "간편 공유" },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:border-emerald-500/20 hover:bg-gray-800/50 transition-all"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs text-gray-500 font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 사용 흐름 ── */}
      <section className="py-20 px-5 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest mb-2">HOW IT WORKS</p>
            <h2 className="text-2xl sm:text-3xl font-black">3단계로 시작하세요</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-8 left-[calc(100%+1.5rem)] w-6 text-gray-700 text-xl text-center -translate-x-3 z-10">→</div>
                )}
                <div className="bg-gray-900 border border-white/5 rounded-2xl p-6 h-full hover:border-emerald-500/20 transition-colors">
                  <div className="text-4xl font-black text-emerald-500/20 mb-3">{step.num}</div>
                  <h3 className="font-bold text-white text-base mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 기능 소개 ── */}
      <section className="py-20 px-5 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest mb-2">FEATURES</p>
            <h2 className="text-2xl sm:text-3xl font-black">팀 운영에 필요한 모든 기능</h2>
            <p className="text-gray-500 text-sm mt-2">복잡한 설정 없이 바로 사용할 수 있어요</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-white/5 rounded-2xl p-5 hover:border-white/10 hover:bg-gray-800/60 transition-all group"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg mb-4 ${colorMap[f.color]}`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-white text-sm mb-1.5 group-hover:text-emerald-300 transition-colors">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 포지션 배정 하이라이트 ── */}
      <section className="py-20 px-5 border-t border-white/5 bg-gradient-to-b from-transparent to-emerald-950/10">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 border border-emerald-500/10 rounded-3xl p-8 sm:p-10">
            <div className="grid sm:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                  🎯 핵심 기능
                </div>
                <h2 className="text-2xl sm:text-3xl font-black mb-4 leading-snug">
                  드래그앤드롭으로<br />
                  <span className="text-emerald-400">포지션 배정</span>
                </h2>
                <ul className="space-y-2.5">
                  {[
                    "출전 선수를 포지션에 드래그하여 배치",
                    "용병 · 카페 멤버 구분 표시",
                    "교체 가능 인원 자동 계산",
                    "링크 한 번으로 팀원들과 공유",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                      <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["GK", "CB", "CB", "LB", "RB", "CDM", "CM", "CM", "LW", "ST", "RW"].map((pos, i) => (
                  <div
                    key={i}
                    className={`${pos === "ST" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-white/5 border-white/10 text-gray-400"} border rounded-xl py-2 text-center text-xs font-bold transition-colors`}
                  >
                    {pos}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 피드백 하이라이트 ── */}
      <section className="py-20 px-5 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 border border-amber-500/10 rounded-3xl p-8 sm:p-10">
            <div className="grid sm:grid-cols-2 gap-8 items-center">
              <div className="order-2 sm:order-1 space-y-3">
                {[
                  { name: "김민준", pos: "ST", feedback: "전반 압박 타이밍이 좋았어요. 후반엔 체력 안배 신경써줘요.", color: "emerald" },
                  { name: "이서준", pos: "CM", feedback: "볼 배급이 안정적! 수비 가담도 더 적극적으로 부탁해요.", color: "sky" },
                  { name: "박지호", pos: "GK", feedback: "세이브 훌륭했어요. 킥 정확도만 더 연습하면 완벽!", color: "violet" },
                ].map((p, i) => (
                  <div key={i} className="bg-gray-800/50 border border-white/5 rounded-xl p-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-bold text-sm text-white">{p.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full bg-${p.color}-500/15 text-${p.color}-400`}>{p.pos}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{p.feedback}</p>
                  </div>
                ))}
              </div>
              <div className="order-1 sm:order-2">
                <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                  📝 경기 피드백
                </div>
                <h2 className="text-2xl sm:text-3xl font-black mb-4 leading-snug">
                  선수별 <span className="text-amber-400">개인 피드백</span>으로<br />
                  팀을 성장시키세요
                </h2>
                <ul className="space-y-2.5">
                  {[
                    "쿼터별 선수 개인 피드백 작성",
                    "팀 전체 피드백 섹션 별도 제공",
                    "피드백에 YouTube 영상 첨부 가능",
                    "링크로 팀원에게 공유",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                      <span className="text-amber-500 mt-0.5 shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-24 px-5 border-t border-white/5 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,_rgba(16,185,129,0.1)_0%,_transparent_65%)] pointer-events-none" />
        <div className="relative max-w-xl mx-auto">
          <div className="text-5xl mb-5">⚽</div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-gray-500 mb-8 text-base leading-relaxed">
            복잡한 회원가입 없이 카카오 계정으로 바로 시작.<br />
            팀 생성도 1분이면 완료돼요.
          </p>
          <button
            onClick={() => signIn("kakao")}
            className="inline-flex items-center gap-2.5 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-black py-4 px-10 rounded-2xl transition-colors text-base shadow-2xl shadow-yellow-400/20"
          >
            <span>💬</span> 카카오로 무료 시작
          </button>
          <p className="text-xs text-gray-700 mt-4">무료 · 광고 없음 · 가입 즉시 이용</p>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="border-t border-white/5 py-8 px-5 text-center">
        <div className="flex items-center justify-center mb-3">
          <SpmLogo size="sm" showText={false} />
          <span className="ml-2 text-sm font-bold text-gray-600">SPM</span>
        </div>
        <p className="text-xs text-gray-700">Soccer Position Management · 풋살·축구팀을 위한 포지션 관리 플랫폼</p>
      </footer>
    </div>
  );
}
