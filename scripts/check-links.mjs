#!/usr/bin/env node
/* 站內連結守門：dist/ 裡每一條指向站內的連結都必須有對應產出，否則 exit 1。
 *
 * 與 check-urls.mjs 的分工：
 *   check-urls  管「舊站有的網址，新站還在不在」（對外承諾）
 *   check-links 管「新站自己頁面上的連結，點下去會不會 404」（對內一致）
 * 兩者都過才准上線。
 *
 * 檢查範圍：
 *   - a[href]、img[src]、img[srcset]、source[src|srcset]、link[href]、script[src]、
 *     video/audio[src]、iframe[src] 之中以 / 開頭的路徑
 *   - 同頁錨點（#foo）與跨頁錨點（/a/b/#foo）會驗目標頁上是否真有那個 id
 *   - 外部網址（http://、https://、mailto:、tel:）不在此腳本範圍——連外部站要靠別的機制，
 *     在 CI 打幾百個外站既慢又會因對方擋爬蟲而假性失敗
 *
 * EXTERNAL_PREFIXES：由**別的來源**服務、不會出現在 dist/ 的路徑前綴（例如圖片放 R2）。
 * 這些不算違規，但每次都會印出條數——避免「設一個前綴就把整批漏檢藏起來」。
 *
 * 用法：node scripts/check-links.mjs [--dist dist] [--max-report 40]
 */
import { readFile, readdir, access } from 'node:fs/promises';
import { join, relative, posix } from 'node:path';

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const DIST = argVal('--dist', 'dist');
const MAX_REPORT = Number(argVal('--max-report', 40));
const REDIRECTS = 'redirects.json';

/* 圖片落點未定：舊站圖片網址 /wp-content/uploads/** 目前不在 dist/ 裡。
 * 決定放進 repo 就把這一條拿掉；決定放 R2/Cloudflare 就留著。 */
const EXTERNAL_PREFIXES = [
  '/wp-content/uploads/',
];

async function exists(p) { try { await access(p); return true; } catch { return false; } }

/** 網址正規化成可比對的 pathname（解碼、補結尾斜線） */
function toPath(p) {
  try { p = decodeURIComponent(p); } catch { /* 已是解碼狀態 */ }
  if (!p.startsWith('/')) p = `/${p}`;
  p = posix.normalize(p);
  if (!p.endsWith('/') && !/\.[a-z0-9]{2,6}$/i.test(p)) p += '/';
  return p;
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

// ── 1. 建立 dist 產出索引：路徑 → 該頁的 id 集合 ──
const pagePaths = new Set();   // 可被連結的路徑（頁面與靜態檔）
const pageIds = new Map();     // 頁面路徑 → Set<id>
const htmlFiles = [];

for await (const file of walk(DIST)) {
  const rel = relative(DIST, file);
  if (file.endsWith('.html')) {
    const p = rel === 'index.html'
      ? '/'
      : rel.endsWith('/index.html')
        ? `/${rel.slice(0, -'index.html'.length)}`
        : `/${rel}`;
    pagePaths.add(toPath(p));
    htmlFiles.push({ file, path: toPath(p) });
  } else {
    pagePaths.add(toPath(`/${rel}`));
  }
}

// 有 301 的舊網址也算有效目標
const redirects = await exists(REDIRECTS) ? JSON.parse(await readFile(REDIRECTS, 'utf8')) : {};
for (const k of Object.keys(redirects)) if (k.startsWith('/')) pagePaths.add(toPath(k));

// ── 2. 收集每頁的 id（給錨點驗證用）──
const idRe = /\sid="([^"]+)"/g;
const htmlCache = new Map();
for (const { file, path } of htmlFiles) {
  const html = await readFile(file, 'utf8');
  htmlCache.set(path, html);
  const ids = new Set();
  for (const m of html.matchAll(idRe)) ids.add(m[1]);
  pageIds.set(path, ids);
}

// ── 3. 掃連結 ──
const attrRe = /<(a|img|link|script|source|video|audio|iframe)\b[^>]*?\s(?:href|src)="([^"]+)"/gi;
const srcsetRe = /<(?:img|source)\b[^>]*?\ssrcset="([^"]+)"/gi;

const broken = [];        // { from, url, why }
let externalSkipped = 0;
let checked = 0;

function checkOne(fromPath, raw) {
  const url = raw.trim();
  if (!url) return;
  if (/^(https?:|mailto:|tel:|data:|javascript:|#)/i.test(url)) {
    // 同頁錨點
    if (url.startsWith('#') && url.length > 1) {
      checked += 1;
      const id = decodeURIComponent(url.slice(1));
      if (!pageIds.get(fromPath)?.has(id)) broken.push({ from: fromPath, url, why: '同頁找不到這個 id' });
    }
    return;
  }
  if (!url.startsWith('/')) return;   // 相對路徑：Astro 產出不會有，出現也交給 build 抓

  if (EXTERNAL_PREFIXES.some(pre => url.startsWith(pre))) { externalSkipped += 1; return; }

  checked += 1;
  const [rawPath, hash] = url.split('#');
  const target = toPath(rawPath || '/');
  if (!pagePaths.has(target)) {
    broken.push({ from: fromPath, url, why: 'dist 裡沒有這個路徑' });
    return;
  }
  if (hash) {
    const ids = pageIds.get(target);
    if (ids && !ids.has(decodeURIComponent(hash))) {
      broken.push({ from: fromPath, url, why: `目標頁沒有 id="${decodeURIComponent(hash)}"` });
    }
  }
}

for (const { path } of htmlFiles) {
  const html = htmlCache.get(path);
  for (const m of html.matchAll(attrRe)) checkOne(path, m[2]);
  for (const m of html.matchAll(srcsetRe)) {
    for (const part of m[1].split(',')) checkOne(path, part.trim().split(/\s+/)[0]);
  }
}

// ── 4. 報告 ──
console.log('===== 站內連結檢查 =====');
console.log(`掃描頁面：${htmlFiles.length} 頁`);
console.log(`檢查連結：${checked} 條`);
if (externalSkipped) {
  console.log(`外部託管前綴略過：${externalSkipped} 條（${EXTERNAL_PREFIXES.join('、')}）`);
}

if (broken.length) {
  // 同一條壞連結常出現在很多頁（頁首/頁尾）→ 依 url 收斂，只列來源頁數
  const byUrl = new Map();
  for (const b of broken) {
    const k = `${b.url}\t${b.why}`;
    if (!byUrl.has(k)) byUrl.set(k, { ...b, count: 0, sample: b.from });
    byUrl.get(k).count += 1;
  }
  const list = [...byUrl.values()].sort((a, b) => b.count - a.count);
  console.error(`\n✗ 有 ${broken.length} 處無效連結（${list.length} 條不同網址）：`);
  for (const b of list.slice(0, MAX_REPORT)) {
    console.error(`  ${b.url}`);
    console.error(`     ${b.why}；出現 ${b.count} 次，例如 ${b.sample}`);
  }
  if (list.length > MAX_REPORT) console.error(`  …另有 ${list.length - MAX_REPORT} 條`);
  console.error('\n修法：補上目標頁、修正連結，或（若該路徑由別的來源服務）加進 EXTERNAL_PREFIXES。');
  process.exit(1);
}

console.log('\n✓ 站內連結全部有效');
