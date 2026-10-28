import { ImageResponse } from "next/og";
import { FORMATIONS } from "@/lib/formations";
import { getAssignmentPreview } from "@/lib/sharePreview";

// 카톡·SNS 미리보기 이미지: 포메이션 구장 + 자리 표시. 선수 이름은 넣지 않는다.
// 기본 폰트에는 한글이 없어서 영문·숫자(포메이션 이름, 자리 약어)만 그린다.
export const alt = "SPM 포지션 배정 라인업";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PITCH_W = 380;
const PITCH_H = 532; // 구장은 가로보다 1.4배 세로로 김
const DOT = 56;
const ASCII_LABEL = /^[A-Za-z0-9]{1,4}$/;
const ASCII_FORMATION = /^[0-9]+(-[0-9]+){1,5}$/;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getAssignmentPreview(id);

  const formationName = a?.formationName ?? "4-3-3";
  const slots = a?.formationSlots ?? FORMATIONS[formationName]?.slots ?? FORMATIONS["4-3-3"].slots;
  const showFormation = ASCII_FORMATION.test(formationName);

  const line = "rgba(255,255,255,0.35)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          backgroundImage: "linear-gradient(135deg, #0e261c 0%, #04080a 100%)",
          padding: "0 90px",
        }}
      >
        {/* 구장 */}
        <div
          style={{
            position: "relative",
            display: "flex",
            width: PITCH_W,
            height: PITCH_H,
            borderRadius: 24,
            backgroundImage: "linear-gradient(180deg, #166534 0%, #15803d 50%, #166534 100%)",
            border: `3px solid ${line}`,
          }}
        >
          <div style={{ position: "absolute", display: "flex", left: 0, right: 0, top: PITCH_H / 2 - 2, height: 3, backgroundColor: line }} />
          <div style={{ position: "absolute", display: "flex", left: PITCH_W / 2 - 50, top: PITCH_H / 2 - 52, width: 100, height: 100, borderRadius: 50, border: `3px solid ${line}` }} />
          <div style={{ position: "absolute", display: "flex", left: 90, top: 0, width: 200, height: 90, border: `3px solid ${line}` }} />
          <div style={{ position: "absolute", display: "flex", left: 90, bottom: 0, width: 200, height: 90, border: `3px solid ${line}` }} />
          {slots.map((s) => {
            const isGk = s.label === "GK";
            return (
              <div
                key={s.id}
                style={{
                  position: "absolute",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  left: (s.x / 100) * PITCH_W - DOT / 2,
                  top: (s.y / 100) * PITCH_H - DOT / 2,
                  width: DOT,
                  height: DOT,
                  borderRadius: DOT / 2,
                  backgroundColor: isGk ? "#f59e0b" : "#34d399",
                  border: "3px solid rgba(255,255,255,0.85)",
                  color: "#04120b",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {ASCII_LABEL.test(s.label) ? s.label : ""}
              </div>
            );
          })}
        </div>

        {/* 문구 */}
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 80, color: "white" }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#34d399" }}>SPM</div>
          {showFormation && (
            <div style={{ display: "flex", fontSize: 150, fontWeight: 700, lineHeight: 1.1, marginTop: 8 }}>{formationName}</div>
          )}
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: 8, color: "#9ca3af", marginTop: 12 }}>LINEUP</div>
          <div style={{ display: "flex", fontSize: 28, color: "#6b7280", marginTop: 40 }}>Sports Position Management</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
