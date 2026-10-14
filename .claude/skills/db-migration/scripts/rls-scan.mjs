// 공개(anon) 키로 읽히는 테이블이 있는지 점검 — 읽기 전용, 행 내용은 출력하지 않고 개수만 보여줌.
// 사용: 프로젝트 루트에서  node .claude/skills/db-migration/scripts/rls-scan.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const root = process.cwd();
const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf-8")
    .split("\n")
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// 코드(src)에서 .from("테이블") 로 쓰는 테이블을 자동으로 수집
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const tables = new Set();
for (const f of walk(join(root, "src"))) {
  for (const m of readFileSync(f, "utf-8").matchAll(/\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g)) tables.add(m[1]);
}

let exposed = 0;
let serverErrors = 0;
for (const t of [...tables].sort()) {
  const a = await admin.from(t).select("*", { count: "exact", head: true });
  const n = await anon.from(t).select("*", { count: "exact", head: true });
  const serverOk = !a.error;
  if (!serverOk) serverErrors++;
  const leaked = typeof n.count === "number" && n.count > 0;
  if (leaked) exposed++;
  // 행이 0개인 테이블은 RLS가 꺼져 있어도 0으로 보이므로 "확인불가"로 따로 표시
  const note = leaked ? "EXPOSED  " : !serverOk ? "SERVERERR " : a.count == null ? "unknown  " : a.count === 0 ? "empty    " : "ok       ";
  console.log(`${note}${t.padEnd(34)} server=${serverOk ? a.count : "ERR"}  anon_visible=${n.error ? "denied" : n.count}`);
}

console.log(`\n테이블 ${tables.size}개 점검 — 공개 키로 읽히는 테이블: ${exposed}개, 서버 접근 오류: ${serverErrors}개`);
if (exposed > 0) console.log("→ EXPOSED 표시된 테이블에 RLS를 켜고(pg_policies에 남은 '누구나 읽기' 정책도 삭제) 다시 점검하세요.");
console.log("※ 'empty'(행 0개)·'unknown'(개수를 못 읽음) 테이블은 이 점검으로 RLS 여부를 알 수 없음 — pg_tables.rowsecurity 로 직접 확인");
process.exitCode = exposed > 0 || serverErrors > 0 ? 1 : 0;
