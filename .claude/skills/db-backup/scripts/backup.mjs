// SPM 데이터 백업 — 코드가 쓰는 모든 테이블을 JSON으로 내려받고, 행 수를 DB 집계와 대조해 검증한다. 읽기 전용(쓰기·삭제 없음).
// 사용: 프로젝트 루트에서
//   node .claude/skills/db-backup/scripts/backup.mjs --dry-run              # 테이블별 행 수만 출력(파일 저장 안 함)
//   node .claude/skills/db-backup/scripts/backup.mjs                        # ../spm-backups/<날짜>/ 에 저장
//   node .claude/skills/db-backup/scripts/backup.mjs --with-files           # 사진 파일(gallery 버킷)도 내려받기
//   node .claude/skills/db-backup/scripts/backup.mjs --out D:/some/where    # 저장 위치 지정 (프로젝트 폴더 안은 거부)
// 주의: 결과 파일에는 이름·이메일 등 개인정보가 들어 있다. 프로젝트(git) 밖에만 저장하고 외부에 공유하지 않는다.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve, dirname, sep } from "path";

const root = process.cwd();
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const arg = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const dryRun = flag("--dry-run");
const withFiles = flag("--with-files");
const BUCKET = "gallery";
const PAGE = 1000;

const env = Object.fromEntries(
  readFileSync(join(root, ".env.local"), "utf-8")
    .split("\n")
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// 코드(src)에서 .from("테이블") 로 쓰는 테이블을 자동 수집 (db-migration/rls-scan 과 같은 방식)
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

const stamp = (() => {
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
})();
const outDir = resolve(arg("--out") ?? join(root, "..", "spm-backups"), arg("--out") ? "" : stamp);
if (!dryRun && (outDir === resolve(root) || outDir.startsWith(resolve(root) + sep))) {
  console.error("저장 위치가 프로젝트 폴더 안이에요. 개인정보가 git에 올라갈 수 있으니 프로젝트 밖으로 지정하세요.");
  process.exitCode = 1;
}

async function fetchAll(table) {
  const rows = [];
  let useOrder = true;
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select("*").range(from, from + PAGE - 1);
    if (useOrder) q = q.order("id", { ascending: true });
    let { data, error } = await q;
    if (error && useOrder) { useOrder = false; ({ data, error } = await db.from(table).select("*").range(from, from + PAGE - 1)); }
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function listAll(prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 100, offset });
    if (error) throw new Error(error.message);
    if (!data.length) break;
    for (const it of data) {
      const path = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id === null) out.push(...await listAll(path)); // 폴더
      else out.push({ path, size: it.metadata?.size ?? 0 });
    }
    if (data.length < 100) break;
  }
  return out;
}

if (process.exitCode !== 1) {
  console.log(`# SPM 백업 ${dryRun ? "(미리보기: 파일 저장 안 함)" : `→ ${outDir}`}\n`);
  if (!dryRun) mkdirSync(outDir, { recursive: true });

  const manifest = { createdAt: new Date().toISOString(), tables: [], storage: null };
  let totalRows = 0, problems = 0, warnings = 0;

  for (const t of [...tables].sort()) {
    try {
      const { count, error: cErr } = await db.from(t).select("*", { count: "exact", head: true });
      if (cErr) throw new Error(cErr.message);
      if (count == null) {
        // HEAD 요청은 오류 내용을 안 돌려주므로 일반 조회로 원인을 확인 (테이블이 DB에 없으면 PGRST205)
        const probe = await db.from(t).select("*").limit(1);
        if (probe.error?.code === "PGRST205") {
          warnings++;
          manifest.tables.push({ table: t, missing: true });
          console.log(`WARN     ${t.padEnd(34)} DB에 없는 테이블 (코드에서만 참조 — 버킷 이름이거나 버그일 수 있어요)`);
          continue;
        }
        throw new Error(probe.error?.message ?? "행 수를 읽지 못함");
      }
      let fetched = count;
      if (!dryRun) {
        const rows = await fetchAll(t);
        fetched = rows.length;
        writeFileSync(join(outDir, `${t}.json`), JSON.stringify(rows));
      }
      const ok = fetched === count;
      if (!ok) problems++;
      totalRows += fetched;
      manifest.tables.push({ table: t, count, fetched, ok });
      console.log(`${ok ? "ok      " : "MISMATCH"} ${t.padEnd(34)} ${String(count).padStart(7)}행${dryRun ? "" : `  (저장 ${fetched})`}`);
    } catch (e) {
      problems++;
      manifest.tables.push({ table: t, error: e.message });
      console.log(`ERROR    ${t.padEnd(34)} ${e.message}`);
    }
  }

  // 사진(Storage)은 DB 백업에 들어가지 않으므로 목록을 따로 남긴다
  try {
    const files = await listAll();
    const bytes = files.reduce((s, f) => s + f.size, 0);
    manifest.storage = { bucket: BUCKET, files: files.length, bytes, downloaded: 0, list: dryRun ? undefined : files };
    console.log(`\n사진(${BUCKET}): ${files.length}개, ${(bytes / 1024 / 1024).toFixed(1)}MB`);
    if (!dryRun && withFiles) {
      for (const f of files) {
        const { data, error } = await db.storage.from(BUCKET).download(f.path);
        if (error) { problems++; console.log(`ERROR    사진 ${f.path}: ${error.message}`); continue; }
        const target = join(outDir, "storage", BUCKET, ...f.path.split("/"));
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, Buffer.from(await data.arrayBuffer()));
        manifest.storage.downloaded++;
      }
      console.log(`사진 파일 저장: ${manifest.storage.downloaded}/${files.length}`);
    } else if (!dryRun) {
      console.log("(사진 파일은 목록만 저장했어요. 파일까지 받으려면 --with-files)");
    }
  } catch (e) {
    problems++;
    console.log(`ERROR    사진 목록: ${e.message}`);
  }

  if (!dryRun) writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\n테이블 ${tables.size}개, 총 ${totalRows}행 — 문제 ${problems}건, 경고 ${warnings}건(DB에 없는 테이블)`);
  if (warnings > 0) console.log("→ 경고가 난 이름을 코드에서 어떻게 쓰는지 확인하세요 (사진 버킷 이름이 아니라면 존재하지 않는 테이블을 쓰는 버그).");
  console.log("※ 결과에는 개인정보가 들어 있어요. 프로젝트(git) 밖에 보관하고 공유하지 마세요.");
  process.exitCode = problems > 0 ? 1 : 0;
}
