# 內文連結修正紀錄

> 本檔由 `scripts/wp-convert.mjs` 依 `content-link-fixes.mjs` **自動產生**，請勿手改。

內文是從舊站逐字轉錄的。這裡每一筆都**只動連結、不動任何一個字的文案**——
全部是「連結指向不存在的地方」的機械修正，且這些連結**在舊站也是壞的**。

共 12 筆，實際套用 18 處。

### appi-nav

- **範圍**：`/blog/a-complete-guide-to-cosmetic-acupuncture-from-treatment-to-aftercare2/`
- **命中**：1／預期 1
- **原本**：`-   [焦點](/focus/)⏎-   [國際](/international/)⏎-   [健康](/health/)⏎-   [科技](/tech/)⏎-   [財經](/`
- **改成**：（整段移除）
- **為什麼**：這 9 條是 appi.news 的網站選單，複製文章時一起帶進來的介面殘骸，不是文案。

### appi-image

- **範圍**：`/blog/first-domestic-hantavirus-case-reveals-cleaning-exposure-risks/`
- **命中**：1／預期 1
- **原本**：`/images/appi-news-190-3.webp`
- **改成**：`/wp-content/uploads/appi-news-190-3.webp`
- **為什麼**：圖在 appi.news 是 200 但 gcm.org.tw 沒有。已把檔案抓進本站圖庫，改指自己家——跨站熱連結遲早被對方改版打斷。

### author-email-unlink

- **範圍**：全站
- **命中**：5／預期 5
- **原本**：`\[([^\]]*)\]\(\/author\/[^)]*\)`（正規式）
- **改成**：`$1`
- **為什麼**：網址型如 /author/letfree641@gmail.com/，等於把合作醫師的私人信箱公開在網頁上；而且新站沒有作者頁。保留姓名文字、拿掉連結。⚠ 舊站上這些網址現在還在線，值得跟協會提。

### wom-dasuit-unlink

- **範圍**：全站
- **命中**：3／預期 3
- **原本**：`\[([^\]]*)\]\(\/wom\/%E5%A4%A7%E9%81%A9%E5%9D%90%E5%A2%8A\/?\)`（正規式）
- **改成**：`$1`
- **為什麼**：/wom/大適坐墊/ 在舊站 301 回首頁，wom 104 筆裡查無此項。wom 裡雖有「34 顆中空減壓坐墊」但那是別的品牌（Jemia），指過去會誤導評分歸屬，所以只拿掉連結、保留文字。⚠ 這 3 行是「延伸閱讀：…」的導引句，拿掉連結後會變成沒有去處的句子；要整行刪掉需另外請用戶決定。

### autism-retarget

- **範圍**：`/blog/probiotics-for-autism-improve-symptoms-with-diet/`
- **命中**：1／預期 1
- **原本**：`/blog/diet-for-autism-spectrum-disorders-and-emotional-regulation/`
- **改成**：`/blog/autism-diet-and-mood-regulation3/`
- **為什麼**：原網址在舊站 301 回首頁。改指站上主題最接近的既有文章「自閉症飲食與情緒調節」。

### toc-section-8

- **範圍**：`/blog/dengue-fever-vs-common-cold-symptoms-warning-signs/`
- **命中**：1／預期 1
- **原本**：`9.  [參考文獻](#section-8)⏎`
- **改成**：（整段移除）
- **為什麼**：作者手寫的目錄有 9 項，但文章只有 8 個帶錨點的標題（section-0～7），第 9 項「參考文獻」沒有對應段落。

### typo-ellipsis

- **範圍**：`/blog/beat-procrastination-nutrition-guide/`
- **命中**：1／預期 1
- **原本**：`[/blog/beat-procrastina…-nutrition-guide/](/blog/beat-procrastina…-nutrition-guide/)`
- **改成**：`[/blog/beat-procrastination-nutrition-guide/](/blog/beat-procrastination-nutrition-guide/)`
- **為什麼**：網址中間被打成刪節號（U+2026）。這是文章末尾自己連自己的「連結:」欄位。

### typo-invisible-char

- **範圍**：`/blog/ice-or-heat-when-to-use/`
- **命中**：1／預期 1
- **原本**：`[/blog/ice-or-heat-when-to-use/ ‎](</blog/ice-or-heat-when-to-use/ ‎>)`
- **改成**：`[/blog/ice-or-heat-when-to-use/](/blog/ice-or-heat-when-to-use/)`
- **為什麼**：網址尾巴多了一個空格與一個隱形字元（U+200E LEFT-TO-RIGHT MARK）。

### wp-preview-url

- **範圍**：`/blog/african-swine-fever-vs-foot-and-mouth-disease-and-classical-swine-fever/`
- **命中**：1／預期 1
- **原本**：`(/?post_type=blog&p=33715&preview=true)`
- **改成**：`(/blog/african-swine-fever-vs-foot-and-mouth-disease-and-classical-swine-fever/)`
- **為什麼**：WordPress 的預覽網址被貼進內文；連結文字本身就已經是正確網址。

### share-buttons

- **範圍**：`/blog/morning-sickness-effects-on-baby-improvement/`
- **命中**：1／預期 1
- **原本**：`[Facebook](/#facebook "Facebook")[Twitter](/#twitter "Twitter")[Line](/#line "Line")`
- **改成**：（整段移除）
- **為什麼**：分享外掛的按鈕被複製成三個指向 /#… 的空連結。新站要做分享功能會另外做元件。

### fb-placeholder

- **範圍**：`/blog/healthcare-food-sales-workshop-online/`
- **命中**：1／預期 1
- **原本**：`[/fb](/fb)`
- **改成**：`[https://www.facebook.com/GCM.org.tw](https://www.facebook.com/GCM.org.tw)`
- **為什麼**：內文寫「GCM協會FB粉絲團：[/fb](/fb)」，是沒填完的佔位；舊站 /fb 本身回 500。協會粉絲團網址取自他們自己內容裡出現 8 次的 facebook.com/GCM.org.tw。

### wp-login-lostpassword

- **範圍**：`/register/`
- **命中**：1／預期 1
- **原本**：`(/wp-login.php?action=lostpassword)`
- **改成**：`(/mem_pwd_reset/)`
- **為什麼**：/register/ 的「忘記密碼？」指向 WordPress 的 wp-login.php。先改指舊站既有的/mem_pwd_reset/（網址已在保留契約內），最終由 Cloudflare 動態層接手。
