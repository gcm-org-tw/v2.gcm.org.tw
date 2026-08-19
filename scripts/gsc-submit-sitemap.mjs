// 向 Google Search Console 提交 sitemap（一次性；之後 Google 靠 robots.txt Sitemap 行自行重爬）。
// dev 端手動跑一次即可——它需要 GSC 資源擁有者的 service account 金鑰（在主機、不進 repo），故不放 CI。
// 前置：該 SA 已是 GSC 資源擁有者（skill Phase 4 完成）、repo 有 google-auth-library
//       （沒有就 `pnpm add -D google-auth-library` 或用 GSC 網頁介面手動提交一次亦可）。
// 用法：
//   GSC_SA_KEY=~/.config/<slug>/ga4-sa.json \
//   GSC_SITE='sc-domain:example.com' \
//   SITE_URL='https://www.example.com' \
//   node scripts/gsc-submit-sitemap.mjs
import { GoogleAuth } from "google-auth-library";

const key = process.env.GSC_SA_KEY;
const siteRes = process.env.GSC_SITE; // 'sc-domain:example.com' 或 'https://www.example.com/'
const SITE_URL = process.env.SITE_URL;
if (!key || !siteRes || !SITE_URL) {
  console.error("缺 GSC_SA_KEY / GSC_SITE / SITE_URL。");
  process.exit(1);
}
const sitemap = new URL("sitemap-index.xml", SITE_URL).href;
const auth = new GoogleAuth({
  keyFile: key.replace(/^~/, process.env.HOME),
  scopes: ["https://www.googleapis.com/auth/webmasters"],
});
const client = await auth.getClient();
const endpoint =
  `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteRes)}` +
  `/sitemaps/${encodeURIComponent(sitemap)}`;
const res = await client.request({ url: endpoint, method: "PUT" });
console.log(`GSC sitemap 提交完成：HTTP ${res.status} — ${sitemap}`);
