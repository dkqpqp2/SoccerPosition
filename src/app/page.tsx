"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Target, LayoutGrid, Calendar, Vote, Handshake, Clapperboard, Share2,
  Check, Wand2, Sparkles, ArrowRight,
} from "lucide-react";
import SpmLogo from "@/components/SpmLogo";

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
    >
      {children}
    </div>
  );
}

const PLAYERS: { x: number; y: number; label: string; group: "gk" | "df" | "mf" }[] = [
  { x: 60, y: 50, label: "LW", group: "mf" },
  { x: 150, y: 42, label: "ST", group: "mf" },
  { x: 240, y: 50, label: "RW", group: "mf" },
  { x: 80, y: 115, label: "CM", group: "mf" },
  { x: 150, y: 130, label: "CDM", group: "mf" },
  { x: 220, y: 115, label: "CM", group: "mf" },
  { x: 45, y: 185, label: "LB", group: "df" },
  { x: 110, y: 195, label: "CB", group: "df" },
  { x: 190, y: 195, label: "CB", group: "df" },
  { x: 255, y: 185, label: "RB", group: "df" },
  { x: 150, y: 240, label: "GK", group: "gk" },
];

const PLAYER_COLOR = {
  mf: { fill: "#0f2a1f", stroke: "#5f9e78", text: "#a3c9ac" },
  df: { fill: "#0c2a4a", stroke: "#38bdf8", text: "#bae6fd" },
  gk: { fill: "#3b2a08", stroke: "#fbbf24", text: "#fde68a" },
};

function PitchMockup() {
  return (
    <div className="bg-[#0b1512] border border-emerald-500/20 rounded-2xl p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-gray-300">경기 라인업 · 4-3-3</span>
        <span className="text-[11px] text-emerald-400 border border-emerald-500/40 rounded-full px-2 py-0.5">11명 배치 완료</span>
      </div>
      <svg viewBox="0 0 300 260" className="w-full" role="img" aria-label="4-3-3 포메이션 배치 화면">
        <rect x="4" y="4" width="292" height="252" rx="8" fill="#0d1c17" stroke="#1f4d3d" />
        <line x1="4" y1="130" x2="296" y2="130" stroke="#1f4d3d" />
        <circle cx="150" cy="130" r="30" fill="none" stroke="#1f4d3d" />
        <rect x="95" y="4" width="110" height="34" fill="none" stroke="#1f4d3d" />
        <rect x="95" y="222" width="110" height="34" fill="none" stroke="#1f4d3d" />
        {PLAYERS.map((p, i) => {
          const c = PLAYER_COLOR[p.group];
          return (
            <g key={i} className="spm-pop" style={{ animationDelay: `${300 + i * 90}ms` }}>
              <circle cx={p.x} cy={p.y} r={p.group === "gk" ? 12 : 13} fill={c.fill} stroke={c.stroke} />
              <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={c.text}>{p.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DuesCard() {
  return (
    <div className="bg-gray-900/70 border border-white/10 rounded-2xl p-4">
      <p className="text-[11px] text-gray-500 mb-1">이번 달 회비</p>
      <p className="text-2xl font-black text-white mb-3">70,000원</p>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
        <div className="h-full w-[62%] bg-emerald-400 rounded-full" />
      </div>
      <p className="text-[11px] text-gray-500">12명 중 8명 납부</p>
    </div>
  );
}

function AttendCard() {
  const rows = [
    { label: "참석", n: 14, cls: "text-emerald-400" },
    { label: "불참", n: 3, cls: "text-red-400" },
    { label: "미정", n: 2, cls: "text-gray-400" },
  ];
  return (
    <div className="bg-gray-900/70 border border-white/10 rounded-2xl p-4 flex-1">
      <p className="text-[11px] text-gray-500 mb-2">참석 현황</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between py-1 text-sm text-gray-300">
          <span>{r.label}</span>
          <span className={`font-bold ${r.cls}`}>{r.n}</span>
        </div>
      ))}
    </div>
  );
}

function StatsMock() {
  const bars = [
    { name: "김민준", goals: 9 },
    { name: "이서준", goals: 6 },
    { name: "박지호", goals: 4 },
    { name: "최도윤", goals: 3 },
  ];
  return (
    <div className="bg-gray-900/70 border border-white/10 rounded-2xl p-5">
      <p className="text-xs text-gray-500 mb-4">득점 순위</p>
      <div className="space-y-3">
        {bars.map((b) => (
          <div key={b.name}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-300">{b.name}</span>
              <span className="text-emerald-400 font-bold">{b.goals}골</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(b.goals / 9) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DuesMock() {
  const members = [
    { name: "김민준", paid: true },
    { name: "이서준", paid: true },
    { name: "박지호", paid: true },
    { name: "정우진", paid: false },
  ];
  return (
    <div className="bg-gray-900/70 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">9월 납부 현황</p>
        <span className="text-[11px] text-emerald-400 font-bold">3 / 4</span>
      </div>
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.name} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2.5">
            <span className="text-sm text-gray-200">{m.name}</span>
            {m.paid ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400"><Check size={12} /> 납부</span>
            ) : (
              <span className="text-[11px] text-gray-500">미납</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AiMock() {
  return (
    <div className="bg-gray-900/70 border border-white/10 rounded-2xl p-5 space-y-3">
      <div>
        <p className="text-[11px] text-gray-500 mb-1.5">감독 메모</p>
        <p className="text-sm text-gray-400 bg-white/[0.03] rounded-lg px-3 py-2.5">패스 좋음, 체력 부족, 압박 잘함</p>
      </div>
      <div className="flex justify-center text-emerald-400"><Wand2 size={16} /></div>
      <div>
        <p className="text-[11px] text-emerald-400 mb-1.5">AI가 다듬은 평가</p>
        <p className="text-sm text-gray-200 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 leading-relaxed">
          패스가 안정적이고 전방 압박 타이밍이 좋아요. 후반 체력 안배만 보완하면 더 좋아질 거예요.
        </p>
        <p className="text-[11px] text-gray-500 mt-2">추천 포지션 · CM, CDM</p>
      </div>
    </div>
  );
}

const SHOWCASE: {
  tag: string;
  title: ReactNode;
  points: string[];
  visual: ReactNode;
}[] = [
  {
    tag: "회비 관리",
    title: <>누가 냈는지<br /><span className="text-emerald-400">한눈에</span></>,
    points: ["납부 여부를 체크하고 한 번에 처리", "벌금·찬조금 같은 수입과 지출 기록", "총무가 아니어도 내역을 투명하게 확인"],
    visual: <DuesMock />,
  },
  {
    tag: "팀 통계",
    title: <>기록이 쌓이면<br /><span className="text-emerald-400">팀이 보여요</span></>,
    points: ["득점·도움·출전 기록 자동 집계", "상대팀별 전적과 최근 경기 결과", "포지션별 출전 균형 확인"],
    visual: <StatsMock />,
  },
  {
    tag: "AI 선수평가",
    title: <>대충 적어도<br /><span className="text-emerald-400">AI가 다듬어요</span></>,
    points: ["장단점 메모를 자연스러운 문장으로", "장단점 기반 추천 포지션 제안", "AI 포지션 배정으로 라인업 초안까지"],
    visual: <AiMock />,
  },
];

const MORE: { icon: typeof Target; label: string; dev?: boolean }[] = [
  { icon: Calendar, label: "경기 일정·참석" },
  { icon: LayoutGrid, label: "포메이션 저장" },
  { icon: Vote, label: "팀 투표" },
  { icon: Clapperboard, label: "영상 추천" },
  { icon: Share2, label: "링크 공유" },
  { icon: Handshake, label: "팀 매칭", dev: true },
];

const STEPS = [
  { num: "01", title: "팀 만들기", desc: "카카오 로그인 후 팀을 만들고 초대 링크를 보내세요." },
  { num: "02", title: "라인업 짜기", desc: "포메이션을 고르고 선수를 포지션에 드래그하세요." },
  { num: "03", title: "경기하고 기록하기", desc: "피드백과 회비, 통계까지 앱 안에서 이어져요." },
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

  function handleKakaoLogin() {
    signIn("kakao", undefined, { prompt: "login" });
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-gray-950/90 backdrop-blur border-b border-white/5" : "bg-transparent"}`}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <SpmLogo size="sm" />
          <button
            onClick={handleKakaoLogin}
            className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            카카오로 시작하기
          </button>
        </div>
      </header>

      <section className="relative pt-28 sm:pt-32 pb-16 sm:pb-24 px-5 overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[640px] h-[420px] rounded-full bg-emerald-500/10 blur-[110px]" aria-hidden="true" />

        <div className="relative max-w-5xl mx-auto grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-10 items-center">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold text-emerald-400 tracking-widest mb-5">풋살 · 축구 팀 관리 플랫폼</p>
            <h1 className="text-4xl sm:text-5xl font-black leading-[1.15] tracking-tight mb-5">
              경기 라인업,<br />
              <span className="text-emerald-400">1분이면 끝나요</span>
            </h1>
            <p className="text-gray-400 text-base sm:text-lg leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
              포지션 배정부터 회비, 통계까지.<br className="hidden sm:block" />
              카톡방에서 하던 팀 운영을 한 곳으로 모아보세요.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <button
                onClick={handleKakaoLogin}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-4 px-8 rounded-xl transition-colors text-base"
              >
                카카오로 무료 시작 <ArrowRight size={16} />
              </button>
              <p className="text-xs text-gray-600">회원가입 없이 카카오 계정으로 바로 시작</p>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
            <PitchMockup />
            <div className="flex flex-col gap-3">
              <DuesCard />
              <AttendCard />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 px-5 border-t border-white/5">
        <div className="max-w-5xl mx-auto space-y-20 sm:space-y-28">
          <Reveal className="text-center">
            <p className="text-xs text-emerald-400 font-bold tracking-widest mb-2">Features</p>
            <h2 className="text-2xl sm:text-3xl font-black">팀 운영에 필요한 건 다 있어요</h2>
          </Reveal>

          {SHOWCASE.map((s, i) => (
            <Reveal key={s.tag}>
              <div className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
                <div className={i % 2 === 1 ? "md:order-2" : ""}>
                  <p className="text-xs font-semibold text-emerald-400 mb-3">{s.tag}</p>
                  <h3 className="text-2xl sm:text-3xl font-black leading-snug mb-5">{s.title}</h3>
                  <ul className="space-y-2.5">
                    {s.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-gray-400">
                        <Check size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={i % 2 === 1 ? "md:order-1" : ""}>{s.visual}</div>
              </div>
            </Reveal>
          ))}

          <Reveal>
            <p className="text-center text-xs text-gray-500 mb-4">그 밖에도</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {MORE.map((m) => (
                <span key={m.label} className="inline-flex items-center gap-2 text-sm text-gray-300 bg-white/[0.04] border border-white/10 rounded-full px-4 py-2">
                  <m.icon size={15} strokeWidth={1.75} className="text-emerald-400" />
                  {m.label}
                  {m.dev && <span className="text-[10px] text-gray-500">개발중</span>}
                </span>
              ))}
              <span className="inline-flex items-center gap-2 text-sm text-gray-300 bg-white/[0.04] border border-white/10 rounded-full px-4 py-2">
                <Sparkles size={15} strokeWidth={1.75} className="text-emerald-400" />
                AI 포지션 배정
                <span className="text-[10px] text-emerald-400">NEW</span>
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-16 sm:py-24 px-5 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs text-emerald-400 font-bold tracking-widest mb-2">How it works</p>
            <h2 className="text-2xl sm:text-3xl font-black">3단계로 시작하세요</h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-6 relative">
            {STEPS.map((step, i) => (
              <Reveal key={step.num} delay={i * 120}>
                <div className="relative h-full">
                  <div className="w-10 h-10 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-sm font-bold flex items-center justify-center mb-4">
                    {step.num}
                  </div>
                  <h3 className="font-bold text-white text-base mb-1.5">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28 px-5 border-t border-white/5 text-center relative overflow-hidden">
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[520px] h-[260px] rounded-full bg-emerald-500/10 blur-[100px]" aria-hidden="true" />
        <Reveal className="relative max-w-xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black mb-4">이번 주 경기부터<br />써보세요</h2>
          <p className="text-gray-500 mb-8 text-base leading-relaxed">
            카카오 계정으로 바로 시작하고, 팀 생성은 1분이면 끝나요.
          </p>
          <button
            onClick={handleKakaoLogin}
            className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-black py-4 px-10 rounded-xl transition-colors text-base"
          >
            카카오로 무료 시작 <ArrowRight size={16} />
          </button>
          <p className="text-xs text-gray-700 mt-4">무료 · 광고 없음 · 가입 즉시 이용</p>
        </Reveal>
      </section>

      <footer className="border-t border-white/5 py-8 px-5 text-center">
        <div className="flex items-center justify-center mb-3">
          <SpmLogo size="sm" showText={false} />
          <span className="ml-2 text-sm font-bold text-gray-600">SPM</span>
        </div>
        <p className="text-xs text-gray-700">Sports Position Management · 풋살·축구 등 스포츠팀을 위한 포지션 관리 플랫폼</p>
      </footer>
    </div>
  );
}
