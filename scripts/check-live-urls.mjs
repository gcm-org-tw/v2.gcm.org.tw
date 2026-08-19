#!/usr/bin/env node
/* 上線後的實測守門：舊站的每一條網址，在**線上的新站**是不是真的打得開。
 *
 * 跟 check-urls.mjs 的分工：
 *   check-urls.mjs   → build 當下比對「契約清冊 vs dist/ 產出」，是離線的、快的、擋 push 的。
 *   本腳本（這支）   → 部署完之後真的去 curl 線上網址，抓的是 dist/ 對但線上不對的情況：
 *                      Pages 的自訂網域沒生效、憑證沒簽、目錄式網址被吃掉尾斜線、
 *                      中文網址的 percent-encoding 在 CDN 那層被解錯……這些 dist/ 看不出來。
 *
 * 驗哪些網址（三份合併去重）：
 *   ① legacy-urls.txt   舊站契約，改版後一條都不能斷 ← 這是本腳本存在的理由
 *   ② redirects.json    明示轉址的舊網址（靜態輸出是 meta-refresh 頁，本身也要回 200）
 *   ③ 線上 sitemap      新站自己宣告的頁面
 *
 * Pages 的 CDN 在併發下會偶發 503（2026-08-19 實測：同一條單獨重打即 200），
 * 所以第一輪的失敗不判死，序列重試兩輪都不過才算真的壞。
 *
 * 用法：node scripts/check-live-urls.mjs [--base https://…] [--concurrency 8] [--limit N]
 *       預設 base ＝ site.config.mjs 的 SITE_URL。
 */
import { readFile } from 'node:fs/promises';
import { SITE_URL } from '../site.config.mjs';

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const BASE = (argVal('--base', SITE_URL)).replace(/\/$/, '');
const CONCURRENCY = Number(argVal('--concurrency', 8));
const LIMIT = args.includes('--limit') ? Number(argVal('--limit')) : Infinity;
const RETRY_ROUNDS = 2;

const lines = async (f) =>
  (await readFile(f, 'utf8')).split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

/** 任何形式的網址／路徑 → 掛在 BASE 底下的絕對網址 */
const toLive = (u) => (u.startsWith('http') ? BASE + new URL(u).pathname : BASE + (u.startsWith('/') ? u : `/${u}`));

const sources = new Map();   // url → 來源標籤（同一條被多份收錄時記第一個，報錯時看得出是哪一份的帳）
const add = (u, tag) => { const k = toLive(u); if (!sources.has(k)) sources.set(k, tag); };

for (const u of await lines('legacy-urls.txt')) add(u, '舊站契約');
for (const u of await lines('extra-urls.txt')) add(u, '人工補充入口');
const redirects = JSON.parse(await readFile('redirects.json', 'utf8'));
for (const from of Object.keys(redirects)) if (from.startsWith('/')) add(from, '轉址舊網址');

/* 線上 sitemap：新站自己宣告的頁面。抓不到不算錯（可能還沒部署完），但要講出來。 */
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
try {
  const idx = await fetch(`${BASE}/sitemap-index.xml`);
  const maps = idx.ok ? locs(await idx.text()) : [];
  for (const m of maps) {
    const r = await fetch(m);
    if (r.ok) for (const u of locs(await r.text())) add(u, 'sitemap');
  }
} catch {
  console.error('⚠ 抓不到線上 sitemap，本輪只驗契約與轉址');
}

const urls = [...sources.keys()].slice(0, LIMIT);
const byTag = urls.reduce((m, u) => (m[sources.get(u)] = (m[sources.get(u)] || 0) + 1, m), {});
console.log(`===== 線上網址實測（${BASE}）=====`);
console.log(`待驗 ${urls.length} 條：` + Object.entries(byTag).map(([k, v]) => `${k} ${v}`).join('　'));

async function probe(list, concurrency) {
  const queue = [...list];
  const failed = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const url = queue.shift();
      let status = 0;
      try {
        const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
        status = res.status;
      } catch (err) {
        status = err.name === 'TimeoutError' ? 408 : 0;
      }
      if (status !== 200) failed.push({ url, status });
    }
  }));
  return failed;
}

let failed = await probe(urls, CONCURRENCY);
for (let round = 1; round <= RETRY_ROUNDS && failed.length; round += 1) {
  console.log(`第 ${round} 輪重試 ${failed.length} 條（Pages 的 CDN 併發下會偶發 503）`);
  await new Promise(r => setTimeout(r, 10000));
  failed = await probe(failed.map(f => f.url), 2);
}

console.log('===== 結果 =====');
if (failed.length) {
  for (const f of failed.slice(0, 40)) console.log(`  ✗ ${f.status || '連不上'}　${decodeURIComponent(f.url)}　[${sources.get(f.url)}]`);
  if (failed.length > 40) console.log(`  …另有 ${failed.length - 40} 條`);
  console.error(`\n✗ ${failed.length} 條在線上打不開——舊站網址斷掉就是斷掉，不能上線`);
  process.exit(1);
}
console.log(`✓ ${urls.length} 條全部回 200（其中舊站契約 ${byTag['舊站契約'] || 0} 條）`);
