/* 內文連結修正表（唯一真實來源）。
 *
 * 為什麼要有這個檔：內文是從舊站**逐字轉錄**的，`src/content/**` 由 wp-convert.mjs 重新產生，
 * 直接改 .md 會在下次轉檔時被蓋掉。所以每一筆修正都必須宣告在這裡，由轉檔流程套用。
 *
 * 鐵則：**只動連結，不動任何一個字的文案。** 這裡的每一筆都是「連結壞掉」的機械修正，
 * 不是編修客戶的文字。要改文案是另一件事，要用戶點頭。
 *
 * 這批的來由：scripts/check-links.mjs 首次執行抓到 43 條無效連結，其中 20 條是轉檔把
 * <h2 id="..."> 的錨點弄丟（已在 wp-convert.mjs 修好），剩下 26 條**在舊站也是壞的**。
 * 用戶 2026-08-19 逐類核可以下處理方式。
 *
 * expect 是期望替換次數：來源資料重抓後若數字對不上，轉檔會警告——
 * 這樣「舊站改了內容導致修正失效」不會靜悄悄發生。
 */

export const fixes = [
  // ── ① 別站（appi.news）的導覽列被連同文章複製過來 ──
  {
    id: 'appi-nav',
    scope: '/blog/a-complete-guide-to-cosmetic-acupuncture-from-treatment-to-aftercare2/',
    find: '-   [焦點](/focus/)\n-   [國際](/international/)\n-   [健康](/health/)\n'
      + '-   [科技](/tech/)\n-   [財經](/finance/)\n-   [運動](/sports/)\n'
      + '-   [生活](/lifestyle/)\n-   [作者群](/authors/)\n-   [搜尋](/search/)\n\n',
    replace: '',
    expect: 1,
    why: '這 9 條是 appi.news 的網站選單，複製文章時一起帶進來的介面殘骸，不是文案。',
  },

  // ── ② 同樣來自 appi.news 的圖片路徑 ──
  {
    id: 'appi-image',
    scope: '/blog/first-domestic-hantavirus-case-reveals-cleaning-exposure-risks/',
    find: '/images/appi-news-190-3.webp',
    replace: '/wp-content/uploads/appi-news-190-3.webp',
    expect: 1,
    why: '圖在 appi.news 是 200 但 gcm.org.tw 沒有。已把檔案抓進本站圖庫，改指自己家——'
      + '跨站熱連結遲早被對方改版打斷。',
  },

  // ── ③ 作者連結把醫師的私人 email 放在網址裡 ──
  {
    id: 'author-email-unlink',
    scope: '*',
    find: /\[([^\]]*)\]\(\/author\/[^)]*\)/g,
    replace: '$1',
    expect: 5,
    why: '網址型如 /author/letfree641@gmail.com/，等於把合作醫師的私人信箱公開在網頁上；'
      + '而且新站沒有作者頁。保留姓名文字、拿掉連結。'
      + '⚠ 舊站上這些網址現在還在線，值得跟協會提。',
  },

  // ── ④ 舊站本來就斷的連結 ──
  {
    id: 'wom-dasuit-unlink',
    scope: '*',
    find: /\[([^\]]*)\]\(\/wom\/%E5%A4%A7%E9%81%A9%E5%9D%90%E5%A2%8A\/?\)/g,
    replace: '$1',
    expect: 3,
    why: '/wom/大適坐墊/ 在舊站 301 回首頁，wom 104 筆裡查無此項。'
      + 'wom 裡雖有「34 顆中空減壓坐墊」但那是別的品牌（Jemia），指過去會誤導評分歸屬，'
      + '所以只拿掉連結、保留文字。'
      + '⚠ 這 3 行是「延伸閱讀：…」的導引句，拿掉連結後會變成沒有去處的句子；'
      + '要整行刪掉需另外請用戶決定。',
  },
  {
    id: 'autism-retarget',
    scope: '/blog/probiotics-for-autism-improve-symptoms-with-diet/',
    find: '/blog/diet-for-autism-spectrum-disorders-and-emotional-regulation/',
    replace: '/blog/autism-diet-and-mood-regulation3/',
    expect: 1,
    why: '原網址在舊站 301 回首頁。改指站上主題最接近的既有文章「自閉症飲食與情緒調節」。',
  },
  {
    id: 'toc-section-8',
    scope: '/blog/dengue-fever-vs-common-cold-symptoms-warning-signs/',
    find: '9.  [參考文獻](#section-8)\n',
    replace: '',
    expect: 1,
    why: '作者手寫的目錄有 9 項，但文章只有 8 個帶錨點的標題（section-0～7），'
      + '第 9 項「參考文獻」沒有對應段落。',
  },

  // ── ⑤ 明顯手滑的網址 ──
  {
    id: 'typo-ellipsis',
    scope: '/blog/beat-procrastination-nutrition-guide/',
    find: '[/blog/beat-procrastina…-nutrition-guide/](/blog/beat-procrastina…-nutrition-guide/)',
    replace: '[/blog/beat-procrastination-nutrition-guide/](/blog/beat-procrastination-nutrition-guide/)',
    expect: 1,
    why: '網址中間被打成刪節號（U+2026）。這是文章末尾自己連自己的「連結:」欄位。',
  },
  {
    id: 'typo-invisible-char',
    scope: '/blog/ice-or-heat-when-to-use/',
    find: '[/blog/ice-or-heat-when-to-use/ ‎](</blog/ice-or-heat-when-to-use/ ‎>)',
    replace: '[/blog/ice-or-heat-when-to-use/](/blog/ice-or-heat-when-to-use/)',
    expect: 1,
    why: '網址尾巴多了一個空格與一個隱形字元（U+200E LEFT-TO-RIGHT MARK）。',
  },
  {
    id: 'wp-preview-url',
    scope: '/blog/african-swine-fever-vs-foot-and-mouth-disease-and-classical-swine-fever/',
    find: '(/?post_type=blog&p=33715&preview=true)',
    replace: '(/blog/african-swine-fever-vs-foot-and-mouth-disease-and-classical-swine-fever/)',
    expect: 1,
    why: 'WordPress 的預覽網址被貼進內文；連結文字本身就已經是正確網址。',
  },

  // ── ⑥ 分享按鈕的空殼 ──
  {
    id: 'share-buttons',
    scope: '/blog/morning-sickness-effects-on-baby-improvement/',
    // ⚠ 結尾不要帶 \n：toMarkdown 會 trim，這段剛好在內文最後，套用時那個換行還不存在
    find: '[Facebook](/#facebook "Facebook")[Twitter](/#twitter "Twitter")[Line](/#line "Line")',
    replace: '',
    expect: 1,
    why: '分享外掛的按鈕被複製成三個指向 /#… 的空連結。新站要做分享功能會另外做元件。',
  },

  // ── ⑦ 沒填完的粉絲團連結 ──
  {
    id: 'fb-placeholder',
    scope: '/blog/healthcare-food-sales-workshop-online/',
    find: '[/fb](/fb)',
    replace: '[https://www.facebook.com/GCM.org.tw](https://www.facebook.com/GCM.org.tw)',
    expect: 1,
    why: '內文寫「GCM協會FB粉絲團：[/fb](/fb)」，是沒填完的佔位；舊站 /fb 本身回 500。'
      + '協會粉絲團網址取自他們自己內容裡出現 8 次的 facebook.com/GCM.org.tw。',
  },

  // ── ⑧ 指向 WordPress 登入系統 ──
  {
    id: 'wp-login-lostpassword',
    scope: '/register/',
    find: '(/wp-login.php?action=lostpassword)',
    replace: '(/mem_pwd_reset/)',
    expect: 1,
    why: '/register/ 的「忘記密碼？」指向 WordPress 的 wp-login.php。先改指舊站既有的'
      + '/mem_pwd_reset/（網址已在保留契約內），最終由 Cloudflare 動態層接手。',
  },
];
