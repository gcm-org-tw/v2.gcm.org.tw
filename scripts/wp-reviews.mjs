#!/usr/bin/env node
/* 把舊站 4,144 則醫友健賞心得抓回來。
 *
 * 為什麼要另外寫一支：這批內容**走不到 WP REST**。`/wp-json/wp/v2/review/<id>` 只吐出
 * 標題（自動產生的「體驗心得 #10005」）、日期與作者，`acf` 是空陣列——心得本文、評分、
 * 職稱姓名全在 JetEngine 的自訂欄位裡，沒註冊 show_in_rest。
 *
 * 心得是怎麼被看到的：商品頁 /wom/<slug>/ 上有一個 JetEngine listing widget，
 * 查詢條件是 `post_type=review` + `meta item_source_post_id=<商品的 post id>`，
 * 一次渲染 5 則，其餘靠 load more。所以本腳本就照著它自己的前端契約走：
 *   POST 到 JetEngineSettings.ajaxlisting（＝商品頁網址本身，不是 admin-ajax.php），
 *   帶 action=jet_engine_ajax、handler=listing_load_more、query、widget_settings、
 *   page_settings[post_id|queried_id|element_id|page]。
 *   （打 admin-ajax.php 會回 500——那是先前試錯留下的教訓。）
 * query 裡有 JetEngine 自己簽的 signature，所以每個商品都必須先抓商品頁拿到那份 query，
 * 不能自己拼。
 *
 * ⚠ 舊站是 LiteSpeed 共享主機、很脆（曾被高併發掃描打到失去回應 20 分鐘）——
 *   所以這裡一律**序列**、每次請求間隔 DELAY，失敗指數退避。整批約 900 次請求、20-30 分鐘。
 *   進度落在 .source/reviews.json，中斷重跑會跳過已完成的商品。
 *
 * 用法：node scripts/wp-reviews.mjs [--limit N] [--delay 1200] [--only <wom-slug>]
 */
import { readFile, writeFile, access } from 'node:fs/promises';

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const LIMIT = args.includes('--limit') ? Number(argVal('--limit')) : Infinity;
const DELAY = Number(argVal('--delay', 1200));
const ONLY = argVal('--only', null);
const OUT = '.source/reviews.json';
const UA = 'gcm-migration/1.0 (site rebuild; contact lightman.chang@gmail.com)';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = async p => { try { await access(p); return true; } catch { return false; } };

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

/* jQuery 的 $.ajax 會把巢狀物件序列化成 PHP 認得的 a[b][0][c]=v，這裡照做 */
function flatten(prefix, val, out) {
  if (Array.isArray(val)) val.forEach((v, i) => flatten(`${prefix}[${i}]`, v, out));
  else if (val && typeof val === 'object') for (const [k, v] of Object.entries(val)) flatten(`${prefix}[${k}]`, v, out);
  else out.push([prefix, val === null || val === undefined ? '' : String(val)]);
  return out;
}

async function loadMore(pageUrl, nav, ids, page, tries = 3) {
  const body = new URLSearchParams([
    ['action', 'jet_engine_ajax'],
    ['handler', 'listing_load_more'],
    ...flatten('query', nav.query, []),
    ...flatten('widget_settings', nav.widget_settings, []),
    ...flatten('page_settings', { ...ids, page }, []),
    ['listing_type', 'false'],
    ['isEditMode', 'false'],
  ]);
  for (let i = 1; i <= tries; i += 1) {
    await sleep(DELAY);
    try {
      const res = await fetch(`${pageUrl}?nocache=1`, {
        method: 'POST',
        headers: {
          'user-agent': UA,
          'x-requested-with': 'XMLHttpRequest',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'cache-control': 'no-cache',
        },
        body,
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json?.data?.html ?? '';
    } catch (err) {
      if (i === tries) throw err;
      await sleep(DELAY * 4 * i);
    }
  }
}

const stripTags = s => s.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, '\n');
const decode = s => s
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'");

/* 一則心得渲染出來的文字節點順序：職稱、姓名、日期、分數、內文（可多段）。
 * 職稱可能缺（非醫事人員或沒填），所以用日期與分數當錨點來切，不靠固定索引。 */
function parseItems(gridHtml) {
  const chunks = gridHtml.split(/<div class="jet-listing-grid__item/).slice(1);
  return chunks.map(raw => {
    // split 之後開頭是被切斷的那個 div 剩下的屬性，先切掉到第一個 '>'，否則屬性會被當成文字
    const chunk = raw.slice(raw.indexOf('>') + 1);
    // 每則心得的容器帶著自己的 post id，這是 review CPT 的文章 ID——
    // 用它才對得回 /review/<slug>/ 那 4,144 條舊網址（對照表在 .source/review.json）
    const postId = Number((raw.match(/data-post-id="(\d+)"/) || [])[1]) || null;
    const nodes = decode(stripTags(chunk)).split('\n').map(s => s.trim()).filter(Boolean);
    const dateAt = nodes.findIndex(n => /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(n));
    const scoreAt = nodes.findIndex(n => /^\/5分$/.test(n));
    if (dateAt < 0) return null;
    const head = nodes.slice(0, dateAt);
    const score = scoreAt > dateAt ? Number(nodes.slice(dateAt + 1, scoreAt).find(n => /^\d+(\.\d+)?$/.test(n))) : null;
    const body = nodes.slice(scoreAt > 0 ? scoreAt + 1 : dateAt + 1);
    /* 醫友自己上傳的體驗照：JetEngine 表單的附件，網址在 /wp-content/uploads/jet-engine-forms/ 底下。
     * 舊站的心得卡片上會展示，新站原本一張都沒有。 */
    const photos = [...new Set(
      [...raw.matchAll(/(?:src|href)="([^"]*\/wp-content\/uploads\/jet-engine-forms\/[^"]+)"/g)]
        .map(m => decode(m[1]).replace(/^https?:\/\/[^/]+/, ''))
    )];

    return {
      postId,
      photos,
      // 舊站這一欄有三種形態：只有暱稱、「職稱＋姓名」、「職稱＋姓名＋暱稱」，
      // 所以第一段當職稱、其餘整串留著，不要只取最後一段（會把本名丟掉）
      authorTitle: head.length > 1 ? head[0] : '',
      authorName: head.length > 1 ? head.slice(1).join(' ') : (head[0] ?? ''),
      date: nodes[dateAt],
      score: Number.isFinite(score) ? score : null,
      body: body.join('\n\n'),
    };
  }).filter(r => r && r.body);
}

const products = JSON.parse(await readFile('.source/wom.json', 'utf8'));
const done = (await exists(OUT)) ? JSON.parse(await readFile(OUT, 'utf8')) : {};
const todo = products.filter(p => !done[p.slug] && (!ONLY || p.slug === ONLY)).slice(0, LIMIT);
console.log(`商品 ${products.length} 個，已抓 ${Object.keys(done).length} 個，本輪 ${todo.length} 個（序列、每次間隔 ${DELAY}ms）`);

let total = Object.values(done).reduce((n, r) => n + r.reviews.length, 0);
for (const [i, p] of todo.entries()) {
  const pageUrl = p.link;
  let html;
  try { html = await get(pageUrl); }
  catch (err) { console.error(`  ✗ ${p.slug} 商品頁抓不到：${err.message}`); continue; }

  const navMatch = html.match(/data-nav="([^"]*)"/);
  const gridMatch = html.match(/data-id="([0-9a-f]+)"[^>]*data-widget_type="jet-listing-grid/);
  if (!navMatch) { console.log(`  – ${p.slug} 沒有心得清單（跳過）`); done[p.slug] = { id: p.id, reviews: [] }; continue; }
  const nav = JSON.parse(decode(navMatch[1]));
  const ids = { post_id: p.id, queried_id: p.id, element_id: gridMatch ? gridMatch[1] : '' };

  const reviews = parseItems(html.slice(html.indexOf('jet-listing-grid__items')));
  const perPage = Number(nav.query.posts_per_page) || 5;
  for (let page = 2; ; page += 1) {
    let more;
    try { more = await loadMore(pageUrl, nav, ids, page); }
    catch (err) { console.error(`  ✗ ${p.slug} 第 ${page} 頁：${err.message}`); break; }
    const parsed = parseItems(more);
    reviews.push(...parsed);
    if (parsed.length < perPage) break;
  }

  done[p.slug] = { id: p.id, title: p.title?.rendered ?? '', reviews };
  total += reviews.length;
  await writeFile(OUT, JSON.stringify(done, null, 2));
  console.log(`  [${i + 1}/${todo.length}] ${p.slug} → ${reviews.length} 則（累計 ${total}）`);
}

console.log(`\n完成：${Object.keys(done).length} 個商品、合計 ${total} 則心得 → ${OUT}`);
