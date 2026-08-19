/* 全站共用設定。被 astro.config.mjs、scripts/*.mjs 與 CI 共讀，避免多處漂移。 */

/* 站台正式網址（單一來源）。canonical、sitemap、robots.txt、GitHub Pages 的 CNAME、
 * CI 的 verify 與 IndexNow 全部跟著這一行走，astro.config.mjs 會檢查 public/CNAME 是否一致。
 *
 * 現況：驗收網址 v2.gcm.yao.care（DNS 已 CNAME 到 gcm-org-tw.github.io）。
 * 切換上線那天：改成 'https://gcm.org.tw'、同步改 public/CNAME、INDEXABLE 打開。 */
export const SITE_URL = process.env.SITE_URL ?? 'https://v2.gcm.yao.care';

/* 要不要讓搜尋引擎收錄。v2 是驗收網址，內容與線上 gcm.org.tw 一模一樣——
 * 開放收錄等於拿 3,322 頁跟協會自己的正式站打對台（重複內容），所以預設關閉：
 * robots.txt 全站 Disallow、CI 不送 IndexNow。切到 gcm.org.tw 那天改成 true。 */
export const INDEXABLE = (process.env.INDEXABLE ?? 'false') === 'true';

/* 舊站圖片的網址前綴。內容裡的路徑一律維持 `/wp-content/uploads/…`（與舊站相同），
 * 由這裡決定它最後指到哪。
 *
 * 現況（開發期）：指向 R2 的 r2.dev 公開網址。
 *   ⚠ r2.dev 是 Cloudflare 給的開發用網址，有速率限制、不適合正式流量。
 *
 * 切換上線那天：把 ASSET_BASE 設回空字串，路徑就回到 `/wp-content/uploads/…`，
 * 由 gcm.org.tw 上的 Cloudflare 路由導到同一個 R2 bucket——
 * 圖片網址與舊站完全一致，不需要改任何內容。
 *
 * 可用環境變數 ASSET_BASE 覆寫（例如本機把檔案掛在 public/ 時設成空字串）。
 */
export const ASSET_BASE =
  process.env.ASSET_BASE ?? 'https://pub-4e709a844982451f91c781dbc83e9d8b.r2.dev';

/* 由 ASSET_BASE 接管的路徑前綴。這些路徑不會出現在 dist/ 裡。 */
export const ASSET_PREFIXES = ['/wp-content/uploads/'];

export const R2_BUCKET = 'gcm-org-tw-uploads';
export const CF_ACCOUNT_ID = 'a676b8adbcca51a6a0ee1b22711e11d9'; // Gcmgcm2021@gmail.com's Account
