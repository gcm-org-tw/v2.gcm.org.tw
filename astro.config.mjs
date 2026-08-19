import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/* 轉址表由 redirects.json 提供（同一份也被 scripts/check-urls.mjs 讀）。
 * _comment 是說明欄位，不是路徑，要濾掉。 */
const redirects = Object.fromEntries(
  Object.entries(JSON.parse(readFileSync('./redirects.json', 'utf8')))
    .filter(([from]) => from.startsWith('/'))
);

export default defineConfig({
  site: 'https://gcm.org.tw',
  output: 'static',
  // 網址保留鐵則：舊站（WordPress）所有網址皆以 / 結尾，且為目錄式。
  // 這兩項一改，3,200+ 條既有網址全斷，勿動。
  trailingSlash: 'always',
  build: { format: 'directory' },
  redirects,
  integrations: [
    sitemap({
      // 標籤彙整頁是保留網址用的薄頁（路由層已掛 noindex），不進 sitemap
      filter: page => !/\/blog-tag(-keyword|-theme)?\/|\/blog-fr-doctors\//.test(page),
    }),
  ],
});
