import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { rehypeAssetBase } from './src/lib/assets.mjs';
import { SITE_URL } from './site.config.mjs';

/* 轉址表兩份（同樣被 scripts/check-urls.mjs 與 check-live-urls.mjs 讀）：
 *   redirects.json         人工維護，每條都要用戶點頭
 *   redirects-review.json  機器產生的 review 舊網址（4,144 條，見 build-review-redirects.mjs）
 * 分開放才看得出誰是誰。_comment 是說明欄位，不是路徑，要濾掉。 */
const redirects = Object.fromEntries(
  ['./redirects.json', './redirects-review.json']
    .flatMap(f => Object.entries(JSON.parse(readFileSync(f, 'utf8'))))
    .filter(([from]) => from.startsWith('/'))
);

/* GitHub Pages 的自訂網域來自 public/CNAME，它跟 SITE_URL 不一致就會部署到錯的網域
 * （症狀是站上線但 404／憑證錯），這裡在 build 當下就擋下來。 */
const cname = readFileSync('./public/CNAME', 'utf8').trim();
if (cname !== new URL(SITE_URL).host) {
  throw new Error(`public/CNAME（${cname}）與 site.config.mjs 的 SITE_URL（${SITE_URL}）不一致——兩邊要一起改`);
}

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  // 網址保留鐵則：舊站（WordPress）所有網址皆以 / 結尾，且為目錄式。
  // 這兩項一改，3,200+ 條既有網址全斷，勿動。
  trailingSlash: 'always',
  build: { format: 'directory' },
  redirects,
  // 內文裡的 /wp-content/uploads/… 改寫成 ASSET_BASE（開發期＝R2 的 r2.dev 網址）。
  // 內容檔本身不動，切換上線只要把 site.config.mjs 的 ASSET_BASE 設成空字串。
  // ⚠ Astro 6 起 markdown.rehypePlugins 已廢棄且**靜默失效**（只印一行 deprecated，
  //   外掛完全不會被呼叫）——必須包進 unified()。2026-08-19 在這裡卡了一輪。
  markdown: { processor: unified({ rehypePlugins: [rehypeAssetBase] }) },
  integrations: [
    sitemap({
      // 標籤彙整頁是保留網址用的薄頁（路由層已掛 noindex），不進 sitemap
      filter: page => !/\/blog-tag(-keyword|-theme)?\/|\/blog-fr-doctors\//.test(page),
    }),
  ],
});
