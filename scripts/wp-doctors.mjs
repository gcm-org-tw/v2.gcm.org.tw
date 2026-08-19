#!/usr/bin/env node
/* 抓回合作醫師的簡介（照片、職稱、主治項目、經歷）。
 *
 * 為什麼缺：舊站每篇文章的正文之後都有一塊作者醫師簡介，資料在 JetEngine 的
 * term meta 裡（分類法 blog-fr-doctors）。WP REST 的 term description 是空字串，
 * 所以轉檔時整批沒帶到——119 位醫師、1,377 篇文章底下全都少了這一塊。
 * （2026-08-19 新舊站逐頁對照才發現，只驗網址 200 是看不出來的。）
 *
 * 抓法：每位醫師挑他自己的文章，從文章頁把那塊解析出來。簡介對同一位醫師是同一份，
 * 所以抓到一次就夠，不必掃 1,377 篇。
 * ⚠ 舊站**不是每篇文章都有**那塊簡介（舊版型的文章只在開頭寫「作者：藥師 羅文佑」），
 *   所以每位醫師最多試 TRIES 篇；都沒有的話至少把職稱記下來。
 *
 * 版面位置：正文結束（「責任編輯」）之後、「延伸閱讀」之前。
 * 解析錨定在中文標籤（主治項目／經歷）與「●」符號，不吃 Elementor 的 class hash。
 *
 * ⚠ 舊站脆：序列、每次間隔 DELAY。
 * 用法：node scripts/wp-doctors.mjs [--delay 1500] [--limit N]
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const DELAY = Number(argVal('--delay', 1500));
const LIMIT = args.includes('--limit') ? Number(argVal('--limit')) : Infinity;
const OUT = '.source/doctors.json';
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

const TRIES = 3;

/** 每位醫師的文章清單（檔名排序，重跑取到同一批） */
async function doctorToPosts() {
  const dir = 'src/content/blog';
  const map = new Map();
  for (const name of (await readdir(dir)).sort()) {
    const text = await readFile(join(dir, name), 'utf8');
    const line = text.match(/^blog_fr_doctors:\s*\[([^\]]*)\]/m);
    if (!line) continue;
    const path = (text.match(/^legacyPath:\s*"([^"]+)"/m) || [])[1];
    for (const raw of line[1].split(',')) {
      const slug = raw.trim().replace(/^"|"$/g, '');
      if (!slug) continue;
      if (!map.has(slug)) map.set(slug, []);
      if (map.get(slug).length < TRIES) map.get(slug).push(path);
    }
  }
  return map;
}

/* 一塊簡介長這樣（純文字化之後）：
 *   李冠毅　復健科醫師　●主治項目：【…】【…】　經歷　●現任：【…】●經歷：【…】
 * 「經歷」是個小標，實際內容在它後面那一段。 */
function parseBio(html, name) {
  const s = html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/g, ' ');
  const from = s.indexOf('責任編輯');
  const to = s.indexOf('延伸閱讀', from > 0 ? from : 0);
  if (from < 0 || to < 0) return null;
  const seg = s.slice(from, to);

  const photo = (seg.match(/<img[^>]+src="([^"]*\/wp-content\/uploads\/[^"]+)"/) || [])[1];
  const lines = decode(seg.replace(/<[^>]+>/g, '\n')).split('\n').map(l => l.trim()).filter(Boolean);

  const nameAt = lines.findIndex(l => l === name);
  const role = nameAt >= 0 ? (lines[nameAt + 1] ?? '') : '';
  const specialty = lines.find(l => l.includes('主治項目')) ?? '';
  const careerAt = lines.findIndex(l => l === '經歷');
  const career = careerAt >= 0 ? (lines.slice(careerAt + 1).find(l => l.includes('●')) ?? '') : '';

  if (!photo && !role && !specialty && !career) return null;
  return {
    photo: photo ? decode(photo).replace(SITE, '') : '',
    role: /醫師|營養師|藥師|治療師|技師|護理|教練/.test(role) ? role : '',
    specialty,
    career,
  };
}

const map = await doctorToPosts();
console.log(`合作醫師 ${map.size} 位（每位最多試 ${TRIES} 篇文章）`);

const store = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => ({}));
let ok = 0, empty = 0;
const todo = [...map].filter(([slug]) => !store[slug]).slice(0, LIMIT);

for (const [slug, paths] of todo) {
  let bio = null;
  let role = '';
  for (const path of paths) {
    let html;
    try { html = await get(SITE + path); }
    catch (err) { console.error(`  ✗ ${slug} ${path}：${err.message}`); continue; }
    // 舊版型只在開頭寫「作者： 藥師 羅文佑」→ 至少把職稱撿回來
    if (!role) {
      const m = html.replace(/<[^>]+>/g, ' ').match(new RegExp(`作者[：:]\\s*([^\\s]{2,6})\\s*${slug}`));
      if (m) role = decode(m[1]);
    }
    bio = parseBio(html, slug);
    if (bio) break;
  }
  if (bio) { ok += 1; store[slug] = { ...bio, role: bio.role || role }; console.log(`  ${slug}：${store[slug].role || '（無職稱）'}　主治 ${bio.specialty.length} 字　經歷 ${bio.career.length} 字`); }
  else if (role) { ok += 1; store[slug] = { photo: '', role, specialty: '', career: '' }; console.log(`  ${slug}：只有職稱「${role}」`); }
  else { empty += 1; store[slug] = null; console.log(`  – ${slug} 三篇都沒有簡介`); }
  await writeFile(OUT, JSON.stringify(store, null, 2));
}

console.log(`\n完成：有簡介 ${ok} 位、沒有 ${empty} 位 → ${OUT}`);
