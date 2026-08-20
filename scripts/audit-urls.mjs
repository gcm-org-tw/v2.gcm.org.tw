#!/usr/bin/env node
/* 網址家族完整稽核：舊站每一頁連得到、但網址契約沒收的網址，全部列出來。
 *
 * 為什麼需要：契約是從 sitemap ＋ WP REST 產生的，而舊站有整批網址兩邊都不收——
 * /author/<id>/（429 條）與 /recruit/*（4 條）都是這樣漏掉的，而且是我碰巧看到才發現。
 * 這支把「碰巧」換成機械檢查：掃過每一條契約網址，把頁面上的站內連結全部收集起來，
 * 扣掉契約已有的，剩下的就是還沒被收進來的網址。
 *
 * 只抓舊站、一頁一次請求（比 compare-old-new 快一倍）。併發 3 ＋ 150ms，
 * 這是 2026-08-19 事故後實測的安全值。進度落地，中斷可續。
 *
 * 用法：node scripts/audit-urls.mjs [--workers 3] [--delay 150]
 */
import { readFile, writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const WORKERS = Number(argVal('--workers', 3));
const DELAY = Number(argVal('--delay', 150));
const OLD = 'https://gcm.org.tw';
const OUT = '.source/url-audit.json';
const UA = 'gcm-migration/1.0 (site rebuild url audit)';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => s.replace(/&#0?38;/g, '&').replace(/&amp;/g, '&');

async function get(url, tries = 3) {
  for (let i = 1; i <= tries; i += 1) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
      if (!res.ok) return '';
      return await res.text();
    } catch {
      if (i === tries) return '';
      await sleep(DELAY * 6 * i);
    }
  }
}

const toPath = u => {
  try {
    const p = decodeURIComponent(new URL(u, OLD).pathname);
    return p.endsWith('/') || /\.[a-z0-9]{2,5}$/i.test(p) ? p : `${p}/`;
  } catch { return null; }
};

const contract = new Set(
  (await readFile('legacy-urls.txt', 'utf8')).split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(toPath).filter(Boolean)
);
console.log(`契約 ${contract.size} 條`);

const store = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => ({}));
const todo = [...contract].filter(p => !store[p]);
console.log(`待掃 ${todo.length} 頁（併發 ${WORKERS}、間隔 ${DELAY}ms）`);

const enc = p => p.split('/').map(encodeURIComponent).join('/');
let cursor = 0, processed = 0;

async function worker() {
  while (cursor < todo.length) {
    const path = todo[cursor++];
    await sleep(DELAY);
    const html = await get(OLD + enc(path));
    const links = new Set();
    for (const m of html.matchAll(/<a[^>]+href=['"]([^'"]+)['"]/g)) {
      const href = decode(m[1]);
      if (href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;
      if (href.startsWith('http') && !href.startsWith(OLD)) continue;
      const p = toPath(href);
      if (p) links.add(p);
    }
    store[path] = [...links];
    processed += 1;
    if (processed % 100 === 0) {
      await writeFile(OUT, JSON.stringify(store, null, 2));
      console.log(`  … ${processed}/${todo.length}`);
    }
  }
}
await Promise.all(Array.from({ length: WORKERS }, () => worker()));
await writeFile(OUT, JSON.stringify(store, null, 2));

const seen = new Map();
for (const [from, links] of Object.entries(store)) {
  for (const l of links) {
    if (contract.has(l)) continue;
    if (!seen.has(l)) seen.set(l, []);
    if (seen.get(l).length < 3) seen.get(l).push(from);
  }
}
const family = p => `/${p.split('/').filter(Boolean)[0] ?? ''}/`;
const byFamily = new Map();
for (const l of seen.keys()) byFamily.set(family(l), (byFamily.get(family(l)) ?? 0) + 1);

console.log(`\n===== 舊站連得到、契約沒收的網址 =====`);
console.log(`共 ${seen.size} 條，分屬 ${byFamily.size} 個路徑家族\n`);
for (const [f, n] of [...byFamily].sort((a, b) => b[1] - a[1])) console.log(`  ${f.padEnd(28)} ${n}`);
console.log('\n前 30 條：');
for (const [l, froms] of [...seen].slice(0, 30)) console.log(`  ${l}\n      被連自：${froms.join('、')}`);
