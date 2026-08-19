#!/usr/bin/env node
/* 抓回「WP REST 匯不出內容」的那幾個 CPT 的正文。
 *
 * 舊站用 JetEngine + Elementor 組版，activities / gcm_podcast / gcm-clean-label 這三種
 * 內容的本文都在自訂欄位裡，REST 只吐得出標題與日期——轉檔後 .md 是空的。
 * （wom 與 review 已各自有專用腳本；這支處理剩下的零星 CPT。）
 *
 * 作法：抓前台頁面，切出正文區塊（頁首之後、頁尾共用區塊之前），轉成 Markdown。
 * 邊界用舊站頁尾固定出現的字串當終點，抓不到就整段跳過並報出來——不猜、不硬切。
 *
 * ⚠ 舊站脆：序列、每次間隔 DELAY。
 * 用法：node scripts/wp-jetengine-content.mjs [--delay 1500]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import TurndownService from 'turndown';

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const DELAY = Number(argVal('--delay', 1500));
const SRC_DIR = '.source';
const OUT = '.source/jetengine-content.json';
const SITE = 'https://gcm.org.tw';
const UA = 'gcm-migration/1.0 (site rebuild; contact lightman.chang@gmail.com)';

// 正文結束於這些頁尾共用區塊的第一個出現處
const END_MARKERS = ['合作夥伴', '醫友專區', '免責聲明', '歡迎加入'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
td.keep(['iframe', 'audio', 'video', 'table']);
td.remove(['script', 'style', 'noscript', 'nav', 'header', 'footer', 'form', 'button']);

/* 舊站頁面混了一堆非內容的東西，轉成 Markdown 後要清掉，否則會變成新站的壞連結或雜訊：
 *   · AddToAny 分享鈕（一串沒有文字的空連結）
 *   · 瀏覽數／留言數／文章編號（902 / 0 / #17159 這種）
 *   · /author/<id>/ 作者頁——新站沒有這個路由，留著就是死連結，改成純文字保住人名 */
function clean(md) {
  return md
    // 先把站內絕對網址收成相對路徑，下面幾條規則才對得上（順序反了就全部失效）
    .replace(new RegExp(SITE, 'g'), '')
    .replace(/\[\]\((https?:\/\/)?(www\.)?(addtoany|facebook|twitter|x|line|threads|linkedin)[^)]*\)/gi, '')
    .replace(/\[([^\]]*)\]\(\/author\/\d+\/?\)/g, '$1')
    // 舊站 WP 的查詢式網址 → 新站的實際列表頁
    .replace(/\]\(\/\?post_type=gcm-clean-label\)/g, '](/gcm-clean-label/)')
    /* /clean-label-award/<獎項>/ 是舊站的獎項分類彙整頁，不在網址契約裡（sitemap 與 REST
     * 都沒有它，實測也查不到）→ 不造一個新網址出來，只保留獎項文字 */
    .replace(/\[([^\]]*)\]\(\/clean-label-award\/[^)]*\)/g, '$1')
    .replace(/^-\s+(\d+|#\d+)\s*$/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function get(url, tries = 3) {
  for (let i = 1; i <= tries; i += 1) {
    await sleep(DELAY);
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(90000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === tries) throw err;
      await sleep(DELAY * 4 * i);
    }
  }
}

/* 要抓哪些：直接看 WP REST 匯出的原始資料，content.rendered 是空的就是 JetEngine 內容。
 * ⚠ 不要改成「看 src/content/*.md 現在是不是空的」——第一次跑完 .md 就有內容了，
 *   第二次跑會判定無事可做，一旦重建 store 就整批掉光（2026-08-19 踩過）。 */
const SOURCES = [
  { file: 'activities.json' },
  { file: 'gcm_podcast.json' },
  { file: 'gcm-clean-label.json' },
];

async function jetEngineEntries() {
  const out = [];
  for (const src of SOURCES) {
    const path = join(SRC_DIR, src.file);
    let items;
    try { items = JSON.parse(await readFile(path, 'utf8')); }
    catch { console.log(`跳過 ${src.file}（尚未匯出）`); continue; }
    for (const item of items) {
      const rendered = (item.content?.rendered ?? '').replace(/<[^>]+>/g, '').trim();
      if (rendered.length >= 40) continue;          // REST 就有內容，不必爬前台
      out.push({ legacyPath: new URL(item.link).pathname, title: item.title?.rendered ?? '' });
    }
  }
  return out;
}

const entries = await jetEngineEntries();
console.log(`REST 沒有正文、需要從前台抓的：${entries.length} 筆`);

const store = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => ({}));
let ok = 0, skipped = 0;

for (const e of entries) {
  let html;
  try { html = await get(SITE + e.legacyPath); }
  catch (err) { console.error(`  ✗ ${e.legacyPath}：${err.message}`); continue; }

  const start = html.indexOf('</header>');
  if (start < 0) { console.log(`  – ${e.legacyPath} 找不到頁首邊界，跳過`); skipped += 1; continue; }
  let end = -1;
  for (const marker of END_MARKERS) {
    const at = html.indexOf(marker, start);
    if (at > 0 && (end < 0 || at < end)) end = at;
  }
  if (end < 0) { console.log(`  – ${e.legacyPath} 找不到頁尾邊界，跳過`); skipped += 1; continue; }

  // 切回該標記所在標籤的開頭，避免把半截 HTML 丟給 turndown
  const cut = html.lastIndexOf('<', end);
  const md = clean(td.turndown(html.slice(start + '</header>'.length, cut > start ? cut : end)));

  store[e.legacyPath] = md;
  await writeFile(OUT, JSON.stringify(store, null, 2));
  ok += 1;
  console.log(`  ${e.legacyPath} → ${md.length} 字`);
}

console.log(`\n完成：抓到 ${ok} 筆、跳過 ${skipped} 筆 → ${OUT}`);
