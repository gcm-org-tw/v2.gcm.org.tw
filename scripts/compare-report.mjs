#!/usr/bin/env node
/* 讀 .source/compare.json，把「真的掉內容」跟「舊站自己的推薦區塊」分開。
 *
 * 為什麼要這一步：舊站每一個彙整頁底下都掛著全站共用的推薦模組（最新文章、熱門文章、
 * 醫友體驗商品大賞…）。那些東西在每一頁都一樣，新站沒有照抄，於是原始比對會把
 * 一千多個彙整頁全部標成「少 20 張圖、少 32 條連結」——訊號被雜訊蓋掉。
 *
 * 判準：一條連結／一張圖若出現在超過 SHARED_RATIO 比例的頁面上，就認定它屬於全站共用區塊，
 * 不列為該頁的內容損失。剩下的才是真的該修的。
 *
 * 用法：node scripts/compare-report.mjs [--shared 0.3]
 */
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const SHARED_RATIO = Number(args.includes('--shared') ? args[args.indexOf('--shared') + 1] : 0.3);

const data = JSON.parse(await readFile('.source/compare.json', 'utf8'));
const pages = Object.entries(data);
const total = pages.length;

const freq = (key) => {
  const count = new Map();
  for (const [, v] of pages) for (const item of new Set(v[key] ?? [])) count.set(item, (count.get(item) ?? 0) + 1);
  return count;
};
const linkFreq = freq('missingLinks');
const imgFreq = freq('missingImgs');
const shared = n => n / total > SHARED_RATIO;

const real = [];
for (const [path, v] of pages) {
  const imgs = (v.missingImgs ?? []).filter(f => !shared(imgFreq.get(f) ?? 0));
  const links = (v.missingLinks ?? [])
    .filter(l => !shared(linkFreq.get(l) ?? 0))
    // 舊站頁面常連回自己（分頁、麵包屑、目前分類標籤），新站不重複連自己不是缺內容
    .filter(l => l !== path && l !== path.replace(/\/$/, ''));
  const issues = [];
  if (v.status[0] !== 200) issues.push(`舊站 ${v.status[0]}`);
  if (v.status[1] !== 200) issues.push(`新站 ${v.status[1]}`);
  if (v.old > 200 && v.ratio < 0.6 && (imgs.length || links.length)) {
    issues.push(`文字少 ${Math.round((1 - v.ratio) * 100)}%（${v.old}→${v.new}）`);
  }
  if (imgs.length) issues.push(`少 ${imgs.length} 張圖：${imgs.slice(0, 3).join('、')}`);
  if (links.length) issues.push(`少 ${links.length} 條連結：${links.slice(0, 3).join('、')}`);
  if (issues.length) real.push({ path, issues, v });
}

console.log(`===== 新舊站對照報告 =====`);
console.log(`已比對 ${total} 條`);
console.log(`扣掉全站共用區塊（出現率 > ${SHARED_RATIO * 100}% 的連結／圖片）後，仍有差異：${real.length} 條\n`);

const group = p => p.replace(/^(\/[^/]+\/).*/, '$1') || '/';
const byGroup = new Map();
for (const r of real) byGroup.set(group(r.path), (byGroup.get(group(r.path)) ?? 0) + 1);
console.log('依區段：');
for (const [g, n] of [...byGroup].sort((a, b) => b[1] - a[1])) console.log(`  ${g.padEnd(24)} ${n}`);

console.log('\n前 40 條：');
for (const r of real.slice(0, 40)) console.log(`  ✗ ${r.path}\n      ${r.issues.join('\n      ')}`);
