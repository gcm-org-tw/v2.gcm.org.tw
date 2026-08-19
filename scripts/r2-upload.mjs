#!/usr/bin/env node
/* 把鏡像下來的舊站圖片上傳到 Cloudflare R2。
 *
 * 為什麼不用 wrangler：`wrangler r2 object put` 一次只能一個檔，11,725 個檔要跑 11,725 次
 * node 啟動。這支直接打 wrangler 底層用的同一個 REST 端點，並行 8 條。
 *
 * 憑證：讀 wrangler 的 OAuth token（~/.config/.wrangler/config/default.toml）。
 * ⚠ 那個 token 大約 1 小時到期，而這批要跑更久 → 剩不到 5 分鐘就呼叫一次 wrangler
 *   （它會自動 refresh）再重讀檔案。token 全程不印出。
 *
 * 物件 key＝網址路徑去掉開頭斜線（wp-content/uploads/...），這樣 Cloudflare 那邊
 * 只要 `url.pathname.slice(1)` 就對得上，不必再做前綴轉換。
 *
 * 進度落地在 .source/r2-uploaded.txt，中斷重跑會跳過已上傳的檔。
 *
 * 用法：node scripts/r2-upload.mjs [--bucket gcm-org-tw-uploads] [--dir .source/uploads]
 *                                  [--concurrency 8] [--limit N] [--dry-run]
 */
import { readFile, readdir, stat, appendFile, access } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { R2_BUCKET, CF_ACCOUNT_ID } from '../site.config.mjs';

const run = promisify(execFile);
const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BUCKET = argVal('--bucket', R2_BUCKET);
const DIR = argVal('--dir', '.source/uploads');
const CONCURRENCY = Number(argVal('--concurrency', 8));
const LIMIT = args.includes('--limit') ? Number(argVal('--limit')) : Infinity;
const DRY = args.includes('--dry-run');
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || CF_ACCOUNT_ID;
const DONE_FILE = '.source/r2-uploaded.txt';
const WRANGLER_CONFIG = '/root/.config/.wrangler/config/default.toml';

if (!ACCOUNT) { console.error('✗ 找不到帳號 ID：設環境變數 CLOUDFLARE_ACCOUNT_ID 或 site.config.mjs 的 CF_ACCOUNT_ID'); process.exit(1); }

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.pdf': 'application/pdf',
};

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

// 8 條並行都可能同時發現 token 快到期 → 用一個共用 promise 擋住，只更新一次
let refreshing = null;
async function ensureToken(now) {
  if (token && tokenExpiry - now > 5 * 60 * 1000) return;
  if (refreshing) return refreshing;
  refreshing = doRefresh().finally(() => { refreshing = null; });
  return refreshing;
}

async function doRefresh() {
  if (token) {
    // 呼叫任一 wrangler 指令會觸發它自己 refresh，再重讀設定檔
    process.stdout.write('\n  ↻ token 快到期，觸發 wrangler 更新…\n');
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

async function exists(p) { try { await access(p); return true; } catch { return false; } }

const done = new Set();
if (await exists(DONE_FILE)) {
  for (const l of (await readFile(DONE_FILE, 'utf8')).split('\n')) if (l.trim()) done.add(l.trim());
}

const files = [];
for await (const f of walk(DIR)) files.push(f);
files.sort();
const todo = files.filter(f => !done.has(relative(DIR, f))).slice(0, LIMIT);

console.log(`本機檔案 ${files.length} 個，已上傳 ${done.size} 個，待上傳 ${todo.length} 個 → bucket ${BUCKET}`);
if (DRY) { console.log('（--dry-run，不實際上傳）'); process.exit(0); }

await loadToken();

let ok = 0, fail = 0, bytes = 0;
const failures = [];

async function upload(file) {
  const key = relative(DIR, file);
  const body = await readFile(file);
  const ct = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects/${key.split('/').map(encodeURIComponent).join('/')}`;

  for (let i = 1; i <= 4; i++) {
    await ensureToken(Date.now());
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'content-type': ct },
        body,
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      ok += 1; bytes += body.length;
      await appendFile(DONE_FILE, key + '\n');
      return;
    } catch (err) {
      if (i === 4) { fail += 1; failures.push(`${key}\t${err.message}`); return; }
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}

const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    await upload(queue.shift());
    const n = ok + fail;
    if (n % 50 === 0) {
      process.stdout.write(`\r  ${n}/${todo.length}　成功 ${ok}　失敗 ${fail}　${(bytes / 1024 / 1024).toFixed(0)}MB   `);
    }
  }
}));

console.log(`\n完成：成功 ${ok}、失敗 ${fail}、合計 ${(bytes / 1024 / 1024).toFixed(0)}MB`);
if (failures.length) {
  console.error('\n失敗清單（前 20）：');
  for (const f of failures.slice(0, 20)) console.error('  ' + f);
  process.exit(1);
}
