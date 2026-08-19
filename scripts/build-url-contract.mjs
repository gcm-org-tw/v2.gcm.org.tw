#!/usr/bin/env node
/* 產生「網址保留契約」legacy-urls.txt。
 *
 * 來源優先序：
 *   1. 舊站 sitemap_index.xml 底下每一份 sitemap 的 <loc>（＝搜尋引擎實際收錄的集合，權威）
 *   2. .source/urls-from-api.txt（WP REST 匯出的 link，補 sitemap 漏收的 noindex 頁）
 *   3. extra-urls.txt（人工補充：/blog/ 之類 sitemap 不收但實際存在的入口頁）
 *
 * 產出的 legacy-urls.txt 要 commit 進 repo：舊站關掉後，這份就是唯一真實來源。
 * 用法：node scripts/build-url-contract.mjs [--offline]（--offline 只用本地來源，不打舊站）
 */
import { writeFile, readFile, access } from 'node:fs/promises';

const BASE = 'https://gcm.org.tw';
const OFFLINE = process.argv.includes('--offline');
const OUT = 'legacy-urls.txt';

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function get(url, tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === tries) throw new Error(`${url}：${err.message}`);
      await new Promise(r => setTimeout(r, 2000 * i));
    }
  }
}

const locs = t => [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());

const urls = new Set();
const sources = {};

if (!OFFLINE) {
  console.log('讀取舊站 sitemap_index.xml …');
  const index = await get(`${BASE}/sitemap_index.xml`);
  const sitemaps = locs(index);
  console.log(`  子 sitemap：${sitemaps.length} 份`);
  for (const sm of sitemaps) {
    const body = await get(sm);
    const found = locs(body);
    sources[sm.replace(BASE, '')] = found.length;
    for (const u of found) urls.add(u);
    console.log(`  ${sm.replace(BASE, '')}：${found.length} 條`);
    await new Promise(r => setTimeout(r, 500));
  }
}

if (await exists('.source/urls-from-api.txt')) {
  const api = (await readFile('.source/urls-from-api.txt', 'utf8')).split('\n').map(s => s.trim()).filter(Boolean);
  const before = urls.size;
  for (const u of api) urls.add(u);
  console.log(`API 清冊補入：${urls.size - before} 條（共 ${api.length} 條）`);
}

// taxonomy 彙整頁：舊站實測 200 且無 noindex，但 Rank Math 沒收進 sitemap。
// 網址要留（外部連結可能指過來），索引與否是另一回事——路由層掛 noindex。
const TAXONOMIES = ['blog-cate', 'blog-tag', 'blog-tag-keyword', 'blog-tag-theme', 'blog-fr-doctors'];
for (const tax of TAXONOMIES) {
  const f = `.source/tax/${tax}.json`;
  if (!await exists(f)) continue;
  const terms = JSON.parse(await readFile(f, 'utf8'));
  let n = 0;
  for (const t of terms) {
    // 帶 query string 的（如 /?taxonomy=…&term=…）不是永久網址，不列入契約
    if (!t.link || t.link.includes('?')) continue;
    if (!urls.has(t.link)) n += 1;
    urls.add(t.link);
  }
  console.log(`taxonomy ${tax} 補入：${n} 條`);
}

if (await exists('extra-urls.txt')) {
  const extra = (await readFile('extra-urls.txt', 'utf8'))
    .split('\n').map(s => s.trim()).filter(l => l && !l.startsWith('#'));
  const before = urls.size;
  for (const u of extra) urls.add(u.startsWith('http') ? u : `${BASE}${u}`);
  console.log(`人工補充補入：${urls.size - before} 條`);
}

const sorted = [...urls].sort();
const header = [
  '# 網址保留契約 —— 舊站（WordPress）所有對外網址，改版後一條都不能斷。',
  '# 由 scripts/build-url-contract.mjs 產生；守門：scripts/check-urls.mjs（CI build 後跑）。',
  '# 要下架任何一條都必須用戶明示同意，改列 legacy-urls-retired.txt 或 redirects.json。',
  `# 總計 ${sorted.length} 條`,
  '',
].join('\n');
await writeFile(OUT, header + sorted.join('\n') + '\n');
console.log(`\n→ ${OUT}：${sorted.length} 條`);
