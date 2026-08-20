#!/usr/bin/env node
/* 抓舊站的健賞狀態列表頁 /recruit/{open,close,open_wom,close_wom}/。
 *
 * 這四條網址舊站實測 200，但 sitemap 與 REST 都沒收，最初的契約完全沒有它們——
 * 2026-08-20 新舊站對照從「舊站頁面連得到、新站沒有」反推出來的（close_wom 被 99 頁連到）。
 *
 * 四頁都是同一批健賞商品，用不同狀態分組：
 *   open       體驗報名中（有報名期間、體驗數）
 *   close      體驗報名結束
 *   open_wom   心得募集中
 *   close_wom  健賞成績已公告
 * 分組資訊在 JetEngine 欄位裡，REST 撈不到 → 從前台頁面解析，含 load more。
 *
 * 用法：node scripts/wp-recruit.mjs [--delay 150]
 */
import { readFile, writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const DELAY = Number(args.includes('--delay') ? args[args.indexOf('--delay') + 1] : 150);
const SITE = 'https://gcm.org.tw';
const OUT = '.source/recruit.json';
const UA = 'gcm-migration/1.0 (site rebuild)';
const PAGES = ['open', 'close', 'open_wom', 'close_wom'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => s
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

async function get(url, init) {
  await sleep(DELAY);
  const res = await fetch(url, { ...init, headers: { 'user-agent': UA, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function flatten(prefix, val, out) {
  if (Array.isArray(val)) val.forEach((v, i) => flatten(`${prefix}[${i}]`, v, out));
  else if (val && typeof val === 'object') for (const [k, v] of Object.entries(val)) flatten(`${prefix}[${k}]`, v, out);
  else out.push([prefix, val == null ? '' : String(val)]);
  return out;
}

/** 從一段 listing HTML 取出商品連結 */
const products = html => [...new Set(
  [...html.matchAll(/href="([^"]*\/wom\/[^"]+)"/g)]
    .map(m => { try { return decodeURIComponent(new URL(decode(m[1]), SITE).pathname); } catch { return null; } })
    .filter(p => p && p !== '/wom/')
)];

const out = {};
for (const key of PAGES) {
  const url = `${SITE}/recruit/${key}/`;
  const html = await get(url);
  const found = new Set(products(html));

  // load more：跟 wp-reviews 同一套 JetEngine 前端契約
  const nav = html.match(/data-nav="([^"]*)"/);
  const grid = html.match(/data-id="([0-9a-f]+)"[^>]*data-widget_type="jet-listing-grid/);
  if (nav) {
    const cfg = JSON.parse(decode(nav[1]));
    const per = Number(cfg.query?.posts_per_page) || 6;
    for (let page = 2; ; page += 1) {
      const body = new URLSearchParams([
        ['action', 'jet_engine_ajax'], ['handler', 'listing_load_more'],
        ...flatten('query', cfg.query, []), ...flatten('widget_settings', cfg.widget_settings, []),
        ...flatten('page_settings', { post_id: 0, queried_id: 0, element_id: grid ? grid[1] : '', page }, []),
        ['listing_type', 'false'], ['isEditMode', 'false'],
      ]);
      let more = '';
      try {
        const json = JSON.parse(await get(`${url}?nocache=1`, {
          method: 'POST', body,
          headers: { 'x-requested-with': 'XMLHttpRequest', 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        }));
        more = json?.data?.html ?? '';
      } catch (err) { console.error(`  ✗ ${key} 第 ${page} 頁：${err.message}`); break; }
      const list = products(more);
      const before = found.size;
      for (const p of list) found.add(p);
      if (!list.length || list.length < per) break;
      if (found.size === before) break;   // 沒有新東西就停，避免無限翻頁
    }
  }
  out[key] = [...found];
  console.log(`  /recruit/${key}/ → ${out[key].length} 個商品`);
}

await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`\n完成 → ${OUT}`);
