#!/usr/bin/env node
/* 跟 R2 對帳：bucket 裡的物件是否與本機鏡像（.source/uploads）逐檔一致。
 *
 * 為什麼需要這支：check-links.mjs 把 /wp-content/uploads/* 當成「外部託管前綴」略過
 * （那些檔不在 dist/ 裡），所以連結守門綠了**不代表圖片真的在 R2**。這支才是圖片那一半的帳。
 *
 * 對兩份帳：
 *   ①（鏡像帳）本機 .source/uploads 的每個檔都在 R2，且 size 一致（抓上傳截斷）。
 *   ②（產出帳）dist/ 的 HTML 實際參照到的每個圖片網址，R2 都有對應物件——
 *      這才是「站上的圖會不會破」的那一本，dist/ 存在時自動跑。
 * 憑證與 token 更新沿用 r2-upload.mjs 的做法（wrangler OAuth token，約 1 小時到期）。
 *
 * 用法：node scripts/r2-verify.mjs [--bucket …] [--dir .source/uploads]
 *                                  [--dist dist] [--json out.json]
 */
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { R2_BUCKET, CF_ACCOUNT_ID, ASSET_BASE, ASSET_PREFIXES } from '../site.config.mjs';

const run = promisify(execFile);
const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BUCKET = argVal('--bucket', R2_BUCKET);
const DIR = argVal('--dir', '.source/uploads');
const JSON_OUT = argVal('--json', null);
const DIST = argVal('--dist', 'dist');
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || CF_ACCOUNT_ID;
const WRANGLER_CONFIG = '/root/.config/.wrangler/config/default.toml';

let token = null;
let tokenExpiry = 0;

async function loadToken() {
  const toml = await readFile(WRANGLER_CONFIG, 'utf8');
  const t = toml.match(/oauth_token\s*=\s*"([^"]+)"/);
  const e = toml.match(/expiration_time\s*=\s*"([^"]+)"/);
  if (!t) throw new Error('讀不到 oauth_token，請先跑 npx wrangler login');
  token = t[1];
  tokenExpiry = e ? Date.parse(e[1]) : 0;
}

async function ensureToken() {
  if (token && tokenExpiry - Date.now() > 5 * 60 * 1000) return;
  if (token) {
    process.stderr.write('  ↻ token 快到期，觸發 wrangler 更新…\n');
    try { await run('npx', ['wrangler@latest', 'r2', 'bucket', 'list'], { env: process.env }); } catch { /* 失敗就用舊的試 */ }
  }
  await loadToken();
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

/* R2 的 list 一次最多 1000 筆，用 cursor 翻頁翻到底。 */
async function listRemote() {
  const out = new Map();
  let cursor = null;
  for (;;) {
    await ensureToken();
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects`);
    url.searchParams.set('per_page', '1000');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`列出物件失敗 HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    if (!body.success) throw new Error(`列出物件失敗：${JSON.stringify(body.errors).slice(0, 200)}`);
    for (const o of body.result) out.set(o.key, o.size);
    process.stderr.write(`\r  已列出 ${out.size} 個物件…`);
    cursor = body.result_info?.cursor;
    if (!body.result_info?.is_truncated || !cursor) break;
  }
  process.stderr.write('\n');
  return out;
}

const local = new Map();
for await (const f of walk(DIR)) local.set(relative(DIR, f), (await stat(f)).size);

const remote = await listRemote();

/* dist/ 的 HTML 參照到哪些圖片。ASSET_BASE 有值時是絕對網址，空字串時是站內路徑，
 * 兩種都要認得。網址在 HTML 裡是百分比編碼的，物件 key 是原字，比對前先解碼。 */
async function collectDistRefs() {
  const files = [];
  try { for await (const f of walk(DIST)) if (f.endsWith('.html')) files.push(f); }
  catch { return null; }               // 沒有 dist/（還沒 build）→ 這本帳跳過
  if (!files.length) return null;
  const prefixes = ASSET_PREFIXES.flatMap(p => (ASSET_BASE ? [ASSET_BASE + p] : [p]));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:${prefixes.map(esc).join('|')})[^"'\\s>),]+`, 'g');
  const refs = new Set();
  for (const f of files) {
    for (const m of (await readFile(f, 'utf8')).match(re) || []) {
      // 物件 key 是網址路徑去掉開頭斜線（同 r2-upload.mjs），這裡對齊成同一種寫法
      let u = m.split('#')[0].split('?')[0];
      if (ASSET_BASE && u.startsWith(ASSET_BASE)) u = u.slice(ASSET_BASE.length);
      refs.add(decodeURIComponent(u.replace(/&(amp|#38);/g, '&')).replace(/^\//, ''));
    }
  }
  return refs;
}

const missing = [];
const sizeMismatch = [];
for (const [key, size] of local) {
  if (!remote.has(key)) missing.push(key);
  else if (remote.get(key) !== size) sizeMismatch.push({ key, local: size, remote: remote.get(key) });
}
// bucket 裡多出來的物件不算錯（可能是別的來源），但要讓人看得到
const extra = [...remote.keys()].filter(k => !local.has(k));

const distRefs = await collectDistRefs();
const distMissing = distRefs ? [...distRefs].filter(k => !remote.has(k)).sort() : [];

console.log('===== R2 圖片對帳 =====');
console.log(`bucket：${BUCKET}`);
console.log(`本機鏡像：${local.size} 個檔（${DIR}）`);
console.log(`R2 物件：${remote.size} 個`);
console.log(`缺漏：${missing.length}　大小不符：${sizeMismatch.length}　bucket 多出：${extra.length}`);

if (distRefs) console.log(`${DIST}/ 參照到的圖片：${distRefs.size} 個　R2 沒有的：${distMissing.length}`);
else console.log(`${DIST}/ 未產出 → 產出帳略過（跑過 pnpm build 才驗得到）`);

for (const k of missing.slice(0, 20)) console.log(`  ✗ 缺 ${k}`);
if (missing.length > 20) console.log(`  …另有 ${missing.length - 20} 條`);
for (const m of sizeMismatch.slice(0, 20)) console.log(`  ✗ 大小不符 ${m.key}（本機 ${m.local} / R2 ${m.remote}）`);
if (sizeMismatch.length > 20) console.log(`  …另有 ${sizeMismatch.length - 20} 條`);
for (const k of distMissing.slice(0, 20)) console.log(`  ✗ 站上會破 ${k}`);
if (distMissing.length > 20) console.log(`  …另有 ${distMissing.length - 20} 條`);

if (JSON_OUT) {
  await writeFile(JSON_OUT, JSON.stringify({ bucket: BUCKET, local: local.size, remote: remote.size, missing, sizeMismatch, extra, distRefs: distRefs?.size ?? null, distMissing }, null, 2));
  console.log(`\n明細寫入 ${JSON_OUT}`);
}

if (missing.length || sizeMismatch.length || distMissing.length) {
  console.error('\n✗ 對帳不平——缺的檔跑 `node scripts/r2-upload.mjs` 續傳（大小不符的要先從 .source/r2-uploaded.txt 移除該行才會重傳）');
  process.exit(1);
}
console.log(distRefs
  ? '\n✓ 本機鏡像全數在 R2 且大小一致，且 dist/ 參照到的圖片 R2 都有'
  : '\n✓ 本機鏡像的圖片全數在 R2，且大小一致');
