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

const SRC = '.source';
const DEST = 'src/content';
const SITE = 'https://gcm.org.tw';

/* type → { dir, urlPrefix }；urlPrefix 用來核對轉出的 slug 是否還原得出原網址 */
const COLLECTIONS = {
  blog: { dir: 'blog', urlPrefix: '/blog/' },
  wom: { dir: 'wom', urlPrefix: '/wom/' },
  activities: { dir: 'activities', urlPrefix: '/activities/' },
  gcm_podcast: { dir: 'podcast', urlPrefix: '/gcm_podcast/' },
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
    // ez-toc 在標題旁塞的錨點 span（保留標題文字本身）
    .replace(/<span class="ez-toc-section"[^>]*><\/span>/g, '')
    .replace(/<span class="ez-toc-section-end"><\/span>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    // 站內絕對網址 → root-relative（網址結構不變）
    .replace(new RegExp(SITE.replace('.', '\\.') + '(?=/)', 'g'), '');
}

const td = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});
// 表格、iframe、audio 轉 Markdown 會失真 → 原樣保留 HTML
td.keep(['table', 'iframe', 'audio', 'video', 'figure']);
td.remove(['script', 'style', 'noscript']);

function toMarkdown(html) {
  return td.turndown(cleanHtml(html)).replace(/\n{3,}/g, '\n\n').trim();
}

const yaml = v => {
  if (v === undefined || v === null) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(x => JSON.stringify(String(x))).join(', ')}]`;
  return JSON.stringify(String(v));
};

// ── taxonomy id → slug ──
const taxMap = {};
for (const tax of TAXONOMIES) {
  const f = join(SRC, 'tax', `${tax}.json`);
  if (!await exists(f)) continue;
  taxMap[tax] = new Map(JSON.parse(await readFile(f, 'utf8')).map(t => [t.id, t.slug]));
}
const mediaUsed = await exists(join(SRC, 'media-used.json'))
  ? JSON.parse(await readFile(join(SRC, 'media-used.json'), 'utf8'))
  : {};

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
    const body = toMarkdown(item.content?.rendered || '');
    const hero = mediaUsed[item.featured_media];

    const fm = [
      '---',
      `title: ${yaml(title)}`,
      description ? `description: ${yaml(description)}` : null,
      `pubDate: ${yaml(item.date)}`,
      item.modified && item.modified !== item.date ? `updatedDate: ${yaml(item.modified)}` : null,
      hero?.source_url ? `heroImage: ${yaml(hero.source_url.replace(SITE, ''))}` : null,
      hero?.alt ? `heroImageAlt: ${yaml(hero.alt)}` : null,
      ...TAXONOMIES
        .filter(t => Array.isArray(item[t]) && item[t].length && taxMap[t])
        .map(t => `${t.replace(/-/g, '_')}: ${yaml(item[t].map(id => taxMap[t].get(id)).filter(Boolean))}`),
      `legacyId: ${item.id}`,
      `legacyPath: ${yaml(path)}`,
      '# 客戶既有原文逐字轉錄，去 AI 味守門整檔豁免（見 scripts/check-content.mjs）',
      'sourceVerbatim: true',
      '---',
      '',
    ].filter(Boolean).join('\n');

    // 檔名用 encodeURIComponent 保證中文 slug 也能落地且可逆
    const fileName = `${encodeURIComponent(slug)}.md`;
    await writeFile(join(outDir, fileName), fm + body + '\n');
    n += 1;
  }
  console.log(`${type} → ${outDir}：${n} 篇`);
  report.push(`${type}: ${n} 篇`);
}

if (report.some(r => r.startsWith('⚠'))) {
  console.log('\n注意事項：');
  for (const r of report.filter(r => r.startsWith('⚠'))) console.log('  ' + r);
}
