export interface PositionSlot {
  id: string;
  label: string;
  x: number; // 0~100 (%)
  y: number; // 0~100 (%)
}

export interface Formation {
  name: string;
  slots: PositionSlot[];
  type?: "soccer" | "futsal";
}

export const FORMATIONS: Record<string, Formation> = {
  // ─── 축구 ───
  "4-3-3": {
    name: "4-3-3",
    type: "soccer",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "LB", label: "LB", x: 15, y: 72 },
      { id: "CB1", label: "CB", x: 35, y: 72 },
      { id: "CB2", label: "CB", x: 65, y: 72 },
      { id: "RB", label: "RB", x: 85, y: 72 },
      { id: "CM1", label: "CM", x: 25, y: 50 },
      { id: "CM2", label: "CM", x: 50, y: 50 },
      { id: "CM3", label: "CM", x: 75, y: 50 },
      { id: "LW", label: "LW", x: 15, y: 25 },
      { id: "ST", label: "ST", x: 50, y: 18 },
      { id: "RW", label: "RW", x: 85, y: 25 },
    ],
  },
  "4-4-2": {
    name: "4-4-2",
    type: "soccer",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "LB", label: "LB", x: 15, y: 72 },
      { id: "CB1", label: "CB", x: 35, y: 72 },
      { id: "CB2", label: "CB", x: 65, y: 72 },
      { id: "RB", label: "RB", x: 85, y: 72 },
      { id: "LM", label: "LM", x: 15, y: 50 },
      { id: "CM1", label: "CM", x: 37, y: 50 },
      { id: "CM2", label: "CM", x: 63, y: 50 },
      { id: "RM", label: "RM", x: 85, y: 50 },
      { id: "ST1", label: "ST", x: 35, y: 22 },
      { id: "ST2", label: "ST", x: 65, y: 22 },
    ],
  },
  "4-1-4-1": {
    name: "4-1-4-1",
    type: "soccer",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "LB", label: "LB", x: 15, y: 75 },
      { id: "CB1", label: "CB", x: 35, y: 75 },
      { id: "CB2", label: "CB", x: 65, y: 75 },
      { id: "RB", label: "RB", x: 85, y: 75 },
      { id: "CDM", label: "CDM", x: 50, y: 60 },
      { id: "LM", label: "LM", x: 15, y: 43 },
      { id: "CM1", label: "CM", x: 37, y: 43 },
      { id: "CM2", label: "CM", x: 63, y: 43 },
      { id: "RM", label: "RM", x: 85, y: 43 },
      { id: "ST", label: "ST", x: 50, y: 15 },
    ],
  },
  "3-5-2": {
    name: "3-5-2",
    type: "soccer",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "CB1", label: "CB", x: 25, y: 73 },
      { id: "CB2", label: "CB", x: 50, y: 73 },
      { id: "CB3", label: "CB", x: 75, y: 73 },
      { id: "LWB", label: "LWB", x: 10, y: 53 },
      { id: "CM1", label: "CM", x: 30, y: 50 },
      { id: "CM2", label: "CM", x: 50, y: 50 },
      { id: "CM3", label: "CM", x: 70, y: 50 },
      { id: "RWB", label: "RWB", x: 90, y: 53 },
      { id: "ST1", label: "ST", x: 35, y: 22 },
      { id: "ST2", label: "ST", x: 65, y: 22 },
    ],
  },

  // ─── 풋살 5vs5 (GK+4) ───
  "풋살 5vs5 (2-1-1)": {
    name: "풋살 5vs5 (2-1-1)",
    type: "futsal",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "DEF1", label: "DEF", x: 30, y: 70 },
      { id: "DEF2", label: "DEF", x: 70, y: 70 },
      { id: "MID", label: "MID", x: 50, y: 48 },
      { id: "FWD", label: "FWD", x: 50, y: 22 },
    ],
  },
  "풋살 5vs5 (1-2-1)": {
    name: "풋살 5vs5 (1-2-1)",
    type: "futsal",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "DEF", label: "DEF", x: 50, y: 70 },
      { id: "MID1", label: "MID", x: 28, y: 48 },
      { id: "MID2", label: "MID", x: 72, y: 48 },
      { id: "FWD", label: "FWD", x: 50, y: 22 },
    ],
  },

  // ─── 풋살 6vs6 (GK+5) ───
  "풋살 6vs6 (2-2-1)": {
    name: "풋살 6vs6 (2-2-1)",
    type: "futsal",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "DEF1", label: "DEF", x: 28, y: 72 },
      { id: "DEF2", label: "DEF", x: 72, y: 72 },
      { id: "MID1", label: "MID", x: 28, y: 48 },
      { id: "MID2", label: "MID", x: 72, y: 48 },
      { id: "FWD", label: "FWD", x: 50, y: 22 },
    ],
  },
  "풋살 6vs6 (2-1-2)": {
    name: "풋살 6vs6 (2-1-2)",
    type: "futsal",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "DEF1", label: "DEF", x: 28, y: 72 },
      { id: "DEF2", label: "DEF", x: 72, y: 72 },
      { id: "MID", label: "MID", x: 50, y: 52 },
      { id: "FWD1", label: "FWD", x: 28, y: 22 },
      { id: "FWD2", label: "FWD", x: 72, y: 22 },
    ],
  },

  // ─── 풋살 7vs7 (GK+6) ───
  "풋살 7vs7 (2-3-1)": {
    name: "풋살 7vs7 (2-3-1)",
    type: "futsal",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "DEF1", label: "DEF", x: 28, y: 73 },
      { id: "DEF2", label: "DEF", x: 72, y: 73 },
      { id: "MID1", label: "MID", x: 18, y: 50 },
      { id: "MID2", label: "MID", x: 50, y: 50 },
      { id: "MID3", label: "MID", x: 82, y: 50 },
      { id: "FWD", label: "FWD", x: 50, y: 22 },
    ],
  },
  "풋살 7vs7 (3-2-1)": {
    name: "풋살 7vs7 (3-2-1)",
    type: "futsal",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "DEF1", label: "DEF", x: 20, y: 73 },
      { id: "DEF2", label: "DEF", x: 50, y: 73 },
      { id: "DEF3", label: "DEF", x: 80, y: 73 },
      { id: "MID1", label: "MID", x: 30, y: 50 },
      { id: "MID2", label: "MID", x: 70, y: 50 },
      { id: "FWD", label: "FWD", x: 50, y: 22 },
    ],
  },

  // ─── 풋살 8vs8 (GK+7) ───
  "풋살 8vs8 (3-3-1)": {
    name: "풋살 8vs8 (3-3-1)",
    type: "futsal",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "DEF1", label: "DEF", x: 20, y: 73 },
      { id: "DEF2", label: "DEF", x: 50, y: 73 },
      { id: "DEF3", label: "DEF", x: 80, y: 73 },
      { id: "MID1", label: "MID", x: 20, y: 50 },
      { id: "MID2", label: "MID", x: 50, y: 50 },
      { id: "MID3", label: "MID", x: 80, y: 50 },
      { id: "FWD", label: "FWD", x: 50, y: 22 },
    ],
  },
  "풋살 8vs8 (3-2-2)": {
    name: "풋살 8vs8 (3-2-2)",
    type: "futsal",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "DEF1", label: "DEF", x: 20, y: 73 },
      { id: "DEF2", label: "DEF", x: 50, y: 73 },
      { id: "DEF3", label: "DEF", x: 80, y: 73 },
      { id: "MID1", label: "MID", x: 30, y: 50 },
      { id: "MID2", label: "MID", x: 70, y: 50 },
      { id: "FWD1", label: "FWD", x: 28, y: 22 },
      { id: "FWD2", label: "FWD", x: 72, y: 22 },
    ],
  },

  // ─── 풋살 9vs9 (GK+8) ───
  "풋살 9vs9 (3-3-2)": {
    name: "풋살 9vs9 (3-3-2)",
    type: "futsal",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "DEF1", label: "DEF", x: 20, y: 73 },
      { id: "DEF2", label: "DEF", x: 50, y: 73 },
      { id: "DEF3", label: "DEF", x: 80, y: 73 },
      { id: "MID1", label: "MID", x: 20, y: 50 },
      { id: "MID2", label: "MID", x: 50, y: 50 },
      { id: "MID3", label: "MID", x: 80, y: 50 },
      { id: "FWD1", label: "FWD", x: 30, y: 22 },
      { id: "FWD2", label: "FWD", x: 70, y: 22 },
    ],
  },
  "풋살 9vs9 (4-3-1)": {
    name: "풋살 9vs9 (4-3-1)",
    type: "futsal",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "DEF1", label: "DEF", x: 15, y: 73 },
      { id: "DEF2", label: "DEF", x: 38, y: 73 },
      { id: "DEF3", label: "DEF", x: 62, y: 73 },
      { id: "DEF4", label: "DEF", x: 85, y: 73 },
      { id: "MID1", label: "MID", x: 20, y: 50 },
      { id: "MID2", label: "MID", x: 50, y: 50 },
      { id: "MID3", label: "MID", x: 80, y: 50 },
      { id: "FWD", label: "FWD", x: 50, y: 22 },
    ],
  },

  // ─── 풋살 10vs10 (GK+9) ───
  "풋살 10vs10 (4-3-2)": {
    name: "풋살 10vs10 (4-3-2)",
    type: "futsal",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "DEF1", label: "DEF", x: 15, y: 73 },
      { id: "DEF2", label: "DEF", x: 38, y: 73 },
      { id: "DEF3", label: "DEF", x: 62, y: 73 },
      { id: "DEF4", label: "DEF", x: 85, y: 73 },
      { id: "MID1", label: "MID", x: 20, y: 50 },
      { id: "MID2", label: "MID", x: 50, y: 50 },
      { id: "MID3", label: "MID", x: 80, y: 50 },
      { id: "FWD1", label: "FWD", x: 30, y: 22 },
      { id: "FWD2", label: "FWD", x: 70, y: 22 },
    ],
  },
  "풋살 10vs10 (4-4-1)": {
    name: "풋살 10vs10 (4-4-1)",
    type: "futsal",
    slots: [
      { id: "GK", label: "GK", x: 50, y: 90 },
      { id: "DEF1", label: "DEF", x: 15, y: 73 },
      { id: "DEF2", label: "DEF", x: 38, y: 73 },
      { id: "DEF3", label: "DEF", x: 62, y: 73 },
      { id: "DEF4", label: "DEF", x: 85, y: 73 },
      { id: "MID1", label: "MID", x: 15, y: 50 },
      { id: "MID2", label: "MID", x: 38, y: 50 },
      { id: "MID3", label: "MID", x: 62, y: 50 },
      { id: "MID4", label: "MID", x: 85, y: 50 },
      { id: "FWD", label: "FWD", x: 50, y: 22 },
    ],
  },
};

export const SOCCER_FORMATIONS = Object.entries(FORMATIONS)
  .filter(([, f]) => f.type === "soccer" || !f.type)
  .map(([key]) => key);

export const FUTSAL_FORMATIONS: Record<string, string[]> = {
  "5vs5": Object.keys(FORMATIONS).filter(k => k.includes("5vs5")),
  "6vs6": Object.keys(FORMATIONS).filter(k => k.includes("6vs6")),
  "7vs7": Object.keys(FORMATIONS).filter(k => k.includes("7vs7")),
  "8vs8": Object.keys(FORMATIONS).filter(k => k.includes("8vs8")),
  "9vs9": Object.keys(FORMATIONS).filter(k => k.includes("9vs9")),
  "10vs10": Object.keys(FORMATIONS).filter(k => k.includes("10vs10")),
};
