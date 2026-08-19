#!/usr/bin/env node
/* 只解析內容真正引用到的媒體。
 *
 * 舊站媒體庫 23,716 筆，全量拉沒意義。這支只做兩件事：
 *   1. 收集所有 featured_media id（各 CPT），批次 ?include= 解析成 source_url
 *   2. 掃內容 HTML 裡的 wp-content/uploads 圖片網址
 * 產出 .source/media-used.json（id → {source_url,alt,width,height}）與
 *      .source/image-urls.txt（實際要鏡像下載的檔案清單）
 *
 * 用法：node scripts/wp-media.mjs [--delay 800]
 */
import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const API = 'https://gcm.org.tw/wp-json/wp/v2';
const OUT = '.source';
const TYPES = ['pages', 'blog', 'wom', 'activities', 'gcm_podcast', 'gcm-clean-label'];
const args = process.argv.slice(2);
const DELAY = Number(args.includes('--delay') ? args[args.indexOf('--delay') + 1] : 800);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function fetchJson(url, tries = 8) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries) throw new Error(`${url}：${err.message}`);
      await sleep(Math.min(30000, 2000 * 2 ** (i - 1)));
    }
  }
}

const featured = new Set();
const inlineUrls = new Set();

for (const t of TYPES) {
  const file = join(OUT, `${t}.json`);
  if (!await exists(file)) { console.log(`跳過 ${t}（尚未匯出）`); continue; }
  const items = JSON.parse(await readFile(file, 'utf8'));
  for (const item of items) {
    if (item.featured_media) featured.add(item.featured_media);
    const html = item.content?.rendered || '';
    for (const m of html.matchAll(/https?:\/\/gcm\.org\.tw\/wp-content\/uploads\/[^"'\s)\\]+/g)) {
      inlineUrls.add(m[0]);
    }
  }
  console.log(`${t}：${items.length} 筆`);
}

console.log(`\nfeatured_media id：${featured.size} 個`);
console.log(`內容內嵌圖片網址：${inlineUrls.size} 條`);

// 批次解析 featured_media
const ids = [...featured];
const resolved = {};
for (let i = 0; i < ids.length; i += 100) {
  const batch = ids.slice(i, i + 100);
  const url = `${API}/media?include=${batch.join(',')}&per_page=100&_fields=id,source_url,alt_text,mime_type,media_details`;
  const data = await fetchJson(url);
  for (const m of data) {
    resolved[m.id] = {
      source_url: m.source_url,
      alt: m.alt_text || '',
      mime: m.mime_type,
      width: m.media_details?.width,
      height: m.media_details?.height,
    };
    if (m.source_url) inlineUrls.add(m.source_url);
  }
  process.stdout.write(`\r  已解析 ${Object.keys(resolved).length}/${ids.length}   `);
  await sleep(DELAY);
}
process.stdout.write('\n');

await writeFile(join(OUT, 'media-used.json'), JSON.stringify(resolved, null, 0));
await writeFile(join(OUT, 'image-urls.txt'), [...inlineUrls].sort().join('\n') + '\n');
console.log(`→ ${OUT}/media-used.json（${Object.keys(resolved).length} 筆）`);
console.log(`→ ${OUT}/image-urls.txt（${inlineUrls.size} 條，鏡像下載用）`);
