#!/usr/bin/env node
/* 抓回文章作者（醫友）與他們的簡介。
 *
 * 為什麼缺：舊站每篇文章都掛著作者，正文之後有一塊作者簡介（照片、職稱、主治項目、經歷）。
 * 我們當初匯出 blog 時沒帶 author 欄位，而簡介又在 JetEngine 的使用者欄位裡，
 * 於是 1,376 篇文章全部沒有作者、855 篇連個名字都沒有（另外 521 篇只是剛好有
 * blog_fr_doctors 這個分類法可以頂著）。2026-08-19 新舊站逐頁對照才發現。
 *
 * 兩個來源：
 *   ① /wp-json/wp/v2/blog?_fields=id,link,author —— blog 是 CPT，不是內建 posts，
 *      端點名稱是 /blog（打 /posts 回空陣列）。一頁 100 筆，14 次請求。
 *   ② /author/<id>/ —— 作者專頁，簡介就在上面。users 端點回 401（未登入不給列使用者），
 *      所以只能從前台頁面解析。這些網址不在網址契約裡（sitemap 與 REST 都沒有）。
 *
 * ⚠ 舊站脆：序列、每次間隔 DELAY。
 * 用法：node scripts/wp-authors.mjs [--delay 1200] [--limit N]
 */
import { readFile, writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const DELAY = Number(argVal('--delay', 1200));
const LIMIT = args.includes('--limit') ? Number(argVal('--limit')) : Infinity;
const OUT = '.source/authors.json';
const SITE = 'https://gcm.org.tw';
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

const store = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => ({ posts: {}, authors: {} }));

// ── ① 每篇文章的作者 ──
if (!Object.keys(store.posts).length) {
  for (let page = 1; ; page += 1) {
    const body = await get(`${SITE}/wp-json/wp/v2/blog?per_page=100&page=${page}&_fields=id,link,author`);
    const items = JSON.parse(body);
    if (!Array.isArray(items) || !items.length) break;
    for (const it of items) store.posts[new URL(it.link).pathname] = it.author ?? null;
    console.log(`  文章作者 ${Object.keys(store.posts).length} 筆（p${page}）`);
    if (items.length < 100) break;
  }
  await writeFile(OUT, JSON.stringify(store, null, 2));
}

const ids = [...new Set(Object.values(store.posts).filter(Boolean))];
console.log(`文章 ${Object.keys(store.posts).length} 篇，不重複作者 ${ids.length} 位`);

/* 作者專頁的簡介區塊：「分享醫友 ｜ <姓名> <職稱> ●專長項目：… 經歷 ●現任：…」
 * 錨定在中文標籤，不吃 Elementor 的 class hash。
 * ⚠ 欄位名稱不統一：醫師寫「主治項目」、治療師寫「專長項目」，兩種都要認。
 * 頁面上還混著「己是會員 ? 登入 也想開啟個人專頁？ 註冊」這類介面文字，先濾掉再解析。 */
const BOILERPLATE = new Set(['分享醫友', '｜', '登入', '註冊', '己是會員 ?', '也想開啟個人專頁？', '或']);

function parseAuthor(html) {
  const s = html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/g, ' ');
  /* 先整頁去標籤、解實體再找錨點——頁面上寫的是 `GCM&nbsp;文章`，
   * 直接在原始 HTML 上 indexOf('GCM 文章') 永遠找不到（2026-08-19 卡在這裡）。 */
  const allLines = decode(s.replace(/<[^>]+>/g, '\n')).split('\n').map(l => l.trim()).filter(Boolean);
  const from = allLines.findIndex(l => l.includes('分享醫友'));
  // 結束錨點是「GCM 文章( 7 ) 健賞心得( 23 )」那一列，但版面會把它切成好幾段
  // （常常只剩一行 "GCM"），所以三種寫法都認
  const to = allLines.findIndex((l, i) =>
    i > from && (l === 'GCM' || /健賞心得/.test(l) || /文章\s*\(/.test(l)));
  if (from < 0 || to < 0) return null;
  /* 照片要在「分享醫友」那一段裡面找。整頁第一張 uploads 圖片是頁首的協會 logo，
   * 抓錯的話 172 位作者會全部共用同一張圖（2026-08-19 踩過）。 */
  const anchor = s.indexOf('分享醫友');
  const photo = anchor >= 0
    ? (s.slice(anchor, anchor + 6000).match(/<img[^>]+src="([^"]*\/wp-content\/uploads\/[^"]+)"/) || [])[1]
    : undefined;
  const lines = allLines.slice(from, to)
    .map(l => l.replace(/^分享醫友\s*/, '').replace(/^｜\s*/, '').replace(/\s*｜$/, '').trim())
    .filter(l => l && !BOILERPLATE.has(l));

  const name = lines[0] ?? '';
  const role = /醫師|營養師|藥師|治療師|技師|護理|教練|顧問|營養|醫檢/.test(lines[1] ?? '') ? lines[1] : '';
  const careerAt = lines.findIndex(l => l === '經歷');
  const head = careerAt >= 0 ? lines.slice(0, careerAt) : lines;
  const specialty = head.filter(l => /專長項目|主治項目|證照|●/.test(l)).join('\n');
  const career = careerAt >= 0 ? lines.slice(careerAt + 1).join('\n') : '';
  if (!name) return null;
  return { name, role, specialty, career, photo: photo ? decode(photo).replace(SITE, '') : '' };
}

// ── ② 作者簡介 ──
let ok = 0, miss = 0;
for (const id of ids.filter(i => !store.authors[String(i)]).slice(0, LIMIT)) {
  let html;
  try { html = await get(`${SITE}/author/${id}/`); }
  catch (err) { console.error(`  ✗ author/${id}：${err.message}`); continue; }
  const a = parseAuthor(html);
  if (a) { ok += 1; store.authors[String(id)] = a; console.log(`  ${id} ${a.name}｜${a.role || '（無職稱）'}　主治 ${a.specialty.length} 字　經歷 ${a.career.length} 字`); }
  else { miss += 1; store.authors[String(id)] = null; console.log(`  – ${id} 解析不到簡介`); }
  await writeFile(OUT, JSON.stringify(store, null, 2));
}

console.log(`\n完成：作者簡介 ${ok} 位、解析不到 ${miss} 位 → ${OUT}`);
