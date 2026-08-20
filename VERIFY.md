# 驗證與重跑指令

改版期間所有「怎麼確認沒搬丟」的工具，一頁列完。時間都是 2026-08-20 的實測值。

## 一、離線守門（不打舊站，最常用）

```bash
pnpm build      # 產出 dist/，內含 check-design + check-content
pnpm verify     # 四道守門一次跑完，約 2 分鐘
```

`pnpm verify` = 設計規範 → 內容守門 → 網址契約 → 站內連結 → R2 對帳。

| 指令 | 驗什麼 | 失敗代表 |
|---|---|---|
| `pnpm check:design` | oklch token、字級階梯 ≥18px、css 白名單、無 !important、無外部 CDN | 版面規範被破壞 |
| `pnpm check:content` | 去 AI 味守門（`sourceVerbatim: true` 的檔整檔豁免） | 有 AI 腔句型 |
| `pnpm check:urls` | 契約 7,846 條網址每條都有 `dist/` 產出或明示轉址 | **舊網址斷了** |
| `pnpm check:links` | `dist/` 裡 12 萬條站內連結每條都指得到東西 | 站內死連結 |
| `pnpm check:r2` | ①本機鏡像↔R2ㅤ②`dist/` 參照到的 15,147 張圖↔R2 | 圖片會破 |
| `pnpm check:images` | 舊站圖片完整清冊 6,414 張 ↔ 本機鏡像（吃 `.source/compare.json`） | 鏡像漏抓 |

`check:images` 的清冊是從 `pnpm diff` 存下來的每頁圖片清單彙總的（含 CSS 背景圖），
不是從 `wp-media` 的清單來的——後者只涵蓋當時抓得到的內容，作者頭像、商品圖組、
醫友體驗照從一開始就不在裡面。舊站自己已失效的圖（實測 301 導回首頁）記在
`.source/dead-images.txt`，分開列不算缺漏，目前 28 張。

CI（`.github/workflows/deploy.yml`）跑 design/content/urls/links，部署後再跑 `check-live-urls`
逐條 curl 線上網址（11,900+ 條，含轉址頁；遇 429 會退避重試）。

## 二、新舊站對照（會打舊站，慢）

```bash
pnpm diff          # 逐頁比對，7,846 條約 3 小時（併發 3）
pnpm diff:report   # 讀 .source/compare.json 出報告，秒回
pnpm audit:urls    # 找「舊站連得到、契約沒收」的網址，約 1.5 小時
```

- `diff` 比可見文字量、圖片、站內連結、標題階層。**圖片含 CSS 背景圖**——Elementor 把
  區塊背景放在它自己產生的 CSS 裡，只掃 `<img>` 會漏掉整個 hero（首頁大圖就是這樣漏的）。
- `diff` 斷點續傳：`.source/compare.json` 已有的網址會跳過。要重驗某一段就先從
  該檔刪掉那些 key（見 git log 的做法），不必整輪重跑。
- `diff:report` 會**分區段**濾掉舊站的共用推薦模組（最新文章／熱門文章／商品大賞）。
  門檻是「在該區段出現率 > 30%」——用全站比例會濾不掉，真訊號會被上千筆同樣的東西蓋住。
- 報告剩下的差異**仍需人工判讀**：舊站的延伸閱讀會把相關文章連同標籤縮圖塞進頁面，
  那類項目低於門檻時會留在報告裡，不是內容損失。判讀方法：抽一篇看它自己的 frontmatter
  有沒有那個標籤。

## 三、內容重抓（舊站關掉前才有意義）

```bash
pnpm wp:export      # WP REST 全量匯出 → .source/*.json
pnpm wp:wom         # 健賞商品說明、成績、商品圖組
pnpm wp:reviews     # 2,566 則醫友心得（含體驗照）
pnpm wp:authors     # 文章/心得的作者 + 430 位作者簡介
pnpm wp:recruit     # /recruit/ 四頁的商品分組
pnpm wp:jetengine   # 活動／Podcast／潔淨標章的正文
pnpm wp:convert     # .source/ → src/content/ 與 src/data/
pnpm url:contract   # 重建 legacy-urls.txt（--offline 只用本地來源）
pnpm url:redirects  # 重建 redirects-review.json
pnpm r2:upload      # 補傳鏡像到 R2（斷點續傳）
```

**所有打舊站的腳本一律併發 3 ＋每請求 150ms。** 那不是效能參數是安全參數：
2026-08-19 用 concurrency 20 掃描，把舊站（LiteSpeed 共享主機）打到 TCP 443
失去回應約 20 分鐘。同一次事故測出 concurrency 3 跑完 11,725 檔 0 失敗、未再干擾。
出現 503 或逾時就是天花板，不是待優化項。

## 四、改完一輪的標準流程

```bash
pnpm wp:convert && pnpm build && pnpm verify   # 本地確認
git add -A && git commit && git push           # CI 會再跑一次並部署
pnpm diff:report                               # 看對照報告還剩什麼
```

要重驗被改動影響的區段：從 `.source/compare.json` 刪掉那些 key，再 `pnpm diff`。
