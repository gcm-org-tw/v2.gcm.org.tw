#!/usr/bin/env node
/* 把舊站醫友健賞團商品頁的內容抓回來（商品說明＋健賞成績）。
 *
 * 跟 wp-reviews.mjs 同一個病因：wom 這個 CPT 走 WP REST 只吐得出標題與日期，
 * 商品說明、健賞分數、參與人數、期間、規格全在 JetEngine 自訂欄位裡沒進 REST，
 * 所以只能從前台頁面把渲染結果讀回來。
 *
 * 解析策略刻意**不吃 Elementor 的 class**（那串 hash 隨編輯器改版就變），
 * 改用頁面上穩定的中文標籤當錨點：健賞分數／參與醫友／健賞期間／健賞週期／
 * 公佈月份／健賞規格／健賞條件。抓不到就留空並在最後統計，不猜。
 *
 * ⚠ 舊站很脆 → 序列、每次間隔 DELAY。104 頁約 2-3 分鐘。
 *
 * 用法：node scripts/wp-wom.mjs [--delay 1200] [--limit N] [--only slug,slug]
 *       已抓過的會保留，--only 可以只補特定商品（舊站脆，能少打就少打）。
 */
import { readFile, writeFile, access } from 'node:fs/promises';

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const DELAY = Number(argVal('--delay', 1200));
const LIMIT = args.includes('--limit') ? Number(argVal('--limit')) : Infinity;
const ONLY = argVal('--only', null)?.split(',').filter(Boolean) ?? null;
const OUT = '.source/wom-detail.json';
const UA = 'gcm-migration/1.0 (site rebuild; contact lightman.chang@gmail.com)';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => s
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'");

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

/* 心得區塊之前的頁面內容 → 逐行純文字。心得本身由 wp-reviews.mjs 負責，這裡切掉不重複抓。 */
function pageLines(html) {
  let s = html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/g, ' ');
  const cut = s.indexOf('健賞真心話');
  if (cut > 0) s = s.slice(0, cut);
  return decode(s.replace(/<[^>]+>/g, '\n')).split('\n').map(l => l.trim()).filter(Boolean);
}

/** 「標籤 : 值」與「標籤」後接值兩種寫法都吃。
 * 同一個欄位在頁面上常出現兩次（上方摘要一次、健賞紀錄表再一次），而摘要那份會被
 * Elementor 拆成好幾個 span——例如健賞期間的起訖被拆成兩塊，只取第一份會得到
 * 「2023/07/01 ~」這種半截值。所以全部候選都收，取最長的那個。 */
function labeled(lines, label) {
  const found = [];
  for (const [i, l] of lines.entries()) {
    const inline = l.match(new RegExp(`${label}\\s*[:：]\\s*(.+)$`));
    if (inline) found.push(inline[1].trim());
    else if (l === label && lines[i + 1]) found.push(lines[i + 1].trim());
  }
  return found.sort((a, b) => b.length - a.length)[0] ?? '';
}

const all = JSON.parse(await readFile('.source/wom.json', 'utf8'));
const products = (ONLY ? all.filter(p => ONLY.includes(p.slug)) : all).slice(0, LIMIT);
const out = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => ({}));
let missing = 0;

for (const [i, p] of products.entries()) {
  let html;
  try { html = await get(p.link); }
  catch (err) { console.error(`  ✗ ${p.slug}：${err.message}`); continue; }

  const lines = pageLines(html);
  // 「造訪品牌官網」在頁面上出現兩次，其中一個是回到自己這頁的錨點 → 取站外那個才是品牌官網
  const brandLinks = [...html.matchAll(/href="([^"]+)"[^>]*>\s*(?:<[^>]+>\s*)*造訪品牌官網/g)].map(m => decode(m[1]));
  const brandUrl = brandLinks.find(u => !/(^|\/\/)([^/]*\.)?gcm\.org\.tw/.test(u)) || '';
  const brand = (lines.find(l => /^【.+】$/.test(l)) || '').replace(/^【|】$/g, '');

  // 商品說明：標題之後、「閱讀更多」之前那一段；沒有「閱讀更多」就抓到健賞分數為止
  // 起點用商品標題（每頁一定有），狀態字樣只當備援——舊站的狀態有「健賞成績已公告」
  // 「心得募集中」等多種寫法，只認其中一種會漏掉整段說明（2026-08-19 漏了 7 個商品）。
  const titleText = (p.title?.rendered ?? '').trim();
  let startAt = lines.findIndex(l => l === titleText);
  if (startAt < 0) startAt = lines.findIndex(l => /健賞成績|健賞進行中|健賞募集|心得募集/.test(l));
  const statusAt = lines.findIndex((l, n) => n > startAt && /^(健賞成績已公告|心得募集中|健賞進行中|健賞募集中)$/.test(l));
  if (statusAt > startAt) startAt = statusAt;
  const endAt = lines.findIndex((l, n) => n > startAt && (l === '閱讀更多' || l === '健賞分數'));
  const description = startAt >= 0 && endAt > startAt
    ? lines.slice(startAt + 1, endAt).filter(l => l !== '造訪品牌官網').join('\n')
    : '';

  const detail = {
    id: p.id,
    title: p.title?.rendered ?? '',
    brand,
    brandUrl,
    status: lines.find(l => /^(健賞成績已公告|心得募集中|健賞進行中|健賞募集中)$/.test(l)) || '',
    description,
    score: Number((lines.join(' ').match(/健賞分數\s*([\d.]+)/) || [])[1]) || null,
    participants: Number(labeled(lines, '健賞醫友').replace(/[^\d]/g, '')) || null,
    period: labeled(lines, '健賞期間'),
    cycle: labeled(lines, '健賞週期'),
    announceMonth: labeled(lines, '公佈月份'),
    spec: labeled(lines, '健賞規格'),
    condition: labeled(lines, '健賞條件'),
  };
  if (!detail.description) missing += 1;
  out[p.slug] = detail;
  await writeFile(OUT, JSON.stringify(out, null, 2));
  console.log(`  [${i + 1}/${products.length}] ${p.slug} → 說明 ${detail.description.length} 字、分數 ${detail.score ?? '—'}、醫友 ${detail.participants ?? '—'}`);
}

console.log(`\n完成：${Object.keys(out).length} 個商品 → ${OUT}（沒抓到說明的 ${missing} 個）`);
