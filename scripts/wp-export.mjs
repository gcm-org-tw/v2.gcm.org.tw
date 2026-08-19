#!/usr/bin/env node
/* 從現行 WordPress（gcm.org.tw）全量擷取內容到 .source/（.gitignore）。
 * 逐字轉錄用途：抓下來的是客戶原文，轉檔時掛 sourceVerbatim: true，不改寫。
 *
 * 舊站是 LiteSpeed 共享主機，per_page=100 會回 503 → 一律小批次 + 節流 + 斷點續傳：
 * 每頁存成 .source/raw/<type>-pNNN.json，中斷後重跑會跳過已抓的頁，不重打舊站。
 *
 * 用法：node scripts/wp-export.mjs [--only blog,wom] [--force] [--per-page 20] [--delay 800]
 * 產出：.source/<type>.json、.source/tax/<taxonomy>.json、.source/media.json、.source/urls-from-api.txt
 */
import { mkdir, writeFile, readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = 'https://gcm.org.tw';
const API = `${BASE}/wp-json/wp/v2`;
const OUT = '.source';
const RAW = join(OUT, 'raw');

const TYPES = ['pages', 'blog', 'wom', 'activities', 'gcm_podcast', 'gcm-clean-label', 'review'];
const TAXONOMIES = ['blog-cate', 'blog-tag', 'blog-tag-keyword', 'blog-tag-theme', 'blog-fr-doctors', 'gcm_supplier_category'];

/* 舊站每筆回應含 _links/class_list/guid 等雜訊，同樣 20 筆用 _fields 收斂後
 * 回應從 30s 降到 8s（實測）。缺欄位就在這裡加，別拿掉 _fields。 */
const FIELDS = [
  'id', 'slug', 'link', 'date', 'date_gmt', 'modified', 'modified_gmt', 'type', 'status',
  'title', 'content', 'excerpt', 'featured_media', 'acf', 'template',
  ...TAXONOMIES,
].join(',');
const TAX_FIELDS = 'id,slug,link,name,description,parent,count,taxonomy';

const args = process.argv.slice(2);
const argVal = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const only = args.includes('--only') ? argVal('--only').split(',') : null;
const force = args.includes('--force');
const PER_PAGE = Number(argVal('--per-page', 20));
const DELAY = Number(argVal('--delay', 800));

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function fetchJson(url, tries = 8) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'gcm-v2-migration/1.0 (site owner content export)' },
        signal: AbortSignal.timeout(60000),
      });
      if (res.status === 400 || res.status === 404) return { data: null, status: res.status };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { data: await res.json(), status: res.status, total: Number(res.headers.get('x-wp-total') || 0) };
    } catch (err) {
      if (i === tries) throw new Error(`${url} 連續 ${tries} 次失敗：${err.message}`);
      const wait = Math.min(30000, 2000 * 2 ** (i - 1));
      process.stdout.write(`\n  ⚠ ${err.message}，${wait / 1000}s 後第 ${i + 1} 次重試\n`);
      await sleep(wait);
    }
  }
}

/** 逐頁抓，每頁落地成獨立檔（斷點續傳） */
async function pullAll(restBase, fields = FIELDS) {
  await mkdir(RAW, { recursive: true });
  let page = 1;
  let count = 0;
  for (;;) {
    const pageFile = join(RAW, `${restBase}-p${String(page).padStart(3, '0')}.json`);
    if (!force && await exists(pageFile)) {
      const cached = JSON.parse(await readFile(pageFile, 'utf8'));
      count += cached.length;
      process.stdout.write(`\r  ${restBase}: ${count} 筆（p${page} 快取）    `);
      if (cached.length < PER_PAGE) break;
      page += 1;
      continue;
    }
    const url = `${API}/${restBase}?per_page=${PER_PAGE}&page=${page}&orderby=id&order=asc&_fields=${fields}`;
    const { data, status } = await fetchJson(url);
    if (!data || !Array.isArray(data) || data.length === 0) {
      if (status === 400) break; // 超過最後一頁
      break;
    }
    await writeFile(pageFile, JSON.stringify(data));
    count += data.length;
    process.stdout.write(`\r  ${restBase}: ${count} 筆（p${page}）        `);
    if (data.length < PER_PAGE) break;
    page += 1;
    await sleep(DELAY);
  }
  process.stdout.write('\n');
  // 合併所有頁
  const files = (await readdir(RAW)).filter(f => f.startsWith(`${restBase}-p`)).sort();
  const all = [];
  for (const f of files) all.push(...JSON.parse(await readFile(join(RAW, f), 'utf8')));
  return all;
}

await mkdir(OUT, { recursive: true });
await mkdir(join(OUT, 'tax'), { recursive: true });

const targets = only || TYPES;
for (const t of targets) {
  console.log(`擷取 ${t} …`);
  // ⚠ taxonomy 端點沒有 title/content，卻有 name/description/count。
  //   用 --only 指定 taxonomy 時若沿用 FIELDS，name 與 count 會整批抓成空值
  //   （2026-08-19 踩過：分類頁標題全變成 slug）。依名稱自動選欄位集。
  const items = await pullAll(t, TAXONOMIES.includes(t) ? TAX_FIELDS : FIELDS);
  await writeFile(join(OUT, `${t}.json`), JSON.stringify(items));
  console.log(`  → ${OUT}/${t}.json（${items.length} 筆）`);
}

if (!only) {
  for (const tax of TAXONOMIES) {
    console.log(`擷取 taxonomy ${tax} …`);
    const items = await pullAll(tax, TAX_FIELDS);
    await writeFile(join(OUT, 'tax', `${tax}.json`), JSON.stringify(items));
    console.log(`  → ${OUT}/tax/${tax}.json（${items.length} 筆）`);
  }

  // media 有 23,716 筆（實查），全量拉沒意義——只需要內容真正引用到的那些。
  // 由 scripts/wp-media.mjs 依 featured_media id 批次 include 解析，見該檔。
  console.log('media 不在此步驟全量擷取，改跑：node scripts/wp-media.mjs');
}

// 匯總所有 link 成 URL 清冊（網址保留契約的來源之一）
const urls = new Set();
for (const t of TYPES) {
  const file = join(OUT, `${t}.json`);
  if (!await exists(file)) continue;
  for (const item of JSON.parse(await readFile(file, 'utf8'))) if (item.link) urls.add(item.link);
}
for (const tax of TAXONOMIES) {
  const file = join(OUT, 'tax', `${tax}.json`);
  if (!await exists(file)) continue;
  for (const item of JSON.parse(await readFile(file, 'utf8'))) if (item.link) urls.add(item.link);
}
await writeFile(join(OUT, 'urls-from-api.txt'), [...urls].sort().join('\n') + '\n');
console.log(`\nURL 清冊（API 來源）：${urls.size} 條 → ${OUT}/urls-from-api.txt`);
