# gcm.org.tw v2 改版：從 WordPress 搬到 Astro

舊站是 WordPress + Elementor（hello-elementor 主題）、Rank Math SEO、LiteSpeed 主機。
新站是 Astro 靜態輸出，掛 GitHub Pages（自訂網域 gcm.org.tw）。

## 三個 repo 的分工

| repo | 負責 |
|---|---|
| **本 repo（靜態站）** | 內容頁、網址保留、SEO、設計規範 |
| `v2.gcm.org.tw-admin` | 後台 |
| Cloudflare 動態層 | 會員、報名、投稿、申請、捐款等 API；前端以 JS 呼叫 |

本 repo **不做 SSR、不接資料庫**。動態區塊一律是靜態殼 + client-side fetch。

## 第一鐵則：舊網址一條都不能斷

`legacy-urls.txt` 是契約清冊，`scripts/check-urls.mjs` 在 CI build 後比對 `dist/`，少一條就擋下部署。

要下架任何一條網址，只有三條合法路徑：

1. 在 `redirects.json` 寫明 301 目的地
2. 用戶明示同意後列進 `legacy-urls-retired.txt`
3. 補上對應頁面

「我判斷這頁不用留」不是理由。

### 網址型態（決定 astro.config.mjs 不可改的兩個設定）

舊站所有網址都是目錄式、結尾帶 `/`，所以：

```js
trailingSlash: 'always',
build: { format: 'directory' },
```

中文 slug（如 `/隱私權政策/`）在舊站是 percent-encoded；轉檔時一律解碼成中文再落地，
Astro 產出的目錄名是中文，瀏覽器與 CDN 會自行編碼回去，舊連結照樣命中。

### ⚠ 舊站 sitemap 不可信

`blog-sitemap1~6.xml` 合計 1,193 條，去重後只剩 802 條——Rank Math 的分頁互相重疊。
所以契約清冊是 **sitemap ∪ WP REST 匯出的 link**，以 REST 為主（blog 實際有 1,376 筆）。

## 內容遷移

```bash
node scripts/wp-export.mjs        # 舊站 REST 全量匯出 → .source/（節流＋斷點續傳）
node scripts/wp-media.mjs         # 只解析內容真正引用到的圖（媒體庫有 23,716 筆，不全拉）
node scripts/wp-convert.mjs       # → src/content/**.md（逐字轉錄）
node scripts/build-url-contract.mjs   # → legacy-urls.txt
```

### 逐字轉錄原則

正文是客戶自己寫的，一字不改。轉檔只拆掉「WordPress 外掛渲染出來的東西」：
ez-toc 自動目錄、`script`/`style`/`noscript`、WP 版型 class。

每篇 frontmatter 掛 `sourceVerbatim: true`，去 AI 味守門（`check-content.mjs`）整檔跳過。
**這個旗標只准用於原文搬遷**；新寫的文案掛旗標＝自廢守門。

### 舊站主機很脆

per_page=100 直接回 503。實測要 `per_page=20` + `_fields` 收斂 + 800ms 間隔，
單頁回應才從 30s 降到 8s。`wp-export.mjs` 每頁落地成 `.source/raw/<type>-pNNN.json`，
中斷重跑會跳過已抓的頁，不重打舊站。

## 頁面分類（`/wp-json/wp/v2/pages` 實查 25 頁）

**內容型——本 repo 逐字轉錄成靜態頁**

`/`、`/about/`、`/member/`（組織成員）、`/contact/`、`/隱私權政策/`、`/媒體報導/`、
`/donate/`、`/醫友健賞團/`、`/醫友招募/`、`/disclaimer/`、`/gcm-clean-label-潔淨標章/`

**動態型——靜態殼 + Cloudflare API**

`/register/`、`/register-step-2/`、`/success-registered/`、`/members/`（醫友專區）、
`/profile-updater/`、`/register-infor-renew/`、`/mem_pwd_reset/`、`/post_adding/`、
`/post_update/`、`/edit_activity/`、`/edit_chat/`、`/application-form/`、`/staffonly/`

後 8 個不在 sitemap（noindex 的會員頁），但網址仍在契約內。

## 自訂內容型別 → 路由對照

| 舊站 CPT | 筆數（REST 實查） | 網址 | 新站路由 |
|---|---|---|---|
| `blog` | 1,376 | `/blog/<slug>/` | `src/pages/blog/[...slug].astro` |
| `wom`（口碑） | 104 | `/wom/<slug>/` | `src/pages/wom/[...slug].astro` |
| `activities` | 2 | `/activities/<slug>/` | `src/pages/activities/[...slug].astro` |
| `gcm_podcast` | 3 | `/gcm_podcast/<slug>/` | `src/pages/gcm_podcast/[...slug].astro` |
| `blog-cate` | 10 | `/blog-cate/<slug>/` | `src/pages/blog-cate/[slug].astro` |
| `review` | 4,144 | 無對外網址 | 未進 collection，屬動態層資料 |

## 待辦

- [ ] 圖片鏡像：舊站圖片在 `/wp-content/uploads/`，舊站關掉就死。`.source/image-urls.txt` 是要下載的清單，網址原樣保留（連圖片網址都不斷）
- [ ] 首頁與內容型頁面的版型（等用戶提供正式網站地圖與發展方向）
- [ ] 動態頁面的 Cloudflare 端點契約（等動態層 repo 決定）
- [ ] `/feed/`（舊站 RSS）與 `/locations.kml` 的處理
