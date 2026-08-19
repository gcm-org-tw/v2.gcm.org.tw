#!/usr/bin/env node
/* 把 .source/*.json（WordPress 匯出）轉成 Astro content collection 的 Markdown。
 *
 * 逐字轉錄原則（守門豁免的前提）：
 *   - 正文一字不改，只拆掉「舊站外掛產生的東西」——ez-toc 目錄、script/style/noscript、
 *     WP 版型 class。這些不是客戶寫的文案，是 WordPress 外掛渲染出來的。
 *   - 每篇掛 sourceVerbatim: true → check-content.mjs（去 AI 味守門）整檔跳過。
 *     ⚠ 只准用於這種原文搬遷；新寫的文案掛旗標＝自廢守門。
 *   - 站內絕對網址改成 root-relative（網址結構不變，只是不再綁死 host）。
 *
 * 用法：node scripts/wp-convert.mjs [--only blog] [--limit 20]
 */
import { readFile, writeFile, mkdir, access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import TurndownService from 'turndown';
import { fixes } from '../content-link-fixes.mjs';

const SRC = '.source';
const DEST = 'src/content';
const SITE = 'https://gcm.org.tw';

/* type → { dir, urlPrefix }；urlPrefix 用來核對轉出的 slug 是否還原得出原網址 */
const COLLECTIONS = {
  blog: { dir: 'blog', urlPrefix: '/blog/' },
  wom: { dir: 'wom', urlPrefix: '/wom/' },
  activities: { dir: 'activities', urlPrefix: '/activities/' },
  gcm_podcast: { dir: 'podcast', urlPrefix: '/gcm_podcast/' },
  'gcm-clean-label': { dir: 'clean-label', urlPrefix: '/gcm-clean-label/' },
};

const TAXONOMIES = ['blog-cate', 'blog-tag', 'blog-tag-keyword', 'blog-tag-theme', 'blog-fr-doctors', 'gcm_supplier_category'];

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const only = args.includes('--only') ? argVal('--only').split(',') : null;
const LIMIT = args.includes('--limit') ? Number(argVal('--limit')) : Infinity;

async function exists(p) { try { await access(p); return true; } catch { return false; } }

const decodeEntities = s => s
  .replace(/&#8217;|&#039;|&#39;/g, "'")
  .replace(/&#8220;|&#8221;|&quot;/g, '"')
  .replace(/&#8211;/g, '–')
  .replace(/&#8212;/g, '—')
  .replace(/&hellip;/g, '…')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

/** 拆掉舊站外掛渲染物，保留客戶原文 */
function cleanHtml(html) {
  return html
    // ez-toc 自動目錄（整塊，含巢狀 div）——新站自行產生目錄
    .replace(/<div id="ez-toc-container"[\s\S]*?<\/nav>\s*<\/div>/g, '')
    .replace(/<div id="ez-toc-container"[\s\S]*?<\/div>\s*<\/div>/g, '')
    // ez-toc 在標題結尾塞的空 span
    .replace(/<span class="ez-toc-section-end"><\/span>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    // 站內絕對網址 → root-relative（網址結構不變）
    .replace(new RegExp(SITE.replace('.', '\\.') + '(?=/)', 'g'), '');
}

/* 標題上的錨點 id 必須保住。
 * 作者手寫目錄用的是 <h2 id="section-0">，turndown 轉成 `## 標題` 會把 id 丟掉，
 * 於是文章自己的 <a href="#section-0"> 全部失效（2026-08-19 由 check-links.mjs 抓到，
 * 20 條錨點壞在 3 篇文章上）。
 * 作法：把標題元素與其內部 span 上的所有 id 提到標題**前面**變成獨立的空 span，
 * 標題本身維持純 Markdown——這樣 Astro 仍能從 headings 產生目錄，舊錨點也還在。 */
function hoistHeadingAnchors(html) {
  return html.replace(/<h([2-6])\b([^>]*)>([\s\S]*?)<\/h\1>/g, (_m, lvl, attrs, inner) => {
    const ids = [];
    const own = attrs.match(/\sid="([^"]+)"/);
    if (own) ids.push(own[1]);
    for (const m of inner.matchAll(/\sid="([^"]+)"/g)) ids.push(m[1]);
    const cleanInner = inner.replace(/<span[^>]*class="ez-toc-section"[^>]*><\/span>/g, '');
    const anchors = [...new Set(ids)].map(id => `<span id="${id}"></span>`).join('');
    return `${anchors}<h${lvl}${attrs.replace(/\sid="[^"]*"/, '')}>${cleanInner}</h${lvl}>`;
  });
}

const td = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  /* 空的具名 span＝錨點，要原樣留成 HTML。
   * ⚠ 不能用 addRule：turndown 在套規則之前就先把「空節點」交給 blankReplacement 處理掉了，
   *    自訂規則根本輪不到（實測 addRule 版本錨點會整批消失）。 */
  blankReplacement: (_content, node) =>
    (node.nodeName === 'SPAN' && node.id)
      ? `\n\n<span id="${node.id}"></span>\n\n`
      : (node.isBlock ? '\n\n' : ''),
});
// 表格、iframe、audio 轉 Markdown 會失真 → 原樣保留 HTML
td.keep(['table', 'iframe', 'audio', 'video', 'figure']);
td.remove(['script', 'style', 'noscript']);

function toMarkdown(html) {
  return td.turndown(hoistHeadingAnchors(cleanHtml(html))).replace(/\n{3,}/g, '\n\n').trim();
}

/* 內文連結修正：宣告在 content-link-fixes.mjs，套用在轉檔輸出上。
 * 直接改 src/content/**.md 沒有用——下次轉檔就被蓋掉。 */
const fixHits = new Map(fixes.map(f => [f.id, 0]));
function applyLinkFixes(markdown, legacyPath) {
  let out = markdown;
  for (const fix of fixes) {
    if (fix.scope !== '*' && fix.scope !== decodeURIComponent(legacyPath)) continue;
    const before = out;
    if (fix.find instanceof RegExp) {
      out = out.replace(fix.find, fix.replace);
      const n = (before.match(fix.find) || []).length;
      if (n) fixHits.set(fix.id, fixHits.get(fix.id) + n);
    } else {
      let n = 0;
      while (out.includes(fix.find)) { out = out.replace(fix.find, fix.replace); n += 1; }
      if (n) fixHits.set(fix.id, fixHits.get(fix.id) + n);
    }
  }
  return out;
}


const yaml = v => {
  if (v === undefined || v === null) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(x => JSON.stringify(String(x))).join(', ')}]`;
  return JSON.stringify(String(v));
};

// ── taxonomy id → slug，同時輸出給前端用的 slug → 名稱表 ──
const taxMap = {};
const taxOut = {};
for (const tax of TAXONOMIES) {
  const f = join(SRC, 'tax', `${tax}.json`);
  if (!await exists(f)) continue;
  const terms = JSON.parse(await readFile(f, 'utf8'));
  // WP 的 term slug 是 percent-encoded（中文標籤如 %e9%bb%83%e8%8a%b7%e6%98%95）。
  // Astro 動態路由比對走解碼後的字串 → 這裡一律先解碼，frontmatter 與 taxonomy.json 兩邊一致。
  const dec = s => { try { return decodeURIComponent(s); } catch { return s; } };
  taxMap[tax] = new Map(terms.map(t => [t.id, dec(t.slug)]));
  taxOut[tax] = Object.fromEntries(terms.map(t => [dec(t.slug), {
    name: decodeEntities(t.name || ''),
    description: decodeEntities(t.description || ''),
    count: t.count ?? 0,
    link: t.link ? new URL(t.link).pathname : undefined,
  }]));
}
if (Object.keys(taxOut).length) {
  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/taxonomy.json', JSON.stringify(taxOut, null, 2));
  console.log(`taxonomy → src/data/taxonomy.json（${Object.keys(taxOut).length} 個分類法）`);
}
const mediaUsed = await exists(join(SRC, 'media-used.json'))
  ? JSON.parse(await readFile(join(SRC, 'media-used.json'), 'utf8'))
  : {};

/* ── WordPress page 型（25 頁）──
 * 內容型頁面逐字轉錄；動態型（會員/報名/投稿/申請/捐款流程）只保留原文與網址，
 * 表單本身之後接 Cloudflare 動態層 → frontmatter 標 dynamic: true 供路由層辨識。
 * 首頁 '/' 不進 collection：那是新站設計的重點，等用戶給網站地圖再做，
 * 由 src/pages/index.astro 提供。 */
const DYNAMIC_PAGES = new Set([
  '/register/', '/register-step-2/', '/success-registered/', '/members/',
  '/profile-updater/', '/register-infor-renew/', '/mem_pwd_reset/',
  '/post_adding/', '/post_update/', '/edit_activity/', '/edit_chat/',
  '/application-form/', '/staffonly/',
]);
// 這幾條由專屬路由提供，不進 pages collection
const SKIP_PAGES = new Set(['/', '/blog/']);

async function convertPages() {
  const file = join(SRC, 'pages.json');
  if (!await exists(file)) { console.log('跳過 pages（尚未匯出）'); return; }
  const items = JSON.parse(await readFile(file, 'utf8'));
  const outDir = join(DEST, 'pages');
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  let n = 0;
  for (const item of items) {
    const path = new URL(item.link).pathname;
    const decoded = decodeURIComponent(path);
    if (SKIP_PAGES.has(decoded)) continue;

    const title = decodeEntities(item.title?.rendered || '').trim();
    const body = applyLinkFixes(toMarkdown(item.content?.rendered || ''), path);
    const isDynamic = DYNAMIC_PAGES.has(decoded);

    const fm = [
      '---',
      `title: ${yaml(title)}`,
      `pubDate: ${yaml(item.date_gmt ? `${item.date_gmt}Z` : item.date)}`,
      item.modified_gmt && item.modified_gmt !== item.date_gmt
        ? `updatedDate: ${yaml(`${item.modified_gmt}Z`)}`
        : null,
      `legacyId: ${item.id}`,
      `legacyPath: ${yaml(path)}`,
      isDynamic ? 'dynamic: true' : null,
      isDynamic ? '# 動態流程頁：表單/會員邏輯之後接 Cloudflare 動態層，這裡先保住網址與原文' : null,
      '# 客戶既有原文逐字轉錄，去 AI 味守門整檔豁免（見 scripts/check-content.mjs）',
      'sourceVerbatim: true',
      '---',
    ].filter(Boolean).join('\n') + '\n\n';

    const slug = decoded.replace(/^\//, '').replace(/\/$/, '');
    await writeFile(join(outDir, `${encodeURIComponent(slug)}.md`), fm + body + '\n');
    n += 1;
  }
  console.log(`pages → ${outDir}：${n} 頁（其中動態型 ${items.filter(i => DYNAMIC_PAGES.has(decodeURIComponent(new URL(i.link).pathname))).length} 頁）`);
}
await convertPages();

/* ── 醫友健賞團：商品說明、健賞成績、心得 ──
 * 這三樣在舊站都走不到 WP REST（JetEngine 自訂欄位沒註冊 show_in_rest），
 * 由 scripts/wp-wom.mjs 與 scripts/wp-reviews.mjs 從前台抓下來落在 .source/。
 * 心得有 2,566 則、單則可到數百字，塞進 frontmatter 會讓 .md 難讀也難 diff，
 * 所以另外輸出成 src/data/wom-reviews.json 給頁面 import；.md 只留商品說明與成績。 */
const womDetail = await exists(join(SRC, 'wom-detail.json'))
  ? JSON.parse(await readFile(join(SRC, 'wom-detail.json'), 'utf8')) : {};
const womReviews = await exists(join(SRC, 'reviews.json'))
  ? JSON.parse(await readFile(join(SRC, 'reviews.json'), 'utf8')) : {};

/* activities / gcm_podcast / gcm-clean-label 的正文同樣不在 REST 裡（JetEngine 自訂欄位），
 * 由 scripts/wp-jetengine-content.mjs 從前台抓回，以 legacyPath 為 key。 */
const jetContent = await exists(join(SRC, 'jetengine-content.json'))
  ? JSON.parse(await readFile(join(SRC, 'jetengine-content.json'), 'utf8')) : {};

const report = [];
for (const [type, cfg] of Object.entries(COLLECTIONS)) {
  if (only && !only.includes(type)) continue;
  const file = join(SRC, `${type}.json`);
  if (!await exists(file)) { console.log(`跳過 ${type}（尚未匯出）`); continue; }

  const items = JSON.parse(await readFile(file, 'utf8'));
  const outDir = join(DEST, cfg.dir);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  let n = 0;
  const slugSeen = new Map();
  for (const item of items.slice(0, LIMIT)) {
    // 舊網址是唯一真實來源；slug 從 link 反推，避免 WP slug 與網址不一致
    const path = new URL(item.link).pathname;                 // 例 /blog/xxx/
    const slug = decodeURIComponent(path.replace(cfg.urlPrefix, '').replace(/\/$/, ''));
    if (!slug) continue;                                       // 型別封面頁（如 /blog/）另外做，不進 collection
    if (slugSeen.has(slug)) { report.push(`⚠ ${type} slug 重複：${slug}`); continue; }
    slugSeen.set(slug, item.id);

    const title = decodeEntities(item.title?.rendered || '').trim();
    const excerptMd = item.excerpt?.rendered ? toMarkdown(item.excerpt.rendered) : '';
    const description = excerptMd.replace(/\s+/g, ' ').slice(0, 160).trim();
    let body = applyLinkFixes(toMarkdown(item.content?.rendered || ''), path);
    const hero = mediaUsed[item.featured_media];

    // wom 的內文在舊站是 JetEngine 欄位、不在 item.content 裡 → 用抓回來的商品說明補上
    const detail = type === 'wom' ? womDetail[item.slug] : null;
    if (detail?.description && !body.trim()) {
      body = detail.description.split('\n').map(l => l.trim()).filter(Boolean).join('\n\n');
    }
    if (!body.trim() && jetContent[path]) {
      // 抓回來的正文第一行常是頁面大標，與版型自己輸出的 <h1> 重複 → 去掉，避免同一句印兩次
      body = jetContent[path].replace(/^#\s+(.+)\n?/, (m, h) => (h.trim() === title ? '' : m)).trim();
    }

    const fm = [
      '---',
      `title: ${yaml(title)}`,
      description ? `description: ${yaml(description)}` : null,
      // WP 的 date 是站台當地時間（無時區標記），date_gmt 才明確 → 一律用 GMT 版本加 Z，
      // 否則建置機在 UTC 會把時間整批偏移 8 小時。
      `pubDate: ${yaml(item.date_gmt ? `${item.date_gmt}Z` : item.date)}`,
      item.modified_gmt && item.modified_gmt !== item.date_gmt
        ? `updatedDate: ${yaml(`${item.modified_gmt}Z`)}`
        : null,
      hero?.source_url ? `heroImage: ${yaml(hero.source_url.replace(SITE, ''))}` : null,
      hero?.alt ? `heroImageAlt: ${yaml(hero.alt)}` : null,
      ...TAXONOMIES
        .filter(t => Array.isArray(item[t]) && item[t].length && taxMap[t])
        .map(t => `${t.replace(/-/g, '_')}: ${yaml(item[t].map(id => taxMap[t].get(id)).filter(Boolean))}`),
      ...(detail ? [
        detail.brand ? `brand: ${yaml(detail.brand)}` : null,
        detail.brandUrl ? `brandUrl: ${yaml(detail.brandUrl)}` : null,
        detail.status ? `campaignStatus: ${yaml(detail.status)}` : null,
        detail.score ? `score: ${yaml(detail.score)}` : null,
        detail.participants ? `participants: ${yaml(detail.participants)}` : null,
        detail.period ? `period: ${yaml(detail.period)}` : null,
        detail.cycle ? `cycle: ${yaml(detail.cycle)}` : null,
        detail.announceMonth ? `announceMonth: ${yaml(detail.announceMonth)}` : null,
        detail.spec ? `spec: ${yaml(detail.spec)}` : null,
        detail.condition ? `condition: ${yaml(detail.condition)}` : null,
      ] : []),
      `legacyId: ${item.id}`,
      `legacyPath: ${yaml(path)}`,
      '# 客戶既有原文逐字轉錄，去 AI 味守門整檔豁免（見 scripts/check-content.mjs）',
      'sourceVerbatim: true',
      '---',
    ].filter(Boolean).join('\n') + '\n\n';   // ⚠ 這裡不能靠 filter 後的空字串補行，會被 filter(Boolean) 吃掉

    // 檔名用 encodeURIComponent 保證中文 slug 也能落地且可逆
    const fileName = `${encodeURIComponent(slug)}.md`;
    await writeFile(join(outDir, fileName), fm + body + '\n');
    n += 1;
  }
  console.log(`${type} → ${outDir}：${n} 篇`);
  report.push(`${type}: ${n} 篇`);
}

/* 心得落成前端可 import 的資料檔。key＝wom 的 slug（與 legacyPath 同源），
 * 值只留頁面會用到的欄位，順序照舊站（新到舊）。 */
if (Object.keys(womReviews).length && (!only || only.includes('wom'))) {
  const out = Object.fromEntries(Object.entries(womReviews).map(([slug, v]) => [
    slug,
    v.reviews.map(r => ({
      id: r.postId, title: r.authorTitle, name: r.authorName,
      date: r.date, score: r.score, body: r.body,
    })),
  ]));
  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/wom-reviews.json', JSON.stringify(out, null, 2) + '\n');
  const n = Object.values(out).reduce((a, b) => a + b.length, 0);
  console.log(`醫友心得 → src/data/wom-reviews.json：${Object.keys(out).length} 個商品、${n} 則`);
}

if (report.some(r => r.startsWith('⚠'))) {
  console.log('\n注意事項：');
  for (const r of report.filter(r => r.startsWith('⚠'))) console.log('  ' + r);
}

// ── 連結修正結果對帳：實際次數與 expect 不符就出聲（來源改了要知道） ──
console.log('\n內文連結修正：');
let fixWarn = 0;
for (const fix of fixes) {
  const n = fixHits.get(fix.id);
  const ok = n === fix.expect;
  if (!ok) fixWarn += 1;
  console.log(`  ${ok ? '✓' : '⚠'} ${fix.id.padEnd(24)} ${n}/${fix.expect} 處`);
}
if (fixWarn) {
  console.log(`  ⚠ 有 ${fixWarn} 筆修正的命中數與預期不符——舊站來源可能已變動，`);
  console.log('    請重看 content-link-fixes.mjs 並用 pnpm check:links 複驗。');
}

/* 給非開發者看的修正紀錄。由 content-link-fixes.mjs 自動產生，不要手改——
 * 手改會跟真正生效的規則漂移，而漂移方向必然是「文件說得比實際好聽」。 */
const mdRows = fixes.map(fix => {
  const find = fix.find instanceof RegExp ? `\`${fix.find.source}\`（正規式）` : `\`${fix.find.replace(/\n/g, '⏎').slice(0, 90)}\``;
  const rep = fix.replace === '' ? '（整段移除）' : `\`${String(fix.replace).replace(/\n/g, '⏎').slice(0, 90)}\``;
  return `### ${fix.id}\n\n- **範圍**：${fix.scope === '*' ? '全站' : `\`${fix.scope}\``}\n`
    + `- **命中**：${fixHits.get(fix.id)}／預期 ${fix.expect}\n`
    + `- **原本**：${find}\n- **改成**：${rep}\n- **為什麼**：${fix.why}\n`;
}).join('\n');

await writeFile('content-link-fixes.md',
  '# 內文連結修正紀錄\n\n'
  + '> 本檔由 `scripts/wp-convert.mjs` 依 `content-link-fixes.mjs` **自動產生**，請勿手改。\n\n'
  + '內文是從舊站逐字轉錄的。這裡每一筆都**只動連結、不動任何一個字的文案**——\n'
  + '全部是「連結指向不存在的地方」的機械修正，且這些連結**在舊站也是壞的**。\n\n'
  + `共 ${fixes.length} 筆，實際套用 ${[...fixHits.values()].reduce((a, b) => a + b, 0)} 處。\n\n`
  + mdRows);
console.log('\n修正紀錄 → content-link-fixes.md');
