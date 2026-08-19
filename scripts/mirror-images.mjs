#!/usr/bin/env node
/* 鏡像舊站圖片。
 *
 * 舊站圖片都在 https://gcm.org.tw/wp-content/uploads/…，舊站一關就全數失效——
 * 而且這些網址本身也在「網址保留」的範圍內（圖片搜尋、外站引用都靠它）。
 * 實測：11,725 個檔、平均 145KB、合計約 1.7GB。
 *
 * ⚠ 1.7GB 放不進 GitHub Pages（repo 與站台都是 1GB 量級的軟上限）→ 落點要另外決定：
 *   Cloudflare R2 + 在 gcm.org.tw 前面用 route 把 /wp-content/uploads/* 導過去，
 *   其餘流量才走 GitHub Pages。決定前先用這支把檔案抓到本機保存。
 *
 * 用法：node scripts/mirror-images.mjs --out /path/to/uploads [--concurrency 6] [--limit N]
 */
import { mkdir, writeFile, readFile, access, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const OUT = argVal('--out', '.source/uploads');
const CONCURRENCY = Number(argVal('--concurrency', 6));
const LIMIT = args.includes('--limit') ? Number(argVal('--limit')) : Infinity;
const LIST = argVal('--list', '.source/image-urls.txt');

async function exists(p) { try { await access(p); return true; } catch { return false; } }

const urls = (await readFile(LIST, 'utf8')).split('\n').map(s => s.trim()).filter(Boolean).slice(0, LIMIT);
console.log(`清單 ${urls.length} 個檔案 → ${OUT}`);

let done = 0, skipped = 0, failed = 0, bytes = 0;

async function fetchOne(url) {
  const path = decodeURIComponent(new URL(url).pathname); // /wp-content/uploads/…
  const dest = join(OUT, path);
  if (await exists(dest)) {
    skipped += 1;
    bytes += (await stat(dest)).size;
    return;
  }
  for (let i = 1; i <= 4; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      bytes += buf.length;
      done += 1;
      return;
    } catch (err) {
      if (i === 4) { failed += 1; console.error(`\n  ✗ ${url}：${err.message}`); return; }
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}

// 舊站主機很脆（per_page=100 就 503）→ 併發壓低，別把客戶站打掛
const queue = [...urls];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    await fetchOne(queue.shift());
    const n = done + skipped + failed;
    if (n % 25 === 0) {
      process.stdout.write(`\r  ${n}/${urls.length}　下載 ${done}　既有 ${skipped}　失敗 ${failed}　${(bytes / 1024 / 1024).toFixed(0)}MB   `);
    }
  }
}));

console.log(`\n完成：下載 ${done}、既有 ${skipped}、失敗 ${failed}、合計 ${(bytes / 1024 / 1024).toFixed(0)}MB`);
