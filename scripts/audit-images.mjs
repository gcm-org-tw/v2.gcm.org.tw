#!/usr/bin/env node
/* 圖片完整對帳：舊站每一頁引用到的每一張圖，鏡像與 R2 是不是都有。
 *
 * 為什麼要這支：先前的 r2-verify 對的是兩本窄帳——「本機鏡像 ↔ R2」與「dist 參照 ↔ R2」。
 * 兩本都平，但都沒問「舊站到底有哪些圖」。鏡像當初是照 wp-media 的清單建的，
 * 而那份清單只涵蓋當時抓得到的內容；作者簡介、活動內文、商品圖組、心得附圖這些
 * 後來才救回來的內容，它們的圖從一開始就不在清單裡。帳是真的，範圍是窄的。
 *
 * 這支拿 compare-old-new.mjs 存下來的**完整**舊站圖片清單（oldImgList）當基準，
 * 逐張比對鏡像，列出缺的。缺的清單餵給 fetch 腳本補抓、再 r2-upload 上傳。
 *
 * 舊站自己已經失效的圖（實測 301 導回首頁、檔案不存在）記在 .source/dead-images.txt，
 * 分開列、不算缺漏——那不是我們搬丟的，補不回來也不該讓守門永遠是紅的。
 *
 * 用法：node scripts/audit-images.mjs [--out missing.txt]
 */
import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : '.source/missing-images.txt';

const data = JSON.parse(await readFile('.source/compare.json', 'utf8'));
const pages = Object.entries(data);
const withList = pages.filter(([, v]) => Array.isArray(v.oldImgList));

const all = new Set();
for (const [, v] of withList) for (const f of v.oldImgList) all.add(f);

const exists = async p => { try { await access(p); return true; } catch { return false; } };
const dead = new Set(
  (await readFile('.source/dead-images.txt', 'utf8').catch(() => ''))
    .split('\n').map(l => l.trim()).filter(Boolean)
);
const missing = [];
const deadHit = [];
for (const f of [...all].sort()) {
  const rel = `/wp-content/uploads/${f}`;
  if (await exists(join('.source/uploads', rel))) continue;
  if (dead.has(rel)) deadHit.push(rel); else missing.push(rel);
}

console.log('===== 舊站圖片完整對帳 =====');
console.log(`compare.json 共 ${pages.length} 頁，其中 ${withList.length} 頁存有完整圖片清單`);
if (withList.length < pages.length) {
  console.log(`⚠ 有 ${pages.length - withList.length} 頁是舊格式（只存了截斷清單）→ 那幾頁要重跑 compare-old-new.mjs 才算數`);
}
console.log(`舊站引用到的不重複圖片：${all.size} 張`);
console.log(`鏡像沒有的：${missing.length} 張`);
console.log(`舊站本身已失效、不算缺漏：${deadHit.length} 張（.source/dead-images.txt）`);
await writeFile(OUT, missing.join('\n') + (missing.length ? '\n' : ''));
console.log(`缺漏清單 → ${OUT}`);
if (missing.length) process.exitCode = 1;
