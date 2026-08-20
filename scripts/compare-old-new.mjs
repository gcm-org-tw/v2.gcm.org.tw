#!/usr/bin/env node
/* 新舊站逐頁對照。
 *
 * 為什麼要這支：先前只驗「網址回 200」就宣稱內容搬完，結果首頁沒有圖、選單少兩項、
 * 站台圖示沒了、活動內頁是空的——那些在 200 的世界裡完全看不出來。
 * 這支對每一條網址同時抓舊站與新站，比對可見文字量、圖片、站內連結與標題階層，
 * 差距超過門檻就列出來給人看。
 *
 * ⚠ 舊站是 LiteSpeed 共享主機、很脆：2026-08-19 我用 concurrency 20 掃描它，
 *   整站 TCP 443 失去回應約 20 分鐘。同一次事故也測出安全值——**concurrency 3 ＋每檔 150ms**
 *   跑完 11,725 檔 0 失敗、未再干擾。所以這裡預設併發 3、每請求間隔 DELAY，
 *   不是序列（序列是我一度過度保守，比實測安全值還慢六倍）。
 *   進度落在 .source/compare.json，中斷重跑會跳過已比對的網址。
 *
 * 順序：先跑非 blog（首頁、WP 頁面、健賞、活動、潔淨標章、Podcast、列表頁），
 * 因為那些是 Elementor/JetEngine 組版、出事機率最高；blog 內文走 REST 相對安全，排後面。
 *
 * **預設全跑，不抽驗**（用戶 2026-08-19 明示：要準備指令完整確認過，不是抽驗）。
 * --review-sample N 仍可只跑 N 條 /review/，但那是趕時間時的權宜，不是預設。
 *
 * 用法：node scripts/compare-old-new.mjs [--delay 1200] [--limit N] [--only <路徑片段>]
 *                                        [--review-sample 50]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { SITE_URL } from '../site.config.mjs';

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const DELAY = Number(argVal('--delay', 150));
const WORKERS = Number(argVal('--workers', 3));
const LIMIT = args.includes('--limit') ? Number(argVal('--limit')) : Infinity;
const ONLY = argVal('--only', null);
const REVIEW_SAMPLE = Number(argVal('--review-sample', 0));
const OLD = 'https://gcm.org.tw';
const NEW = SITE_URL.replace(/\/$/, '');
const OUT = '.source/compare.json';
const UA = 'gcm-migration/1.0 (site rebuild diff; contact lightman.chang@gmail.com)';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, tries = 3) {
  for (let i = 1; i <= tries; i += 1) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
      if (!res.ok) return { status: res.status, html: '' };
      return { status: 200, html: await res.text() };
    } catch (err) {
      if (i === tries) return { status: 0, html: '', error: err.message };
      await sleep(DELAY * 3 * i);
    }
  }
}

const decode = s => s
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'");

/* 只比「內容區」，不比頁首頁尾——兩邊的選單頁尾本來就不同，混進來會蓋掉真正的差異。
 * 舊站：</header> 之後、頁尾共用區塊之前。新站：<main> 之內。 */
const OLD_END = ['合作夥伴', '歡迎加入', '免責聲明 瀏覽及使用'];

function region(html, isNew) {
  if (!html) return '';
  const s = html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/g, ' ');
  if (isNew) {
    const m = s.match(/<main[^>]*>([\s\S]*?)<\/main>/);
    return m ? m[1] : s;
  }
  const start = s.indexOf('</header>');
  const from = start >= 0 ? start + 9 : 0;
  let end = s.length;
  for (const marker of OLD_END) {
    const at = s.indexOf(marker, from);
    if (at > 0 && at < end) end = at;
  }
  return s.slice(from, end);
}

/* CSS 檔跨頁共用，抓一次就好 */
const cssCache = new Map();
async function cssImages(url) {
  if (cssCache.has(url)) return cssCache.get(url);
  const { html } = await get(url);
  const found = [...html.matchAll(/url\(\s*['"]?([^'")]+)/g)]
    .map(m => m[1])
    .filter(u => u.includes('/wp-content/uploads/') && !u.includes('/google-fonts/'))
    .map(u => decodeURIComponent(u.split('?')[0]).split('/wp-content/uploads/')[1]);
  const set = [...new Set(found)];
  cssCache.set(url, set);
  return set;
}

/** 頁面上所有 CSS 來源的背景圖：外部 <link>、<style> 區塊、style="" 屬性 */
async function backgroundImages(html, base) {
  const out = new Set();
  const inline = [
    ...[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]),
    ...[...html.matchAll(/style="([^"]*)"/g)].map(m => m[1]),
  ].join('\n');
  for (const m of inline.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
    const u = m[1];
    if (u.includes('/wp-content/uploads/') && !u.includes('/google-fonts/')) {
      out.add(decodeURIComponent(u.split('?')[0]).split('/wp-content/uploads/')[1]);
    }
  }
  const links = [...html.matchAll(/<link[^>]+href=['"]([^'"]+\.css[^'"]*)['"]/g)]
    .map(m => m[1].replace(/&#0?38;/g, '&'));
  for (const href of links) {
    try {
      const abs = href.startsWith('http') ? href : new URL(href, base).href;
      for (const f of await cssImages(abs)) out.add(f);
    } catch { /* 壞掉的 href 略過 */ }
  }
  return [...out];
}

const stripPath = u => {
  try { return decodeURIComponent(new URL(u, OLD).pathname); } catch { return u; }
};

function metrics(regionHtml) {
  const text = decode(regionHtml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const imgs = [...regionHtml.matchAll(/<img[^>]+src="([^"]+)"/g)]
    .map(m => decode(m[1]))
    .filter(u => u.includes('/wp-content/uploads/'))
    .map(u => decodeURIComponent(u.split('?')[0]).split('/wp-content/uploads/')[1]);
  const links = [...regionHtml.matchAll(/<a[^>]+href="([^"]+)"/g)]
    .map(m => decode(m[1]))
    .filter(h => h.startsWith('/') || h.startsWith(OLD) || h.startsWith(NEW))
    .map(stripPath);
  const heads = (regionHtml.match(/<h[1-4][\s>]/g) || []).length;
  return { chars: text.length, imgs: [...new Set(imgs)], links: [...new Set(links)], heads };
}

const contract = (await readFile('legacy-urls.txt', 'utf8'))
  .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  .map(u => stripPath(u));

// 非 blog 先跑（Elementor/JetEngine 組版，出事機率最高）
const rank = p => (p.startsWith('/blog/') ? 2 : p.startsWith('/review/') ? 3 : 1);
const candidates = [...new Set(contract)].filter(p => !ONLY || p.includes(ONLY));
/* review 抽樣：固定間隔取樣（不用亂數，重跑才會取到同一批、結果可重現） */
const reviews = candidates.filter(p => p.startsWith('/review/'));
const step = REVIEW_SAMPLE > 0 ? Math.max(1, Math.floor(reviews.length / REVIEW_SAMPLE)) : 1;
const sampled = REVIEW_SAMPLE > 0
  ? new Set(reviews.filter((_, i) => i % step === 0).slice(0, REVIEW_SAMPLE))
  : new Set(reviews);
const order = candidates
  .filter(p => !p.startsWith('/review/') || sampled.has(p))
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
if (REVIEW_SAMPLE > 0) {
  console.log(`/review/ 共 ${reviews.length} 條 → 抽驗 ${sampled.size} 條（--review-sample 0 可全跑）`);
}

const done = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => ({}));
const todo = order.filter(p => !done[p]).slice(0, LIMIT);
console.log(`契約 ${order.length} 條，已比對 ${Object.keys(done).length} 條，本輪 ${todo.length} 條（併發 ${WORKERS}、間隔 ${DELAY}ms）`);

const enc = p => p.split('/').map(encodeURIComponent).join('/');
let flagged = 0;

let cursor = 0;
let processed = 0;

async function worker() {
  while (cursor < todo.length) {
  const i = cursor++;
  const path = todo[i];
  await sleep(DELAY);
  const o = await get(OLD + enc(path));
  const n = await get(NEW + enc(path));
  const om = metrics(region(o.html, false));
  const nm = metrics(region(n.html, true));
  // 背景圖併進圖片清單——不然整個 hero 不見了也驗不出來
  for (const f of await backgroundImages(o.html, OLD)) if (!om.imgs.includes(f)) om.imgs.push(f);
  for (const f of await backgroundImages(n.html, NEW)) if (!nm.imgs.includes(f)) nm.imgs.push(f);

  const missingImgs = om.imgs.filter(f => !nm.imgs.includes(f));
  const missingLinks = om.links.filter(l => !nm.links.includes(l));
  const ratio = om.chars ? nm.chars / om.chars : 1;

  const issues = [];
  if (o.status !== 200) issues.push(`舊站 ${o.status}`);
  if (n.status !== 200) issues.push(`新站 ${n.status}`);
  if (o.status === 200 && n.status === 200) {
    if (om.chars > 200 && ratio < 0.6) issues.push(`文字少 ${Math.round((1 - ratio) * 100)}%（舊 ${om.chars}→新 ${nm.chars}）`);
    if (missingImgs.length) issues.push(`少 ${missingImgs.length} 張圖`);
    if (missingLinks.length > 2) issues.push(`少 ${missingLinks.length} 條站內連結`);
  }

  /* 圖片清單**完整存下來**，不截斷：這份同時是「舊站到底有哪些圖」的清冊，
   * 鏡像與 R2 的對帳要拿它當基準。先前只存前 20 筆，等於自己把帳做窄了。 */
  done[path] = { old: om.chars, new: nm.chars, ratio: Number(ratio.toFixed(2)),
                 oldImgList: om.imgs, newImgList: nm.imgs,
                 oldImgs: om.imgs.length, newImgs: nm.imgs.length,
                 missingImgs, missingLinks: missingLinks.slice(0, 40),
                 status: [o.status, n.status], issues };
  if (issues.length) { flagged += 1; console.log(`  ✗ ${path}　${issues.join('、')}`); }
  processed += 1;
  if (processed % 50 === 0) {
    await writeFile(OUT, JSON.stringify(done, null, 2));
    console.log(`  … ${processed}/${todo.length}　目前有問題 ${flagged} 條`);
  }
  }
}

await Promise.all(Array.from({ length: WORKERS }, () => worker()));

await writeFile(OUT, JSON.stringify(done, null, 2));
const all = Object.entries(done);
const bad = all.filter(([, v]) => v.issues.length);
console.log(`\n===== 對照結果 =====`);
console.log(`已比對 ${all.length} 條，其中 ${bad.length} 條有差異`);
console.log(`明細：${OUT}`);
if (bad.length) process.exitCode = 1;
