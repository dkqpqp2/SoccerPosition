"use client";

// SPM 코드 설명서 — 중학생도 이해할 수 있게 그림과 직접 만져보는 데모로 설명하는 페이지.
// 비밀 값(키·비밀번호)은 이 페이지에 쓰지 않는다. /admin 아래라서 운영(production)에서는 proxy.ts가 404로 막는다.
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, ArrowDown, Globe, Server, Database, ShieldCheck, KeyRound, Users,
  Bot, Rocket, FolderTree, BookOpen, Lightbulb, CheckCircle2, XCircle, UtensilsCrossed,
  Smartphone, GitBranch, Lock, Map as MapIcon, Play, RotateCcw, Home, type LucideIcon,
} from "lucide-react";
import SpmLogo from "@/components/SpmLogo";
import { zonePosition, detectFormationName } from "@/lib/tacticsZones";

// ────────────────────────────────────────────────────────────
//  공통 조각
// ────────────────────────────────────────────────────────────
const SECTIONS: { id: string; title: string }[] = [
  { id: "what", title: "SPM이 뭐예요?" },
  { id: "big", title: "전체 그림" },
  { id: "login", title: "로그인" },
  { id: "journey", title: "요청의 여행" },
  { id: "team", title: "팀 칸막이" },
  { id: "roles", title: "역할과 권한" },
  { id: "tactics", title: "전술판" },
  { id: "ai", title: "AI 기능" },
  { id: "push", title: "알림 · 앱" },
  { id: "security", title: "보안" },
  { id: "deploy", title: "배포" },
  { id: "folders", title: "폴더 지도" },
  { id: "words", title: "낱말 사전" },
];

function Section({ id, no, icon: Icon, title, lead, children }: {
  id: string; no: number; icon: LucideIcon; title: string; lead: string; children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-[11px] font-mono text-emerald-400/70">PART {String(no).padStart(2, "0")}</p>
          <h2 className="text-xl font-black text-white leading-tight">{title}</h2>
        </div>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-5">{lead}</p>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-gray-900 border border-white/5 rounded-xl p-5 ${className}`}>{children}</div>;
}

function Analogy({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 bg-amber-500/8 border border-amber-500/25 rounded-xl p-4">
      <Lightbulb size={18} className="text-amber-400 shrink-0 mt-0.5" />
      <div className="text-sm text-amber-100/90 leading-relaxed">
        <p className="text-amber-400 font-bold text-xs mb-1">쉬운 비유</p>
        {children}
      </div>
    </div>
  );
}

function Code({ file, children }: { file?: string; children: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/5">
      {file && <div className="bg-gray-800 px-3 py-1.5 text-[11px] font-mono text-gray-400">진짜 코드 · {file}</div>}
      <pre className="bg-gray-950 p-3 text-xs leading-relaxed text-emerald-200/90 overflow-x-auto whitespace-pre">{children}</pre>
    </div>
  );
}

function Box({ icon: Icon, title, sub, tone = "gray" }: {
  icon: LucideIcon; title: string; sub: string; tone?: "gray" | "emerald" | "sky" | "amber";
}) {
  const tones = {
    gray: "border-white/10 text-gray-300",
    emerald: "border-emerald-500/40 text-emerald-300 bg-emerald-500/5",
    sky: "border-sky-500/40 text-sky-300 bg-sky-500/5",
    amber: "border-amber-500/40 text-amber-300 bg-amber-500/5",
  };
  return (
    <div className={`flex-1 min-w-0 border rounded-xl p-3 text-center ${tones[tone]}`}>
      <Icon size={22} strokeWidth={1.75} className="mx-auto mb-1.5" />
      <p className="font-bold text-sm">{title}</p>
      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{sub}</p>
    </div>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-gray-600 shrink-0 px-1 py-1">
      <ArrowRight size={18} className="hidden lg:block" />
      <ArrowDown size={18} className="lg:hidden" />
      {label && <span className="text-[10px] mt-0.5">{label}</span>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  PART 2 — 전체 그림 (식당 비유)
// ────────────────────────────────────────────────────────────
function BigPicture() {
  return (
    <>
      <Card>
        <p className="text-xs text-gray-500 mb-3">손님이 주문하면 음식이 나오기까지 — SPM도 똑같이 움직여요</p>
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-2">
          <Box icon={Smartphone} title="손님" sub="휴대폰·컴퓨터의 브라우저, Android 앱" tone="sky" />
          <Arrow label="주문" />
          <Box icon={Globe} title="홀 (화면)" sub="src/app/**/page.tsx — 버튼과 글자를 보여줘요" tone="emerald" />
          <Arrow label="전달" />
          <Box icon={Server} title="주방 (API)" sub="src/app/api/**/route.ts — 진짜 일을 해요" tone="amber" />
          <Arrow label="재료 꺼내기" />
          <Box icon={Database} title="창고 (DB)" sub="Supabase — 모든 기록이 저장돼요" />
        </div>
      </Card>
      <Analogy>
        식당에서 손님은 주방에 직접 들어가지 않아요. 홀 직원에게 주문하면 주방이 요리하고, 재료는 창고에서 꺼내 오죠.
        SPM도 같아요. <b>화면은 직접 창고(DB)를 열지 않고</b>, 꼭 주방(API)에게 부탁해요. 주방이 손님의 신분과 권한을 확인한 뒤에만 창고를 열어요.
        그래서 남의 팀 기록을 몰래 보는 일을 막을 수 있어요.
      </Analogy>
      <Card>
        <h3 className="font-bold text-white text-sm mb-3">각자가 맡은 일</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {[
            ["Next.js", "홀과 주방을 한 건물에 같이 지을 수 있게 해 주는 도구. 화면(React)과 API를 한 프로젝트에서 만들어요."],
            ["React · TypeScript", "화면을 레고처럼 조립하는 도구(React)와, 변수에 '이건 숫자야'라고 이름표를 붙여 실수를 막아 주는 언어(TypeScript)."],
            ["Tailwind CSS", "글자 색, 간격, 모양을 클래스 이름으로 꾸미는 도구. 예: text-emerald-400 = 연두색 글자."],
            ["Supabase", "엑셀 표를 아주 크고 안전하게 만든 것(PostgreSQL 데이터베이스). 팀, 팀원, 경기, 회비가 여기 있어요."],
            ["Vercel", "코드를 인터넷에 올려 주는 건물 관리인. main 브랜치에 코드가 올라오면 자동으로 새 버전을 열어요."],
            ["Capacitor", "웹사이트를 앱 모양 포장지(Android 앱)로 감싸 주는 도구. 앱을 켜면 사실 우리 사이트를 열어요."],
          ].map(([name, desc]) => (
            <div key={name} className="bg-white/3 border border-white/5 rounded-lg p-3">
              <p className="font-bold text-emerald-400 text-sm">{name}</p>
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ────────────────────────────────────────────────────────────
//  PART 3 — 로그인
// ────────────────────────────────────────────────────────────
function LoginFlow() {
  const steps = [
    { t: "카카오로 로그인 누르기", d: "손님이 입장권을 받으러 카카오 창구로 가요. SPM은 비밀번호를 받지 않아요 — 카카오가 '이 사람 맞아요'라고 대신 확인해 줘요." },
    { t: "카카오가 SPM에게 알려주기", d: "카카오가 '이 사람의 번호(kakao_id)는 123이에요'라고 돌려보내요. 이 일을 NextAuth라는 도구가 맡아요 (src/lib/auth.ts)." },
    { t: "처음 온 손님이면 자동 가입", d: "users 표에 새 줄을 쓰고, '우리팀'이라는 팀을 만들고, 그 사람을 팀장(owner)으로 등록해요. 가입 버튼이 따로 없는 이유예요." },
    { t: "출입증(세션) 발급", d: "브라우저에 암호로 잠근 출입증을 줘요. 이후 요청마다 이 출입증이 같이 가서 '로그인한 사람'임을 보여줘요." },
  ];
  return (
    <>
      <Card>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-7 h-7 rounded-full bg-emerald-500 text-black font-black text-sm flex items-center justify-center shrink-0">{i + 1}</span>
              <div>
                <p className="font-bold text-white text-sm">{s.t}</p>
                <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <Analogy>
        놀이공원 입장권과 같아요. 매표소(카카오)에서 신분을 확인하고 손목밴드(세션)를 받으면, 놀이기구(기능)를 탈 때마다 밴드만 보여주면 돼요.
      </Analogy>
      <Card>
        <h3 className="font-bold text-white text-sm mb-2">헷갈리기 쉬운 점: 번호가 두 개예요</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-sky-500/8 border border-sky-500/25 rounded-lg p-3">
            <p className="text-sky-300 font-bold">카카오 번호 (kakao_id)</p>
            <p className="text-gray-400 mt-1">카카오가 붙여 준 번호. 출입증(session.user.id)에 들어 있어요.</p>
          </div>
          <div className="bg-emerald-500/8 border border-emerald-500/25 rounded-lg p-3">
            <p className="text-emerald-300 font-bold">SPM 내부 번호 (users.id)</p>
            <p className="text-gray-400 mt-1">우리 DB가 붙인 번호. 모든 표(팀원, 경기…)가 이걸 써요.</p>
          </div>
        </div>
        <p className="text-gray-400 text-xs mt-3 leading-relaxed">
          그래서 API는 항상 <code className="text-emerald-300">getUserAndTeam()</code>으로 <b>카카오 번호 → 내부 번호 + 현재 팀</b>으로 바꿔서 써요.
          이걸 깜빡하면 탈퇴 버튼이 아무것도 지우지 않는 버그가 생겨요. (실제로 있었고, 고쳤고, CLAUDE.md에 기록했어요.)
        </p>
      </Card>
      <Code file="src/lib/team.ts">{`export async function getUserAndTeam(kakaoId: string) {
  const userId = await getUserId(kakaoId);   // 카카오 번호 → 내부 번호
  if (!userId) return { userId: null, teamId: null };
  const teamId = await getTeamId(userId);    // 지금 보고 있는 팀
  return { userId, teamId };
}`}</Code>
    </>
  );
}

// ────────────────────────────────────────────────────────────
//  PART 4 — 요청의 여행 (단계별 데모)
// ────────────────────────────────────────────────────────────
type Role = "owner" | "coach" | "member";
const ROLE_LABEL: Record<Role, string> = { owner: "팀장 (owner)", coach: "코치 (coach)", member: "일반 팀원 (member)" };

const JOURNEY = [
  {
    where: "브라우저 — assign/page.tsx", title: "'저장' 버튼을 눌러요",
    desc: "화면이 입력한 값(경기 이름, 포메이션, 누가 어느 자리인지)을 JSON이라는 글자 묶음으로 만들어 주방(API)에 보내요.",
    code: `await fetch("/api/assignments", {
  method: "POST",
  body: JSON.stringify({ session_name, formation_name, result }),
});`,
  },
  {
    where: "주방 입구 — route.ts의 POST", title: "출입증을 확인해요",
    desc: "요청에 딸려 온 출입증(세션)을 열어 봐요. 없으면 '로그인부터 하세요'(401)라고 돌려보내요.",
    code: `const session = await getServerSession(authOptions);
if (!session?.user?.id)
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`,
  },
  {
    where: "team.ts — getUserAndTeam", title: "누구이고 어느 팀인지 찾아요",
    desc: "카카오 번호를 SPM 내부 번호로 바꾸고, 이 사람이 지금 보고 있는 팀(teamId)을 찾아요. 이 teamId가 이후 모든 일의 기준이에요.",
    code: `const { userId, teamId } = await getUserAndTeam(session.user.id);`,
  },
  {
    where: "team.ts — getUserRole · canManage", title: "이 일을 할 자격이 있는지 봐요",
    desc: "역할을 조회해서 팀장·감독·코치·회장이면 통과, 일반 팀원이면 '권한이 없어요'(403)로 멈춰요. 버튼을 화면에서 숨기는 것만으로는 부족해서, 서버가 한 번 더 확인해요.",
    code: `const role = await getUserRole(userId, teamId);
if (!canManage(role))
  return NextResponse.json({ error: "포지션 배정 권한이 없어요." }, { status: 403 });`,
  },
  {
    where: "route.ts — 중복 이름 검사", title: "같은 이름이 이미 있는지 봐요",
    desc: "같은 팀 안에서 이름이 겹치면 '이미 있어요'(409)라고 알려줘요. 이때도 내 팀(team_id) 것만 찾아요.",
    code: `.eq("team_id", teamId)
.eq("session_name", session_name.trim())
.limit(1)`,
  },
  {
    where: "team.ts — sanitizeResult", title: "명단에 남의 팀 선수가 섞였는지 검사해요",
    desc: "화면이 보낸 값은 믿지 않아요. 누군가 몰래 다른 팀 선수 번호를 끼워 보내도, 우리 팀 소속이 아니면 '빈 자리'로 바꿔 버려요.",
    code: `.from("team_members")
.eq("team_id", teamId)
.in("id", candidateIds)   // 이 목록에 없는 번호는 null 처리`,
  },
  {
    where: "창고 — supabaseAdmin.insert", title: "DB에 저장해요",
    desc: "마스터키(서비스 키)를 가진 서버만 창고를 열 수 있어요. position_assignments 표에 새 줄이 생겨요.",
    code: `await supabaseAdmin.from("position_assignments")
  .insert({ user_id: userId, team_id: teamId, result: safeResult, ... });`,
  },
  {
    where: "브라우저", title: "성공! 화면이 바뀌어요",
    desc: "주방이 저장된 줄을 돌려주면 화면이 '저장됐어요'라고 알려주고 목록을 새로 그려요.",
    code: `return NextResponse.json(data);   // 200 OK`,
  },
];

function Journey() {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>("owner");
  const blockedAt = role === "member" ? 3 : -1; // 일반 팀원은 역할 확인(4번째)에서 멈춤
  const stopped = blockedAt >= 0 && step > blockedAt;
  const shown = stopped ? blockedAt : step;
  const s = JOURNEY[shown];
  const isBlockedHere = blockedAt >= 0 && shown === blockedAt && step >= blockedAt;

  return (
    <>
      <Card>
        <p className="text-xs text-gray-500 mb-2">직접 해 보세요 — 누구로 저장 버튼을 누를까요?</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(ROLE_LABEL) as Role[]).map(r => (
            <button key={r} onClick={() => { setRole(r); setStep(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${role === r ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/5 text-gray-400 border-white/10 hover:text-white"}`}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>

        {/* 진행 막대 */}
        <div className="flex items-center gap-1 mb-4">
          {JOURNEY.map((_, i) => {
            const reached = i <= shown;
            const bad = isBlockedHere && i === blockedAt;
            const skipped = blockedAt >= 0 && i > blockedAt;
            return (
              <button key={i} onClick={() => setStep(i)} aria-label={`${i + 1}단계`}
                className={`flex-1 h-2 rounded-full transition-colors ${bad ? "bg-red-500" : skipped ? "bg-gray-800" : reached ? "bg-emerald-500" : "bg-gray-700"}`} />
            );
          })}
        </div>

        <div className={`rounded-xl border p-4 ${isBlockedHere ? "border-red-500/40 bg-red-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
          <p className="text-[11px] font-mono text-gray-500">{shown + 1} / {JOURNEY.length} · {s.where}</p>
          <h4 className="text-white font-black mt-1">{s.title}</h4>
          <p className="text-gray-300 text-sm mt-2 leading-relaxed">{s.desc}</p>
          {isBlockedHere && (
            <p className="mt-3 flex items-start gap-2 text-red-300 text-sm font-bold">
              <XCircle size={16} className="shrink-0 mt-0.5" />
              여기서 멈춰요! 일반 팀원은 403 &quot;권한이 없어요&quot;를 받고, DB에는 아무것도 저장되지 않아요.
            </p>
          )}
        </div>
        <div className="mt-3"><Code>{s.code}</Code></div>

        <div className="flex items-center justify-between mt-4">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
            className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 text-sm font-bold disabled:opacity-30 hover:bg-white/10">이전</button>
          <button onClick={() => setStep(0)} className="text-gray-500 hover:text-white text-xs flex items-center gap-1"><RotateCcw size={12} /> 처음부터</button>
          <button onClick={() => setStep(Math.min(blockedAt >= 0 ? blockedAt : JOURNEY.length - 1, step + 1))}
            disabled={step >= (blockedAt >= 0 ? blockedAt : JOURNEY.length - 1)}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-bold disabled:opacity-30 hover:bg-emerald-400">다음</button>
        </div>
      </Card>
      <Analogy>
        은행 창구와 같아요. 번호표(출입증) → 신분증 확인 → 이 업무를 할 수 있는 직원인지 확인 → 서류에 이상한 게 없는지 검사 → 금고(DB)에 보관.
        <b>어느 한 단계라도 통과 못 하면 그 자리에서 끝</b>이라서, 금고까지 가는 길이 안전해요.
      </Analogy>
      <Card>
        <h3 className="font-bold text-white text-sm mb-2">숫자 번호표 읽는 법 (HTTP 상태 코드)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          {[
            ["200", "성공", "emerald"], ["401", "로그인 필요", "amber"], ["403", "권한 없음", "red"],
            ["404", "없어요", "gray"], ["409", "겹쳐요", "sky"],
          ].map(([code, name, c]) => (
            <div key={code} className={`rounded-lg border p-2 ${
              c === "emerald" ? "border-emerald-500/30 text-emerald-300" : c === "amber" ? "border-amber-500/30 text-amber-300"
              : c === "red" ? "border-red-500/30 text-red-300" : c === "sky" ? "border-sky-500/30 text-sky-300" : "border-white/10 text-gray-400"}`}>
              <p className="text-lg font-black">{code}</p><p>{name}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ────────────────────────────────────────────────────────────
//  PART 5 — 팀 칸막이 (team_id 필터 데모)
// ────────────────────────────────────────────────────────────
const ALL_ROWS = [
  { name: "민수", team: "A" }, { name: "지훈", team: "A" }, { name: "도윤", team: "A" },
  { name: "서준", team: "B" }, { name: "하준", team: "B" }, { name: "유찬", team: "B" },
];

function TeamWall() {
  const [filter, setFilter] = useState(true);
  const rows = filter ? ALL_ROWS.filter(r => r.team === "A") : ALL_ROWS;
  const leaked = rows.some(r => r.team !== "A");
  return (
    <>
      <Card>
        <p className="text-xs text-gray-500 mb-3">나는 <b className="text-emerald-400">A팀</b> 팀장이에요. &quot;팀원 목록 보기&quot;를 눌렀어요.</p>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setFilter(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${filter ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/5 text-gray-400 border-white/10"}`}>
            .eq(&quot;team_id&quot;, teamId) 있음
          </button>
          <button onClick={() => setFilter(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${!filter ? "bg-red-500 text-white border-red-500" : "bg-white/5 text-gray-400 border-white/10"}`}>
            필터를 깜빡함
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(["A", "B"] as const).map(t => (
            <div key={t} className={`rounded-xl border p-3 ${t === "A" ? "border-emerald-500/30" : "border-sky-500/30"}`}>
              <p className={`text-xs font-bold mb-2 ${t === "A" ? "text-emerald-400" : "text-sky-400"}`}>{t}팀 아파트</p>
              <div className="space-y-1.5">
                {ALL_ROWS.filter(r => r.team === t).map(r => {
                  const visible = rows.includes(r);
                  return (
                    <div key={r.name} className={`text-xs rounded-md px-2 py-1.5 border transition-all ${
                      visible ? (t === "A" ? "bg-emerald-500/15 border-emerald-500/40 text-white" : "bg-red-500/20 border-red-500/50 text-red-200")
                              : "bg-white/3 border-white/5 text-gray-600"}`}>
                      {r.name} {visible && t === "B" && "← 남의 팀인데 보여요!"}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className={`mt-4 text-sm font-bold flex items-center gap-2 ${leaked ? "text-red-400" : "text-emerald-400"}`}>
          {leaked ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          {leaked ? "다른 팀 사람 이름이 새어 나갔어요 (정보 유출)" : "내 팀 3명만 보여요 (정상)"}
        </p>
      </Card>
      <Analogy>
        SPM에는 여러 팀이 한 건물(DB)에 살아요. 각 팀은 자기 호수(team_id)가 있고, 질문할 때마다 <b>&quot;우리 호수 것만 보여줘&quot;</b>를 꼭 붙여요.
        한 번 빠뜨리면 옆집이 보여요. 그래서 모든 API에 이 줄이 있는지 계속 점검하고, 그 규칙을 CLAUDE.md에 적어 두었어요.
      </Analogy>
      <Card>
        <h3 className="font-bold text-white text-sm mb-2">팀 이동은 어떻게 알아요?</h3>
        <p className="text-gray-400 text-xs leading-relaxed">
          사람은 여러 팀에 들어갈 수 있어서, users 표의 <code className="text-emerald-300">active_team_id</code> 칸에 &quot;지금 보고 있는 팀&quot;을 적어 둬요.
          사이드바에서 팀을 바꾸면 이 칸이 바뀌고, 모든 API는 이 값을 기준으로 일해요.
        </p>
      </Card>
    </>
  );
}

// ────────────────────────────────────────────────────────────
//  PART 6 — 역할과 권한
// ────────────────────────────────────────────────────────────
const PERMS: { feature: string; fn: string; roles: Record<string, boolean> }[] = [
  { feature: "포지션 배정 · 경기 만들기", fn: "canManage", roles: { owner: true, manager: true, coach: true, president: true, treasurer: false, member: false } },
  { feature: "경기 피드백 쓰기", fn: "canFeedback", roles: { owner: true, manager: true, coach: true, president: true, treasurer: false, member: false } },
  { feature: "내전(스크림) 관리", fn: "canManageScrimmage", roles: { owner: true, manager: true, coach: false, president: true, treasurer: false, member: false } },
  { feature: "회비 관리", fn: "canManageDues", roles: { owner: true, manager: false, coach: false, president: false, treasurer: true, member: false } },
  { feature: "역할 임명 · 강퇴", fn: "isOwner", roles: { owner: true, manager: false, coach: false, president: false, treasurer: false, member: false } },
];
const ROLE_COLS = [["owner", "팀장"], ["manager", "매니저"], ["coach", "코치"], ["president", "회장"], ["treasurer", "총무"], ["member", "팀원"]] as const;

function Roles() {
  return (
    <>
      <Card className="overflow-x-auto">
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr className="text-gray-500">
              <th className="text-left font-medium pb-2">할 수 있는 일</th>
              {ROLE_COLS.map(([k, n]) => <th key={k} className="pb-2 font-medium">{n}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMS.map(p => (
              <tr key={p.fn} className="border-t border-white/5">
                <td className="py-2.5 pr-2">
                  <p className="text-white font-bold">{p.feature}</p>
                  <p className="text-[10px] font-mono text-emerald-400/70">{p.fn}()</p>
                </td>
                {ROLE_COLS.map(([k]) => (
                  <td key={k} className="text-center">
                    {p.roles[k] ? <CheckCircle2 size={16} className="inline text-emerald-400" /> : <span className="text-gray-700">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Code file="src/lib/team.ts">{`// 한 줄짜리 '자격 검사' 함수. 참이면 통과, 거짓이면 403.
export function canManage(role: TeamRole | null): boolean {
  return role === "owner" || role === "manager"
      || role === "coach"  || role === "president";
}`}</Code>
      <Analogy>
        학교의 열쇠 같아요. 교실 열쇠(일반 팀원)로는 교무실(포지션 배정)을 열 수 없어요.
        그리고 <b>문 앞에 열쇠 구멍을 숨기는 것(버튼 숨기기)</b>만으로는 안 되고, 문 자체에 자물쇠(서버 검사)가 있어야 해요.
        누가 몰래 문을 두드려도(주소를 직접 호출해도) 서버가 다시 확인하니까요.
      </Analogy>
    </>
  );
}

// ────────────────────────────────────────────────────────────
//  PART 7 — 전술판 (진짜 함수로 움직이는 데모)
// ────────────────────────────────────────────────────────────
interface DemoToken { id: number; x: number; y: number; gk?: boolean }
const INITIAL_TOKENS: DemoToken[] = [
  { id: 0, x: 50, y: 90, gk: true },
  { id: 1, x: 14, y: 74 }, { id: 2, x: 38, y: 76 }, { id: 3, x: 62, y: 76 }, { id: 4, x: 86, y: 74 },
  { id: 5, x: 30, y: 48 }, { id: 6, x: 50, y: 50 }, { id: 7, x: 70, y: 48 },
  { id: 8, x: 18, y: 18 }, { id: 9, x: 50, y: 14 }, { id: 10, x: 82, y: 18 },
];
// tacticsZones.ts의 lineOf()와 같은 경계값 (y가 클수록 우리 골대에 가까움)
const BANDS = [
  { from: 66, to: 100, name: "수비", color: "#0ea5e9" },
  { from: 56, to: 66, name: "수비형 미드 · 윙백", color: "#14b8a6" },
  { from: 36, to: 56, name: "중앙 미드", color: "#22c55e" },
  { from: 28, to: 36, name: "공격형 미드", color: "#eab308" },
  { from: 0, to: 28, name: "공격", color: "#f97316" },
];

function PitchDemo() {
  const [tokens, setTokens] = useState<DemoToken[]>(INITIAL_TOKENS);
  const [drag, setDrag] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const withPos = tokens.map(t => ({ team: "us", x: t.x, y: t.y, pos: t.gk ? "GK" : zonePosition(t.x, t.y) }));
  const formation = detectFormationName(withPos);

  const move = (e: React.PointerEvent) => {
    if (drag === null || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(98, Math.max(2, ((e.clientY - r.top) / r.height) * 100));
    setTokens(ts => ts.map(t => (t.id === drag ? { ...t, x, y } : t)));
  };

  return (
    <>
      <Card>
        <div className="flex flex-col md:flex-row gap-5">
          <div className="md:w-[300px] shrink-0 mx-auto w-full max-w-[300px]">
            <svg ref={svgRef} viewBox="0 0 100 140" className="w-full rounded-xl touch-none select-none bg-emerald-900/40 border border-white/10"
              onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
              {BANDS.map(b => (
                <g key={b.name}>
                  <rect x={0} y={b.from * 1.4} width={100} height={(b.to - b.from) * 1.4} fill={b.color} opacity={0.13} />
                  <text x={2} y={b.from * 1.4 + 5} fontSize={3.4} fill={b.color} opacity={0.9}>{b.name}</text>
                </g>
              ))}
              <line x1={25} y1={0} x2={25} y2={140} stroke="white" strokeOpacity={0.2} strokeDasharray="1.5 1.5" strokeWidth={0.3} />
              <line x1={75} y1={0} x2={75} y2={140} stroke="white" strokeOpacity={0.2} strokeDasharray="1.5 1.5" strokeWidth={0.3} />
              <text x={12} y={138} fontSize={3} fill="white" opacity={0.5} textAnchor="middle">왼쪽</text>
              <text x={50} y={138} fontSize={3} fill="white" opacity={0.5} textAnchor="middle">가운데</text>
              <text x={88} y={138} fontSize={3} fill="white" opacity={0.5} textAnchor="middle">오른쪽</text>
              {tokens.map(t => {
                const pos = t.gk ? "GK" : zonePosition(t.x, t.y);
                return (
                  <g key={t.id} onPointerDown={(e) => {
                    setDrag(t.id);
                    try { (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId); } catch { /* 캡처 실패해도 드래그는 SVG 안에서 계속 동작 */ }
                  }} style={{ cursor: "grab" }}>
                    <circle cx={t.x} cy={t.y * 1.4} r={4.6} fill={t.gk ? "#eab308" : "#10b981"} stroke="white" strokeWidth={0.5} />
                    <text x={t.x} y={t.y * 1.4 + 1.3} fontSize={3.2} fontWeight="bold" textAnchor="middle" fill="black" pointerEvents="none">{pos}</text>
                  </g>
                );
              })}
            </svg>
            <button onClick={() => setTokens(INITIAL_TOKENS)} className="mt-2 text-xs text-gray-500 hover:text-white flex items-center gap-1">
              <RotateCcw size={12} /> 처음 배치로
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">선수(동그라미)를 끌어서 옮겨 보세요 👆</p>
            <div className="mt-2 bg-gray-950 border border-white/5 rounded-xl p-4 text-center">
              <p className="text-gray-500 text-xs">지금 포메이션 (컴퓨터가 센 결과)</p>
              <p className="text-4xl font-black text-emerald-400 mt-1">{formation ?? "—"}</p>
              {!formation && <p className="text-xs text-amber-400 mt-1">골키퍼 1명 + 필드 10명일 때만 이름을 붙여요</p>}
            </div>
            <ul className="mt-4 space-y-2 text-xs text-gray-400 leading-relaxed">
              <li><b className="text-white">① 자리 이름 정하기</b> — 화면을 가로로 5개 띠(수비, 수비형 미드…), 세로로 3칸(왼·가운데·오른)으로 나눠서, 동그라미가 놓인 칸에 이름(LB, CB, ST…)을 붙여요.</li>
              <li><b className="text-white">② 포메이션 이름 정하기</b> — 골키퍼를 뺀 선수를 띠마다 세어서 이어 붙여요. 수비 4명, 미드 3명, 공격 3명이면 <code className="text-emerald-300">4-3-3</code>.</li>
              <li><b className="text-white">③ 이 화면은 가짜가 아니에요</b> — 진짜 앱이 쓰는 <code className="text-emerald-300">zonePosition()</code>, <code className="text-emerald-300">detectFormationName()</code> 함수를 그대로 불러와서 돌리고 있어요.</li>
            </ul>
          </div>
        </div>
      </Card>
      <Code file="src/lib/tacticsZones.ts">{`function lineOf(y: number): number {
  if (y >= 66) return 0; // 수비
  if (y >= 56) return 1; // 수비형 미드 / 윙백
  if (y >= 36) return 2; // 중앙 미드
  if (y >= 28) return 3; // 공격형 미드
  return 4;              // 공격
}
// 띠마다 선수를 세고, 0명인 띠는 빼고 이어 붙이면 "4-3-3"
return counts.filter(c => c > 0).join("-");`}</Code>
      <PlaybackDemo />
    </>
  );
}

// 전술판 재생: 패스(공)와 달리기(선수)가 같이 도착하도록 시간을 맞추는 규칙
const BALL_SPEED = 45, PLAYER_SPEED = 25;
function PlaybackDemo() {
  const [pass, setPass] = useState(40);
  const [run, setRun] = useState(20);
  const ballMs = (pass / BALL_SPEED) * 1000;
  const playerMs = (run / PLAYER_SPEED) * 1000;
  const raw = Math.max(ballMs, playerMs);
  const final = Math.min(3500, Math.max(800, raw));
  const bar = (ms: number, color: string) => (
    <div className="h-3 bg-gray-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (ms / 3500) * 100)}%` }} /></div>
  );
  return (
    <Card>
      <h3 className="font-bold text-white text-sm mb-1 flex items-center gap-2"><Play size={14} className="text-emerald-400" /> 재생 버튼: 공과 선수가 같이 도착하게 하려면?</h3>
      <p className="text-gray-400 text-xs leading-relaxed mb-4">
        공은 빨라서 50칸을 금방 가고, 사람은 느려요. 둘이 같은 순간에 도착하려면 <b>더 오래 걸리는 쪽에 시간을 맞춰야</b> 해요. 막대를 움직여 보세요.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-xs text-gray-400">패스 길이 <b className="text-white">{pass}</b>
          <input type="range" min={5} max={100} value={pass} onChange={e => setPass(+e.target.value)} className="w-full accent-emerald-500" />
        </label>
        <label className="text-xs text-gray-400">선수 달리는 길이 <b className="text-white">{run}</b>
          <input type="range" min={5} max={100} value={run} onChange={e => setRun(+e.target.value)} className="w-full accent-sky-500" />
        </label>
      </div>
      <div className="mt-4 space-y-2 text-xs">
        <div><p className="text-gray-500 mb-1">공이 혼자 가면 {(ballMs / 1000).toFixed(2)}초</p>{bar(ballMs, "bg-emerald-500")}</div>
        <div><p className="text-gray-500 mb-1">선수가 혼자 가면 {(playerMs / 1000).toFixed(2)}초</p>{bar(playerMs, "bg-sky-500")}</div>
        <div><p className="text-white font-bold mb-1">실제 재생 시간 {(final / 1000).toFixed(2)}초 {raw !== final && <span className="text-amber-400 font-normal">(너무 {raw < 800 ? "짧아서 0.8초로" : "길어서 3.5초로"} 맞췄어요)</span>}</p>{bar(final, "bg-amber-400")}</div>
      </div>
      <Code>{`duration = max(패스길이 / ${BALL_SPEED}, 달리기길이 / ${PLAYER_SPEED}) * 1000
duration = 0.8초 ~ 3.5초 사이로 자르기`}</Code>
      <p className="text-gray-500 text-[11px] mt-2 leading-relaxed">
        재생 중 움직임은 화면 위에 잠깐 겹쳐 그리는 효과일 뿐이고, 저장된 선수 위치는 바뀌지 않아요. 도착 지점이 같은 패스와 달리기는 한 짝으로 묶어서 같이 움직여요.
      </p>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
//  PART 8 — AI 기능
// ────────────────────────────────────────────────────────────
function AiPart() {
  return (
    <>
      <Card>
        <h3 className="font-bold text-white text-sm mb-3">AI에게 일을 시키는 5단계</h3>
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-2">
          <Box icon={ShieldCheck} title="1. 자격 확인" sub="감독·코치 등 관리자급만" tone="emerald" />
          <Arrow />
          <Box icon={Database} title="2. 재료 모으기" sub="우리 팀 선수 이름·장단점만" />
          <Arrow />
          <Box icon={Bot} title="3. 질문(프롬프트)" sub="'JSON으로만 대답해'라고 시켜요" tone="sky" />
          <Arrow />
          <Box icon={ShieldCheck} title="4. 답 검사" sub="이상한 번호는 버려요" tone="amber" />
          <Arrow />
          <Box icon={CheckCircle2} title="5. 화면에 보여주기" sub="사람이 확인하고 저장" tone="emerald" />
        </div>
      </Card>
      <Analogy>
        AI는 똑똑하지만 가끔 틀리거나 없는 이름을 지어내요. 그래서 SPM은 AI를 <b>&quot;아이디어를 내는 조수&quot;</b>로만 써요.
        조수가 낸 답을 선생님(서버 코드)이 한 번 더 검사하고, 마지막 결정은 사람(감독)이 해요. AI 답이 그대로 저장되는 일은 없어요.
      </Analogy>
      <Card>
        <h3 className="font-bold text-white text-sm mb-3">&quot;AI 답 검사&quot; 예시 — 포지션 자동 배정</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-white/3 border border-white/5 rounded-lg p-3">
            <p className="text-gray-500 font-bold mb-2">AI가 이렇게 대답했어요</p>
            <ul className="space-y-1 font-mono text-gray-300">
              <li>ST 자리 → <span className="text-white">민수</span></li>
              <li>CM 자리 → <span className="text-white">지훈</span></li>
              <li>LB 자리 → <span className="text-red-300">민수</span> <span className="text-gray-600">(이미 ST에 썼는데?)</span></li>
              <li>RB 자리 → <span className="text-red-300">zzz-999</span> <span className="text-gray-600">(그런 사람 없음)</span></li>
            </ul>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-lg p-3">
            <p className="text-emerald-400 font-bold mb-2">서버가 걸러낸 최종 결과</p>
            <ul className="space-y-1 font-mono text-gray-300">
              <li>ST 자리 → 민수 <CheckCircle2 size={12} className="inline text-emerald-400" /></li>
              <li>CM 자리 → 지훈 <CheckCircle2 size={12} className="inline text-emerald-400" /></li>
              <li>LB 자리 → <span className="text-gray-500">비움 (중복)</span></li>
              <li>RB 자리 → <span className="text-gray-500">비움 (가짜 번호)</span></li>
            </ul>
          </div>
        </div>
      </Card>
      <Code file="src/app/api/ai/assign/route.ts">{`for (const [slotId, memberId] of Object.entries(parsed.assignments)) {
  if (!validSlotIds.has(slotId)) continue;            // 없는 자리면 무시
  if (typeof memberId !== "string"
      || !validMemberIds.has(memberId)                // 우리 팀 선수가 아니면
      || usedMemberIds.has(memberId)) {               // 이미 다른 자리에 썼으면
    assignments[slotId] = null;                       // 비워 둠
    continue;
  }
  assignments[slotId] = memberId;
  usedMemberIds.add(memberId);
}`}</Code>
      <Card>
        <h3 className="font-bold text-white text-sm mb-3">SPM의 AI 기능 4가지</h3>
        <div className="space-y-2 text-xs">
          {[
            ["포지션 자동 배정", "Claude Haiku", "참가 선수의 선호 포지션과 장단점을 보고 각 자리에 한 명씩 추천해요."],
            ["선수 평가 다듬기", "Claude Haiku", "코치가 대충 적은 장점·단점 메모를 읽기 좋은 문장으로 다듬고 추천 포지션도 제안해요."],
            ["경기 피드백 초안", "Llama (Groq)", "감독이 경기 내용을 적으면 3~5문장의 격려 섞인 피드백을 써 줘요."],
            ["전술 추천 (전술판)", "Claude Sonnet", "내가 그린 선수·화살표를 같이 보내서 전술을 제안받고, 왜 그런지 이유도 보여줘요. 팀마다 하루 사용 횟수 제한이 있어요."],
          ].map(([name, model, desc]) => (
            <div key={name} className="flex gap-3 bg-white/3 border border-white/5 rounded-lg p-3">
              <Bot size={16} className="text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-bold">{name} <span className="ml-1 text-[10px] font-mono text-sky-300/80 bg-sky-500/10 px-1.5 py-0.5 rounded">{model}</span></p>
                <p className="text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-white text-sm mb-1">&quot;하루 10번 제한&quot;은 어떻게 안 뚫려요?</h3>
        <p className="text-gray-400 text-xs leading-relaxed">
          감독 두 명이 동시에 9번째 질문을 하면 11번이 될 수 있어요. 그래서 <b className="text-white">&quot;읽고 → 확인하고 → 쓰기&quot;를 따로 하지 않고</b>,
          DB가 &quot;지금 횟수가 10 미만일 때만 +1&quot;을 <b className="text-white">한 번에</b> 처리하게 했어요(increment_ai_usage).
          한 번에 20번을 동시에 눌러도 정확히 10번만 통과하는 걸 실제로 실험해 확인했어요. AI 호출이 실패하면 횟수를 다시 돌려줘요.
        </p>
      </Card>
    </>
  );
}

// ────────────────────────────────────────────────────────────
//  PART 9 — 알림 · 앱
// ────────────────────────────────────────────────────────────
function PushApp() {
  return (
    <>
      <Card>
        <h3 className="font-bold text-white text-sm mb-3">알림이 휴대폰에 도착하기까지</h3>
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-2">
          <Box icon={Smartphone} title="구독" sub="알림 허용하면 '주소'를 DB에 저장" tone="sky" />
          <Arrow />
          <Box icon={Users} title="감독이 '배정 알리기'" sub="누르는 순간에만 발송" tone="emerald" />
          <Arrow />
          <Box icon={Server} title="서버(push.ts)" sub="팀 구독자 목록을 찾아 하나씩 보내요" tone="amber" />
          <Arrow />
          <Box icon={Smartphone} title="휴대폰 알림" sub="앱이 꺼져 있어도 도착" tone="sky" />
        </div>
        <p className="text-gray-500 text-xs mt-3 leading-relaxed">
          배정을 저장만 한다고 알림이 자동으로 가지 않아요. 만드는 중에 팀원들이 계속 알림을 받으면 곤란하니까, 관리자가 버튼을 눌렀을 때만 가요.
          알림 주소가 만료(404·410)되면 서버가 알아서 DB에서 지워 쓰레기가 쌓이지 않아요.
        </p>
      </Card>
      <Card>
        <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2"><Smartphone size={15} className="text-sky-400" /> Android 앱은 어떻게 만들었어요?</h3>
        <p className="text-gray-400 text-xs leading-relaxed">
          앱을 켜면 안에 숨어 있던 작은 브라우저가 <code className="text-emerald-300">www.soccerpositionmanagement.com</code>을 열어요(capacitor.config.ts의 server.url).
          그래서 웹사이트를 고치면 앱도 같이 바뀌어요. 다만 앱 아이콘·이름 같은 <b className="text-white">앱 껍데기</b>를 바꾸면 새 앱 파일(.aab)을 만들어 Play Console에 직접 올려야 해요.
        </p>
      </Card>
    </>
  );
}

// ────────────────────────────────────────────────────────────
//  PART 10 — 보안
// ────────────────────────────────────────────────────────────
function Security() {
  return (
    <>
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="border-sky-500/30">
          <KeyRound size={20} className="text-sky-400 mb-2" />
          <h3 className="font-bold text-white text-sm">공개 열쇠 (anon key)</h3>
          <p className="text-gray-400 text-xs mt-1 leading-relaxed">누구나 브라우저에서 볼 수 있는 열쇠예요(숨길 수 없음). 그래서 이 열쇠로는 <b className="text-white">아무것도 못 열게</b> 잠가야 해요.</p>
        </Card>
        <Card className="border-amber-500/30">
          <KeyRound size={20} className="text-amber-400 mb-2" />
          <h3 className="font-bold text-white text-sm">마스터 열쇠 (service key)</h3>
          <p className="text-gray-400 text-xs mt-1 leading-relaxed">서버 안에만 있는 열쇠예요. 브라우저로 절대 안 나가요. API가 권한 검사를 마친 뒤에만 이 열쇠로 창고를 열어요.</p>
        </Card>
      </div>
      <Card>
        <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2"><Lock size={15} className="text-emerald-400" /> RLS = 창고 문 자물쇠</h3>
        <p className="text-gray-400 text-xs leading-relaxed">
          Supabase의 표는 새로 만들면 <b className="text-white">문이 열린 채</b>로 생겨요. 그러면 공개 열쇠만 있어도 모든 팀의 기록을 읽고 쓸 수 있어요.
          실제로 전술판 표 등 4개가 그런 상태였고, 점검 스크립트로 찾아서 모두 잠갔어요.
          앱은 마스터 열쇠(서버)로만 창고를 쓰니까 <b className="text-white">자물쇠를 걸어도 앱은 그대로 동작</b>해요.
        </p>
        <div className="mt-3"><Code file="SQL (Supabase에서 실행)">{`alter table 새테이블 enable row level security;   -- 자물쇠 잠그기
revoke execute on function 함수명() from public, anon, authenticated;`}</Code></div>
      </Card>
      <Card>
        <h3 className="font-bold text-white text-sm mb-3">SPM이 지키는 보안 습관</h3>
        <ul className="space-y-2 text-xs text-gray-300">
          {[
            "화면이 보낸 값은 믿지 않기 — 팀원 번호가 우리 팀 소속인지 서버가 다시 검사해요.",
            "'허용 목록'에 있는 값만 통과 — 모르는 상태값(status)은 먼저 거절해요.",
            "공개 공유 링크는 필요한 칸만 내려주기 — select(\"*\") 금지.",
            "나간 팀원(left_at) 걸러내기 — 이미 나간 사람이 계속 보이지 않게.",
            "비밀번호·키를 코드에 쓰지 않기 — 관리자 페이지 비밀번호가 코드에 박혀 있던 걸 발견해 지웠고, 운영에서는 /admin 자체를 404로 막아요.",
          ].map(t => <li key={t} className="flex gap-2"><ShieldCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />{t}</li>)}
        </ul>
      </Card>
      <Analogy>
        집 대문 열쇠를 길거리에 붙여 놓을 수는 없죠. 그래서 &quot;열쇠는 집 안에(서버), 대문에는 자물쇠(RLS), 손님은 안내 데스크(API)를 통해서만&quot; 들어와요.
      </Analogy>
    </>
  );
}

// ────────────────────────────────────────────────────────────
//  PART 11 — 배포
// ────────────────────────────────────────────────────────────
function Deploy() {
  const steps: [string, string, boolean][] = [
    ["브랜치 만들기", "main에서 갈라져 나온 '연습장'을 만들어요", false],
    ["코드 고치기", "연습장에서만 수정해요", false],
    ["타입 검사", "npx tsc --noEmit — 이름표(타입) 틀린 곳 찾기", false],
    ["빌드", "npm run build — 진짜 사이트처럼 한 번 만들어 보기", false],
    ["'배포해줘'", "사람이 직접 말해야만 다음으로 가요", true],
    ["main에 합치기", "연습장 내용을 원본(main)에 합쳐서 push", false],
    ["Vercel 자동 배포", "몇 분 뒤 운영 사이트에 반영", false],
    ["확인", "운영 주소를 실제로 열어 보고 결과 보고", false],
  ];
  return (
    <>
      <Card>
        <ol className="space-y-2">
          {steps.map(([t, d, gate], i) => (
            <li key={t} className={`flex items-center gap-3 rounded-lg p-3 border ${gate ? "border-amber-500/40 bg-amber-500/8" : "border-white/5 bg-white/3"}`}>
              <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${gate ? "bg-amber-400 text-black" : "bg-gray-700 text-gray-300"}`}>{i + 1}</span>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${gate ? "text-amber-300" : "text-white"}`}>{t}</p>
                <p className="text-gray-500 text-xs">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <Analogy>
        시험지를 낼 때 연습지(브랜치)에 먼저 풀고, 맞는지 검산한 다음, 선생님(사용자)이 &quot;내도 좋아&quot;라고 해야 정답지(main)에 옮겨 적는 것과 같아요.
        정답지에 곧바로 쓰면 틀렸을 때 모든 사용자가 바로 보게 되니까요.
      </Analogy>
      <Card>
        <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2"><GitBranch size={15} className="text-emerald-400" /> 이 과정을 Claude Code 스킬로 만들어 둔 것들</h3>
        <div className="grid sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-white/3 border border-white/5 rounded-lg p-3"><p className="text-emerald-400 font-bold">release</p><p className="text-gray-400 mt-1">검증 → 병합 → push → 배포 후 확인 순서를 지켜요.</p></div>
          <div className="bg-white/3 border border-white/5 rounded-lg p-3"><p className="text-emerald-400 font-bold">db-migration</p><p className="text-gray-400 mt-1">새 표를 만들 때 자물쇠(RLS)를 빼먹지 않게 하고, 전 테이블을 점검해요.</p></div>
          <div className="bg-white/3 border border-white/5 rounded-lg p-3"><p className="text-emerald-400 font-bold">ops-report</p><p className="text-gray-400 mt-1">팀원 수·경기 수 같은 사용 현황을 숫자로만 보여줘요.</p></div>
        </div>
      </Card>
    </>
  );
}

// ────────────────────────────────────────────────────────────
//  PART 12 — 폴더 지도
// ────────────────────────────────────────────────────────────
const TREE: { path: string; desc: string; depth: number }[] = [
  { path: "src/", desc: "우리가 짠 코드가 전부 여기 있어요", depth: 0 },
  { path: "app/", desc: "주소(URL)마다 폴더 하나 = 화면 하나", depth: 1 },
  { path: "dashboard/ · members/ · matches/", desc: "홈, 팀원 관리, 경기 관리 화면", depth: 2 },
  { path: "assign/ · formations/", desc: "포지션 배정, 포메이션 만들기", depth: 2 },
  { path: "tactics/", desc: "전술판 (그리기, 재생, 게시)", depth: 2 },
  { path: "dues/ · votes/ · stats/ · feedback/", desc: "회비, 투표, 통계, 피드백", depth: 2 },
  { path: "scrimmage/ · matching/ · board/ · videos/", desc: "내전, 팀 매칭, 게시판, 영상", depth: 2 },
  { path: "share/ · privacy/", desc: "로그인 없이 보는 공유 페이지, 개인정보처리방침", depth: 2 },
  { path: "admin/", desc: "관리자 화면 (운영에서는 막힘) — 지금 보는 이 페이지도 여기!", depth: 2 },
  { path: "api/", desc: "주방. 화면이 부탁하면 일하는 서버 코드", depth: 2 },
  { path: "layout.tsx", desc: "모든 페이지를 감싸는 틀 (제목, 아이콘, 검색 설명)", depth: 2 },
  { path: "components/", desc: "여러 화면이 같이 쓰는 레고 조각 (사이드바 AppLayout 등)", depth: 1 },
  { path: "lib/", desc: "여러 곳이 같이 쓰는 도구 상자", depth: 1 },
  { path: "auth.ts", desc: "로그인 설정", depth: 2 },
  { path: "team.ts", desc: "누구·어느 팀·무슨 역할인지 알아내는 함수들", depth: 2 },
  { path: "supabase.ts", desc: "DB에 연결하는 두 열쇠(공개/마스터)", depth: 2 },
  { path: "tacticsZones.ts · formations.ts · positions.ts", desc: "자리 이름·포메이션 계산", depth: 2 },
  { path: "push.ts", desc: "휴대폰 알림 보내기", depth: 2 },
  { path: "proxy.ts", desc: "문지기. 운영에서 /admin 요청을 404로 돌려보내요", depth: 1 },
  { path: "android/ · capacitor.config.ts", desc: "Android 앱 껍데기", depth: 0 },
  { path: ".claude/skills/", desc: "Claude Code에게 일하는 순서를 알려주는 설명서 (release, db-migration, ops-report)", depth: 0 },
  { path: "CLAUDE.md", desc: "이 프로젝트의 규칙과 실제로 겪은 버그 기록 — Claude가 매번 읽어요", depth: 0 },
];

function Folders() {
  return (
    <>
      <Card>
        <ul className="space-y-1.5 font-mono text-xs">
          {TREE.map((r, i) => (
            <li key={i} className="flex flex-col sm:flex-row sm:gap-3" style={{ paddingLeft: r.depth * 16 }}>
              <span className="text-emerald-300 shrink-0 sm:w-[260px] break-words">{r.path}</span>
              <span className="text-gray-500 font-sans">{r.desc}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Analogy>
        <b>폴더 이름이 곧 주소</b>예요. <code>src/app/members/page.tsx</code> 파일이 있으면 사이트에서 <code>/members</code>로 들어갔을 때 그 화면이 나와요.
        <code>src/app/api/dues/pay/route.ts</code>는 <code>/api/dues/pay</code> 주소의 주방 담당이고요.
      </Analogy>
      <Card>
        <h3 className="font-bold text-white text-sm mb-3">주요 표(테이블) 지도</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          {[
            ["users", "가입한 사람 (카카오 번호, 현재 팀)"],
            ["teams · team_users", "팀 정보 · 누가 어느 팀에서 무슨 역할인지"],
            ["team_members", "팀원 명단 (용병 포함, 나가면 left_at 기록)"],
            ["matches · match_stats", "경기 · 경기별 골/어시"],
            ["position_assignments", "포지션 배정 기록"],
            ["tactics_boards", "전술판 (선수 위치 tokens, 화살표 arrows)"],
            ["dues · dues_payments", "월별 회비 · 납부 기록"],
            ["votes · vote_options", "투표와 선택지"],
            ["tactics_ai_usage", "팀별 하루 AI 사용 횟수"],
            ["push_subscriptions", "알림 받을 휴대폰 주소"],
          ].map(([t, d]) => (
            <div key={t} className="bg-white/3 border border-white/5 rounded-lg p-2.5">
              <p className="font-mono text-emerald-300">{t}</p><p className="text-gray-500 mt-0.5">{d}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ────────────────────────────────────────────────────────────
//  PART 13 — 낱말 사전
// ────────────────────────────────────────────────────────────
const WORDS: [string, string][] = [
  ["브라우저", "인터넷 창을 여는 프로그램 (Chrome, Safari). 손님이 앉는 자리."],
  ["서버", "항상 켜져 있으면서 요청에 대답하는 컴퓨터. 주방."],
  ["API", "화면이 서버에게 일을 부탁하는 약속된 창구. 예: /api/members"],
  ["JSON", "데이터를 글자로 적는 약속. { \"name\": \"민수\" } 처럼 이름표와 값이 짝이에요."],
  ["데이터베이스(DB)", "정보를 표로 저장하는 곳. 엑셀의 아주 큰 버전."],
  ["세션 · 토큰", "로그인했다는 증거. 놀이공원 손목밴드."],
  ["RLS", "표마다 거는 자물쇠. 켜 두면 공개 열쇠로는 못 열어요."],
  ["환경변수", "코드에 쓰면 안 되는 비밀 값(키, 비밀번호)을 코드 밖에 따로 두는 곳."],
  ["컴포넌트", "화면의 레고 조각. 버튼, 카드, 사이드바 등을 한 번 만들고 여러 번 써요."],
  ["state(상태)", "화면이 기억하는 값. 값이 바뀌면 화면이 알아서 다시 그려져요."],
  ["프롬프트", "AI에게 보내는 질문과 지시문."],
  ["브랜치", "코드의 평행우주. 여기서 맘껏 고쳐도 원본(main)은 안 바뀌어요."],
  ["merge(병합)", "브랜치에서 한 수정을 원본에 합치는 일."],
  ["빌드", "코드를 진짜 서비스용으로 포장하는 일. 실패하면 배포하면 안 돼요."],
  ["배포", "만든 것을 인터넷에 올려 모두가 쓸 수 있게 하는 일."],
  ["정규화(dedupe)", "겹치는 항목을 하나로 합치는 일. 회비 화면에 같은 이름이 3번 나왔을 때 해결한 방법이에요."],
];

function Words() {
  return (
    <Card>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
        {WORDS.map(([w, d]) => (
          <div key={w}><dt className="text-emerald-400 font-bold text-sm">{w}</dt><dd className="text-gray-400 text-xs mt-0.5 leading-relaxed">{d}</dd></div>
        ))}
      </dl>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
//  페이지
// ────────────────────────────────────────────────────────────
export default function CodeGuidePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <SpmLogo size="sm" />
            <span className="text-gray-500 text-sm truncate">코드 설명서</span>
          </div>
          <Link href="/admin" className="text-sm text-gray-400 hover:text-white flex items-center gap-1 shrink-0"><ArrowLeft size={14} /> 관리자 홈</Link>
        </div>
        <nav className="max-w-4xl mx-auto px-4 pb-2 flex gap-1.5 overflow-x-auto" aria-label="목차">
          {SECTIONS.map((s, i) => (
            <a key={s.id} href={`#${s.id}`} className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10">
              {i + 1}. {s.title}
            </a>
          ))}
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-14">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black leading-tight">SPM은 어떻게 움직일까?</h1>
          <p className="text-gray-400 text-sm mt-2 leading-relaxed">
            코드를 몰라도 읽을 수 있게 그림과 비유로 설명했어요. 군데군데 <b className="text-emerald-400">직접 만져 볼 수 있는 데모</b>가 있어요.
            회색 상자의 &quot;진짜 코드&quot;는 실제 SPM 파일에서 가져온 거예요.
          </p>
        </div>

        <Section id="what" no={1} icon={Home} title="SPM이 뭐예요?"
          lead="동네 축구·풋살 팀의 반장 일을 대신해 주는 웹앱이에요. 종이와 단톡방에 흩어져 있던 일을 한곳에 모았어요.">
          <Card>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              {[
                [Users, "팀원 관리", "누가 팀에 있고, 어떤 포지션을 좋아하는지"],
                [MapIcon, "포지션 배정", "경기마다 누가 어느 자리에 설지 정하기 (AI 도움 가능)"],
                [Play, "전술판", "선수와 화살표를 그리고, 재생 버튼으로 움직임 보기"],
                [BookOpen, "경기 · 통계 · 피드백", "경기 기록, 골/어시 집계, 선수 피드백"],
                [UtensilsCrossed, "회비 · 투표", "누가 회비를 냈는지, 참석 투표"],
                [Rocket, "내전 · 팀 매칭", "팀 안에서 편 나누기, 다른 팀과 경기 잡기"],
              ].map(([Ic, t, d]) => {
                const Icon = Ic as LucideIcon;
                return (
                  <div key={t as string} className="flex gap-3 bg-white/3 border border-white/5 rounded-lg p-3">
                    <Icon size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <div><p className="text-white font-bold">{t as string}</p><p className="text-gray-500 mt-0.5">{d as string}</p></div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Section>

        <Section id="big" no={2} icon={UtensilsCrossed} title="전체 그림: 식당처럼 생각해요"
          lead="화면, 서버, 데이터베이스가 어떻게 이어져 있는지 한 장으로 볼게요.">
          <BigPicture />
        </Section>

        <Section id="login" no={3} icon={KeyRound} title="로그인은 어떻게 돼요?"
          lead="비밀번호 없이 카카오로 로그인해요. 처음 오면 팀까지 자동으로 만들어져요.">
          <LoginFlow />
        </Section>

        <Section id="journey" no={4} icon={ArrowRight} title="버튼 하나가 DB에 닿기까지"
          lead="'포지션 배정 저장'을 눌렀을 때 서버 안에서 일어나는 일을 한 단계씩 따라가 봐요. 역할을 바꾸면 어디서 멈추는지 볼 수 있어요.">
          <Journey />
        </Section>

        <Section id="team" no={5} icon={Users} title="팀마다 칸막이가 있어요"
          lead="수십 개 팀이 한 DB를 같이 써요. 서로의 기록이 섞이지 않게 하는 방법이에요.">
          <TeamWall />
        </Section>

        <Section id="roles" no={6} icon={ShieldCheck} title="역할과 권한"
          lead="팀장, 감독, 총무… 역할마다 할 수 있는 일이 달라요.">
          <Roles />
        </Section>

        <Section id="tactics" no={7} icon={MapIcon} title="전술판은 어떻게 움직여요?"
          lead="선수 동그라미를 옮기면 자리 이름과 포메이션 이름이 저절로 바뀌어요. 그 계산을 직접 해 보세요.">
          <PitchDemo />
        </Section>

        <Section id="ai" no={8} icon={Bot} title="AI는 어떻게 쓰고 있어요?"
          lead="AI에게 일을 시키되, AI의 말을 그대로 믿지는 않아요.">
          <AiPart />
        </Section>

        <Section id="push" no={9} icon={Smartphone} title="알림과 앱"
          lead="휴대폰 알림이 도착하는 길과, 웹사이트가 앱이 되는 방법이에요.">
          <PushApp />
        </Section>

        <Section id="security" no={10} icon={Lock} title="보안: 어떻게 지켜요?"
          lead="실제로 발견해서 고친 문제들이 바탕이에요. 틀렸던 경험이 규칙이 됐어요.">
          <Security />
        </Section>

        <Section id="deploy" no={11} icon={Rocket} title="코드가 사이트가 되기까지"
          lead="고친 코드가 바로 사용자에게 가지 않도록, 검사 단계와 '사람의 허락' 단계를 둬요.">
          <Deploy />
        </Section>

        <Section id="folders" no={12} icon={FolderTree} title="폴더 지도"
          lead="어디에 무엇이 있는지 알면 코드를 읽기가 훨씬 쉬워요.">
          <Folders />
        </Section>

        <Section id="words" no={13} icon={BookOpen} title="낱말 사전"
          lead="처음 보는 말이 나오면 여기서 찾아보세요.">
          <Words />
        </Section>

        <footer className="text-center text-gray-600 text-xs pb-10">
          이 페이지는 로컬 개발 환경에서만 보여요 (운영에서는 /admin 아래가 모두 404).
        </footer>
      </main>
    </div>
  );
}
