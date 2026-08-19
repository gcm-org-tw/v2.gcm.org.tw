#!/usr/bin/env node
/* 產生 review CPT 的轉址表 redirects-review.json。
 *
 * 背景：舊站 /review/<slug>/ 共 4,144 條，單頁樣板不渲染任何內文——心得本文是在
 * 商品頁 /wom/<slug>/ 由 JetEngine 依 `item_source_post_id` 撈出來顯示的。
 * 新站把心得直接放進商品頁（見 src/pages/wom/[...slug].astro），所以這些網址轉到
 * 「那則心得所在的位置」才是對讀者有意義的落點：
 *   有心得的 → /wom/<商品>/#review-<id>（錨點直接跳到本人那一則）
 *   沒心得的 → /wom/（舊站也查不到內容的空記錄，只能給列表）
 *
 * 為什麼不直接寫進 redirects.json：那份是人工維護、每條都要用戶點頭的清單，
 * 混進四千條機器產生的會看不出誰是誰。兩份都由 astro.config.mjs 與 check-urls.mjs 合併讀。
 *
 * 用法：node scripts/build-review-redirects.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';

const OUT = 'redirects-review.json';
const reviews = JSON.parse(await readFile('.source/review.json', 'utf8'));          // 4,144 條網址
const byProduct = JSON.parse(await readFile('.source/reviews.json', 'utf8'));       // 抓回來的心得
const products = JSON.parse(await readFile('.source/wom.json', 'utf8'));

/* 網址一律解碼成 UTF-8 原字：dist/ 的目錄名是原字（/wom/…蓋婭/），
 * 若這裡留著 percent-encoded 字串，Astro 產轉址頁時會再編碼一次，
 * 變成 %25e8%2593… 這種二次編碼的死連結（2026-08-19 實測被 check-links 抓到）。 */
const decodePath = u => { try { return decodeURIComponent(new URL(u).pathname); } catch { return new URL(u).pathname; } };
const womPath = new Map(products.map(p => [p.slug, decodePath(p.link)]));
const target = new Map();   // review 文章 id → 目的地
for (const [slug, entry] of Object.entries(byProduct)) {
  const path = womPath.get(slug);
  if (!path) continue;
  for (const r of entry.reviews) if (r.postId) target.set(r.postId, `${path}#review-${r.postId}`);
}

const out = {};
let withReview = 0;
for (const r of reviews) {
  const from = decodePath(r.link);
  const to = target.get(r.id);
  if (to) withReview += 1;
  out[from] = to ?? '/wom/';
}

const sorted = Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]));
await writeFile(OUT, JSON.stringify({
  _comment: [
    '由 scripts/build-review-redirects.mjs 產生，不要手改。',
    `review 舊網址 ${reviews.length} 條：${withReview} 條轉到自己那則心得的錨點，`,
    `其餘 ${reviews.length - withReview} 條在舊站也沒有任何內容（不出現在任何商品的心得清單），轉到 /wom/。`,
  ],
  ...sorted,
}, null, 2) + '\n');
console.log(`→ ${OUT}：${reviews.length} 條（有心得 ${withReview}、無心得 ${reviews.length - withReview}）`);
