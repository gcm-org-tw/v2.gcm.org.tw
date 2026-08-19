#!/usr/bin/env node
/* 圖片體積最佳化——**不改副檔名、不改路徑**。
 *
 * 為什麼不轉 WebP：GitHub Pages 的 content-type 是看副檔名決定的，
 * 把 WebP 位元組塞進 .png 檔會被當成 image/png 送出而爛掉。
 * 而 /wp-content/uploads/xxx.png 這條網址本身在保留範圍內，不能改。
 * 所以一律「原格式重新編碼」：
 *   - jpg/jpeg → mozjpeg q82 progressive
 *   - png      → palette 量化（照片型 PNG 省最多）
 *   - webp     → q80 重新編碼
 *
 * 預設 --dry-run 只量測不寫檔。原始檔請保留在 .source/uploads/，這支才可逆。
 *
 * 用法：
 *   node scripts/optimize-images.mjs --in .source/uploads --dry-run
 *   node scripts/optimize-images.mjs --in .source/uploads --out .source/uploads-opt
 */
import { readdir, stat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname, dirname, relative } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const argVal = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const IN = argVal('--in', '.source/uploads');
const OUT = argVal('--out', null);
const DRY = args.includes('--dry-run') || !OUT;
const LIMIT = args.includes('--limit') ? Number(argVal('--limit')) : Infinity;

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const stats = {};
const bump = (k, before, after) => {
  stats[k] ??= { n: 0, before: 0, after: 0 };
  stats[k].n += 1;
  stats[k].before += before;
  stats[k].after += after;
};

let n = 0;
for await (const file of walk(IN)) {
  if (n >= LIMIT) break;
  const ext = extname(file).toLowerCase();
  const before = (await stat(file)).size;

  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    bump(ext || '(無副檔名)', before, before);   // mp3/mp4 等原樣計入
    n += 1;
    continue;
  }

  let buf;
  try {
    const img = sharp(await readFile(file), { failOn: 'none' });
    if (ext === '.png') buf = await img.png({ palette: true, quality: 80, effort: 7 }).toBuffer();
    else if (ext === '.webp') buf = await img.webp({ quality: 80 }).toBuffer();
    else buf = await img.jpeg({ quality: 82, progressive: true, mozjpeg: true }).toBuffer();
  } catch (err) {
    console.error(`  ✗ ${relative(IN, file)}：${err.message}`);
    bump(ext, before, before);
    n += 1;
    continue;
  }

  // 重新編碼反而變大就保留原檔（小圖、已壓過的圖常見）
  if (buf.length >= before) buf = await readFile(file);

  bump(ext, before, buf.length);
  if (!DRY) {
    const dest = join(OUT, relative(IN, file));
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
  }
  n += 1;
  if (n % 200 === 0) process.stdout.write(`\r  處理 ${n} 個…   `);
}

process.stdout.write('\n');
const mb = b => (b / 1024 / 1024).toFixed(0);
let tb = 0, ta = 0;
console.log(`${DRY ? '【試算，未寫檔】' : `【已寫入 ${OUT}】`}`);
for (const [k, v] of Object.entries(stats).sort((a, b) => b[1].before - a[1].before)) {
  tb += v.before; ta += v.after;
  const cut = v.before ? ((1 - v.after / v.before) * 100).toFixed(0) : 0;
  console.log(`  ${k.padEnd(8)} ${String(v.n).padStart(6)} 個　${mb(v.before).padStart(5)} MB → ${mb(v.after).padStart(5)} MB　省 ${cut}%`);
}
console.log(`  ${'合計'.padEnd(7)} ${String(n).padStart(6)} 個　${mb(tb).padStart(5)} MB → ${mb(ta).padStart(5)} MB　省 ${((1 - ta / tb) * 100).toFixed(0)}%`);
