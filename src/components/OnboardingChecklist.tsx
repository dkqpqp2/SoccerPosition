"use client";

import { useState } from "react";
import { Rocket, Check, X } from "lucide-react";
import { buildInviteShare, getOnboardingSteps, type OnboardingStep } from "@/lib/onboarding";

const dismissKey = (teamId: string) => `spm_onboarding_dismissed_${teamId}`;

function readDismissed(teamId: string): boolean {
  try {
    return localStorage.getItem(dismissKey(teamId)) === "1";
  } catch {
    return false; // 저장소를 못 읽는 환경(사생활 보호 모드 등)에서는 닫히지 않은 것으로 본다
  }
}

/**
 * 새 팀장용 "시작하기" 카드: 팀 이름 → 팀원 초대 → 첫 경기 → 포지션 배정.
 * 4단계를 모두 마쳤거나 닫으면 보이지 않는다. 닫은 기록은 팀별로 이 기기에만 저장한다.
 */
export default function OnboardingChecklist({
  teamId,
  teamName,
  inviteCode,
  memberCount,
  matchCount,
  assignmentCount,
  onGoMatches,
  onGoAssign,
  onGoMyPage,
}: {
  teamId: string;
  teamName: string;
  inviteCode: string;
  memberCount: number;
  matchCount: number;
  assignmentCount: number;
  onGoMatches: () => void;
  onGoAssign: () => void;
  onGoMyPage: () => void;
}) {
  const [dismissedTeam, setDismissedTeam] = useState<string | null>(null); // 이번 화면에서 닫은 팀
  const [copied, setCopied] = useState(false);

  const { steps, doneCount, allDone } = getOnboardingSteps({ teamName, memberCount, matchCount, assignmentCount });
  if (allDone || dismissedTeam === teamId || readDismissed(teamId)) return null;

  function dismiss() {
    setDismissedTeam(teamId);
    try {
      localStorage.setItem(dismissKey(teamId), "1");
    } catch {
      // 저장에 실패해도 이번 화면에서는 닫힌다
    }
  }

  async function shareInvite() {
    const share = buildInviteShare(teamName, `${window.location.origin}/join?code=${inviteCode}`);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(share);
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // 사용자가 공유 창을 닫은 것
        // 그 밖의 실패는 링크 복사로 대신한다
      }
    }
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("이 링크를 복사해서 팀원에게 보내 주세요", share.url);
    }
  }

  const action: Record<OnboardingStep["key"], { label: string; run: () => void }> = {
    name: { label: "설정하기", run: onGoMyPage },
    invite: { label: copied ? "복사했어요 ✓" : "카톡으로 보내기", run: () => void shareInvite() },
    match: { label: "등록하러 가기", run: onGoMatches },
    assign: { label: "배정하러 가기", run: onGoAssign },
  };

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Rocket size={20} className="text-emerald-400 shrink-0" strokeWidth={1.75} />
        <p className="font-bold text-emerald-300 text-sm flex-1">우리 팀 시작하기 <span className="text-emerald-400/70 font-semibold">({doneCount}/{steps.length})</span></p>
        <button onClick={dismiss} aria-label="시작하기 닫기" className="text-gray-500 hover:text-gray-300 p-1">
          <X size={16} />
        </button>
      </div>
      <ul className="space-y-2">
        {steps.map(step => (
          <li key={step.key} className="flex items-center gap-2.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${step.done ? "bg-emerald-500 text-black" : "border border-gray-600"}`}>
              {step.done && <Check size={12} strokeWidth={3} />}
            </span>
            <span className={`flex-1 text-sm ${step.done ? "text-gray-500 line-through" : "text-white font-medium"}`}>{step.label}</span>
            {!step.done && (
              <button
                onClick={action[step.key].run}
                className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap"
              >
                {action[step.key].label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
