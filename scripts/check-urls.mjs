#!/usr/bin/env node
/* 網址保留契約守門。
 *
 * 舊站（WordPress）有 1,300+ 條已被搜尋引擎收錄的網址，改版後一條都不能斷。
 * 本腳本比對「契約清冊 legacy-urls.txt」與「dist/ 實際產出」，少一條就 exit 1。
 *
 * 契約清冊怎麼來：scripts/build-url-contract.mjs 由舊站 sitemap + WP REST 匯出後產生，
 * 產出後 commit 進 repo（純網址清單，非內容）。舊站關閉後也還在，是唯一真實來源。
 *
 * 例外只有一種：redirects.json 明示的 301 對照（舊網址 → 新網址）。
 * 「這頁我覺得不用留」不是例外——要砍網址得用戶點頭，寫進 redirects.json 或 legacy-urls-retired.txt。
 *
 * 用法：node scripts/check-urls.mjs [--dist dist] [--contract legacy-urls.txt]
 */
import { readFile, readdir, access } from 'node:fs/promises';
import { join, relative } from 'node:path';

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const DIST = argVal('--dist', 'dist');
const CONTRACT = argVal('--contract', 'legacy-urls.txt');
const RETIRED = 'legacy-urls-retired.txt';
const PENDING = 'pending-urls.txt';   // 舊站有、但去留未經用戶決定的網址
const REDIRECTS = 'redirects.json';

async function exists(p) { try { await access(p); return true; } catch { return false; } }

/** 把網址正規化成可比對的 pathname：解 percent-encoding、確保結尾斜線 */
function toPath(url) {
  let p;
  try {
    p = url.startsWith('http') ? new URL(url).pathname : url;
  } catch {
    p = url;
  }
  try { p = decodeURIComponent(p); } catch { /* 已是解碼狀態 */ }
  if (!p.startsWith('/')) p = `/${p}`;
  // 檔案（.xml/.kml/.txt…）不補斜線，目錄式路徑一律補
  if (!p.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(p)) p += '/';
  return p;
}

/** 走訪 dist/，把每個 index.html 與靜態檔換算成對外路徑 */
async function collectDistPaths(dir, root = dir, out = new Set()) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectDistPaths(full, root, out);
    } else {
      const rel = relative(root, full);
      if (entry.name === 'index.html') {
        const p = rel === 'index.html' ? '/' : `/${rel.slice(0, -'index.html'.length)}`;
        out.add(toPath(p));
      } else {
        out.add(toPath(`/${rel}`));
      }
    }
  }
  return out;
}

async function readList(file) {
  if (!await exists(file)) return [];
  return (await readFile(file, 'utf8'))
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}

if (!await exists(CONTRACT)) {
  console.error(`✗ 找不到網址契約清冊 ${CONTRACT}。先跑：node scripts/build-url-contract.mjs`);
  process.exit(1);
}
if (!await exists(DIST)) {
  console.error(`✗ 找不到 ${DIST}/。先跑 pnpm build。`);
  process.exit(1);
}

const contract = (await readList(CONTRACT)).map(toPath);
const retired = new Set((await readList(RETIRED)).map(toPath));
const redirects = await exists(REDIRECTS)
  ? JSON.parse(await readFile(REDIRECTS, 'utf8'))
  : {};
// redirects.json 裡有 _comment 這種說明欄位，不是路徑 → 只認 / 開頭的 key
const redirectFrom = new Set(Object.keys(redirects).filter(k => k.startsWith('/')).map(toPath));

const built = await collectDistPaths(DIST);

const missing = [];
for (const p of contract) {
  if (built.has(p)) continue;
  if (redirectFrom.has(p)) continue;   // 有明示 301
  if (retired.has(p)) continue;        // 用戶明示同意下架
  missing.push(p);
}

const pending = await readList(PENDING);

console.log('===== 網址保留契約 =====');
console.log(`契約網址：${contract.length} 條`);
console.log(`dist 產出：${built.size} 條`);
console.log(`明示 301：${redirectFrom.size} 條　用戶同意下架：${retired.size} 條`);
if (pending.length) {
  // 待決不算違規（還沒進契約），但每次都要看得見，免得默默消失
  console.log(`\n⚠ 待用戶決定去留：${pending.length} 條（見 ${PENDING} 檔頭說明）`);
}

if (missing.length) {
  console.error(`\n✗ 有 ${missing.length} 條舊網址在新站消失（前 50 條）：`);
  for (const p of missing.slice(0, 50)) console.error(`  ${p}`);
  if (missing.length > 50) console.error(`  …另有 ${missing.length - 50} 條`);
  console.error('\n修法：補上對應頁面，或在 redirects.json 寫明 301 目的地，');
  console.error('     或（需用戶明示同意）加進 legacy-urls-retired.txt。');
  process.exit(1);
}

console.log('\n✓ 舊站網址全數保留');
