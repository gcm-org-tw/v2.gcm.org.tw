---
title: "AI藥物研發突破：特發性肺纖維化新藥怎麼被找出來？"
description: "AI藥物研發正改變特發性肺纖維化的新藥發現流程，本文解析 AI藥物研發如何透過多組學分析鎖定 TNIK，推進小分子藥物 rentosertib 進入 Phase 2a 臨床試驗，並以 FVC 與安全性資料說明特發性肺纖維化治療從靶點辨識、分子篩選到人體驗證的關鍵差異，同時整理 AI Drug Discovery in"
pubDate: "2026-04-03T07:13:54Z"
updatedDate: "2026-04-12T11:32:02Z"
heroImage: "/wp-content/uploads/AI-Drug-Discovery-in-IPF8.jpg"
heroImageAlt: "AI Drug Discovery in IPF8"
blog_cate: ["rss-newstalk", "preventive-healthcare"]
blog_tag_keyword: ["ai藥物研發"]
authorId: 497
author: "協會編輯"
legacyId: 39268
legacyPath: "/blog/ai-drug-discovery-in-ipf/"
# 客戶既有原文逐字轉錄，去 AI 味守門整檔豁免（見 scripts/check-content.mjs）
sourceVerbatim: true
---

<iframe title="Spotify Embed: AI藥物研發突破：特發性肺纖維化新藥怎麼被找出來？ AI Drug Discovery in IPF" style="border-radius: 12px" width="100%" height="152" frameborder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" src="https://open.spotify.com/embed/episode/77My3MuQh4IdmdnI1gvZJk?si=WPDu1zJQTL6h3ZavWa9jRg&amp;utm_source=oembed"></iframe>

![](/wp-content/uploads/AI-Drug-Discovery-in-IPF1.jpg)

<span id="%E5%BC%95%E8%A8%80"></span>

## **引言**

當一種病被寫成「原因不明」，最沉重的，往往不是那四個字，而是病人和家屬接下來那種不知道該往哪裡走的感覺。你可能也有這種感覺：醫療明明一直在進步，可一碰到某些肺病，還是常聽到「先控制看看」。你以為新藥研發最難的是找到有效成分，其實更難的，常常是先看見真正該打的那個點。特發性肺纖維化多年來一直是難治疾病，很多治療只能拖慢惡化，卻很難真正改變病程。現在，AI藥物研發開始把這件事往前推了一步。2025 年發表的臨床試驗顯示，AI 找出的 TNIK 抑制劑 rentosertib 已走到 Phase 2a，且高劑量組的肺功能指標變化優於安慰劑組（註1）。這不只是「AI 很厲害」的故事，而是醫學開始學會在混亂裡更早看見機轉、選對分子，再把希望慢慢帶進人體試驗。這篇文章想陪你看懂的，就是這條新路究竟改變了什麼，離病人的生活又還有多遠。

**引言參考文獻：**

-   (註1) Xu Z, Ren F, Wang P, et al. *A generative AI-discovered TNIK inhibitor for idiopathic pulmonary fibrosis: a randomized phase 2a trial.* *Nature Medicine*. 2025. [Nature Medicine](https://www.nature.com/articles/s41591-025-03743-2?utm_source=chatgpt.com) ([nature.com](https://www.nature.com/articles/s41591-025-03743-2?utm_source=chatgpt.com))
-   Ren F, Aliper A, Chen J, et al. *A small-molecule TNIK inhibitor targets fibrosis in preclinical and clinical models.* *Nature Biotechnology*. 2025. [Nature Biotechnology](https://www.nature.com/articles/s41587-024-02143-0?utm_source=chatgpt.com) ([nature.com](https://www.nature.com/articles/s41587-024-02143-0?utm_source=chatgpt.com))

<iframe loading="lazy" title="AI藥物研發突破：特發性肺纖維化新藥怎麼被找出來？ AI Drug Discovery in IPF" width="800" height="450" src="https://www.youtube.com/embed/Q0QO0VJ7Bec?feature=oembed" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen=""></iframe>

![](/wp-content/uploads/AI-Drug-Discovery-in-IPF-2.jpg)

<span id="AI%E8%97%A5%E7%89%A9%E7%A0%94%E7%99%BC%E8%B7%9F%E5%82%B3%E7%B5%B1%E6%96%B0%E8%97%A5%E9%96%8B%E7%99%BC%EF%BC%8C%E5%88%B0%E5%BA%95%E5%B7%AE%E5%9C%A8%E5%93%AA%E8%A3%A1%EF%BC%9F"></span>

## **AI****藥物研發跟傳統新藥開發，到底差在哪裡？**

傳統新藥開發，常像在一大鍋藥材湯裡徒手撈出那一味真正有用的藥引，時間長、成本高，還常常撈到最後才發現方向不對。AI藥物研發不一樣，它不是替科學家按下捷徑鍵，而是先幫忙把「哪個靶點最值得追、哪個小分子最可能成功」這件事做更早、更精準的排序。近年的研究指出，AI已能參與治療標的探索、分子設計與前期篩選；在特發性肺纖維化（IPF）這類路徑複雜、過去轉譯困難的疾病上，研究團隊便以AI辨識出TNIK，並推進到小分子候選藥與人體試驗，這代表改變的不只是速度，而是整條研發路徑的判讀方式。(註1)(註2) 不過，別把 AI Drug Discovery 想成萬能鑰匙。模型再聰明，也仍受限於資料品質、偏差與可解釋性；換句話說，AI 能幫你把火候抓得更準，卻不能替你省略真正下鍋試煮的那一步。

![](/wp-content/uploads/AI-Drug-Discovery-in-IPF-3.jpg)

<span id="%E7%89%B9%E7%99%BC%E6%80%A7%E8%82%BA%E7%BA%96%E7%B6%AD%E5%8C%96%E7%82%BA%E4%BB%80%E9%BA%BC%E9%80%99%E9%BA%BC%E9%9B%A3%E6%B2%BB%EF%BC%9FAI_%E5%8F%88%E7%82%BA%E4%BB%80%E9%BA%BC%E7%89%B9%E5%88%A5%E6%9C%89%E6%A9%9F%E6%9C%83%E5%88%87%E9%80%B2%E4%BE%86%EF%BC%9F"></span>

## **特發性肺纖維化為什麼這麼難治？AI** **又為什麼特別有機會切進來？**

特發性肺纖維化不是單純「肺變硬」而已，它更像一鍋早已悶燒許久的濃湯，表面看起來只是咳、喘、肺功能下降，底下其實牽動的是發炎、修復失衡、纖維母細胞活化與細胞外基質堆積等多條路徑一起失控。也因為如此，IPF 長年最難的，不只是找藥，而是找出哪一個節點才是真正值得攻的地方。你可能也有這種感覺：醫學明明進步很快，為什麼遇到某些病，還是常聽到「原因不明」？其實關鍵就在這裡。當疾病不是單一路徑，而是一整張交錯網路時，AI 藥物研發的優勢才會浮現。近年的回顧指出，AI 在 IPF 的應用不只限於影像判讀，還延伸到整合臨床、形態學與多組學資料，幫助研究者更早辨識高價值標靶與可能受益的治療方向；而 2025 年的 Phase 2a 試驗也讓 rentosertib 成為一個具體例子，證明 AI 不只是會「看見問題」，而是可能真的把候選新藥往臨床推進一步。(註3)(註4) 當然，這仍不代表 IPF 已被攻克，因為再漂亮的模型，最後都得回到真實病人身上接受時間與安全性的考驗。

![](/wp-content/uploads/AI-Drug-Discovery-in-IPF4.jpg)

<span id="TNIK_%E8%B7%9F_rentosertib_%E6%98%AF%E4%BB%80%E9%BA%BC%EF%BC%9FAI_%E6%98%AF%E6%80%8E%E9%BA%BC%E6%8A%8A%E6%96%B0%E8%97%A5%E4%B8%80%E6%AD%A5%E6%AD%A5%E6%89%BE%E5%87%BA%E4%BE%86%E7%9A%84%EF%BC%9F"></span>

## **TNIK** **跟 rentosertib** **是什麼？AI** **是怎麼把新藥一步步找出來的？**

如果把傳統藥物研發比作在山林裡摸黑找路，那麼 TNIK 的出現，像是研究者終於在地圖上看見一座原本被霧遮住的山頭。TNIK 是一個和纖維化訊號網路密切相關的激酶，研究團隊先用 AI 從大量疾病資料裡辨識出它，再往下設計、篩選並優化小分子，最後做出 rentosertib，也就是先前稱為 ISM001-055 的候選藥物。這一步很關鍵，因為 AI 藥物研發真正厲害的地方，不只是把分子生得更快，而是能把「哪個分子值得被做進去」這件事提早判斷。2025 年發表的研究顯示，rentosertib 已進入隨機、雙盲、安慰劑對照的 Phase 2a 試驗，且高劑量組在用力肺活量變化上優於安慰劑組，安全性表現也具可接受性。 但這裡仍要冷靜看待：一個候選藥走到 2a 期，代表它開始被看見，不代表它已經完成臨床定論；真正的考驗，還在更長期的療效穩定性與更大規模的人體驗證。

![](/wp-content/uploads/AI-Drug-Discovery-in-IPF7.jpg)

<span id="%E7%9C%8B%E5%88%B0_AI_Drug_Discovery_in_IPF_%E9%80%99%E9%A1%9E%E6%96%B0%E8%81%9E%E6%99%82%EF%BC%8C%E4%BD%A0%E8%A9%B2%E6%80%8E%E9%BA%BC%E5%88%A4%E6%96%B7%E5%AE%83%E6%98%AF%E7%9C%9F%E7%AA%81%E7%A0%B4%EF%BC%8C%E9%82%84%E6%98%AF%E5%8F%AA%E6%98%AF%E5%BE%88%E6%9C%83%E8%AC%9B%EF%BC%9F"></span>

## **看到 AI Drug Discovery in IPF** **這類新聞時，你該怎麼判斷它是真突破，還是只是很會講？**

很多人忽略這件事：一則 AI 新藥新聞最迷人的地方，常常不是它真的走了多遠，而是它很會讓你以為終點快到了。真正值得你先看的，不是標題多震撼，而是四個問題。第一，有沒有講清楚靶點是誰，例如 TNIK 這類可被驗證的致病節點。第二，有沒有走到人體試驗，而不只是細胞或動物結果。第三，有沒有交代安全性與功能指標，像 IPF 研究裡常看的 FVC 變化。第四，有沒有把限制講出來，例如樣本數、追蹤時間與後續試驗還沒完成。以 rentosertib 目前的資料來看，它的確已跨過「只存在實驗室」這條線，進入隨機 Phase 2a 人體試驗，這很值得注意；但同時，研究也還沒有大到能直接改寫臨床常規。([nature.com](https://www.nature.com/articles/s41591-025-03743-2?utm_source=chatgpt.com)) 你知道嗎？真正成熟的 AI藥物研發，不像神話裡一匙仙丹，比較像把煎藥的火候抓得更準：少一分不熟，多一分會焦。科技能幫我們更快靠近答案，卻不能代替醫學把每一步都走完。

![](/wp-content/uploads/AI-Drug-Discovery-in-IPF5.jpg)

<span id="%E7%B5%90%E8%AB%96%EF%BC%9A%E7%95%B6%E7%A7%91%E6%8A%80%E9%96%8B%E5%A7%8B%E6%8A%8A%E7%AD%94%E6%A1%88%E6%8B%89%E8%BF%91%E7%97%85%E4%BA%BA"></span>

## **結論：當科技開始把答案拉近病人**

有些進步，不是一下子把疾病從世界上抹去，而是先把原本看不清的路，慢慢拉近到病人面前。AI 藥物研發之所以值得注意，不只是因為它讓特發性肺纖維化這類難治疾病多了一個新名字，而是它真的把「找靶點、選分子、進臨床」這條路往前推了一段。從西醫臨床的角度看，真正有價值的，不是新聞說得多震撼，而是證據走到哪裡。像 rentosertib 這樣的案例，之所以值得被記住，不只是因為它和 AI 有關，而是因為它已進入 **Phase 2a** **人體試驗**；而臨床試驗的邏輯本來就很清楚，**Phase 1** 主要看安全性、劑量與副作用，**Phase 2** 則開始檢驗治療是否對特定疾病有作用，同時持續補足安全性資訊。這代表它不是終點，但也已經不是只停在實驗室裡的想像。

你現在就可以先做兩件事。第一，當你下次再看到「AI 找到新藥」「AI 改寫醫療」這類標題時，先別急著被震住。你可以這樣問自己：**有沒有明確靶點？有沒有人體試驗？改善的是機轉、數值，還是病人真正感受到的功能？** 第二，如果你或家人正面對慢性肺病、纖維化，或需要長期追蹤的疾病，下次門診時也可以這樣問醫師：**「目前這個治療是在壓症狀，還是在改變病程？」**、**「有沒有新的臨床試驗或研究方向值得追蹤？」** 很多時候，問得更準，本身就是照護的一部分。

再往下看一層，多數人容易只記住一句話：AI 讓新藥變快了。其實更值得記住的是，AI 可能讓醫學少走一些錯路。速度只是表面，真正被改變的是排序能力：哪些靶點值得追，哪些分子值得做，哪些結果值得繼續投進人體研究。再深一層，這也提醒我們，未來醫療的競爭不只是誰比較快，而是誰比較能把「早期機轉辨識、臨床可驗證性、病人真正受益」連成一條線。

所以啊，別急著把 AI 想成神話，也別太快把它當成噱頭。它比較像把臨床研究的焦距調得更清楚：原本模糊的東西，開始有輪廓；原本很遠的可能，開始有了可被追蹤的位置。願你讀完這篇之後，帶走的不只是「AI 很厲害」這個印象，而是一套更穩的判讀方式。也歡迎你把最想追問的下一個問題留給我——**《本文將依據最新提問持續更新》**

<table style="width: 100%; border-collapse: collapse; border: 3px solid #1f5f57; font-size: 16px; line-height: 1.6;"><thead><tr style="background-color: #2a9d8f; color: #ffffff; font-weight: bold;"><th style="border: 3px solid #1f5f57; padding: 12px; text-align: left;">比較面向</th><th style="border: 3px solid #1f5f57; padding: 12px; text-align: left;">傳統藥物研發</th><th style="border: 3px solid #1f5f57; padding: 12px; text-align: left;">AI 藥物研發（本篇主題脈絡）</th><th style="border: 3px solid #1f5f57; padding: 12px; text-align: left;">讀者該怎麼解讀</th></tr></thead><tbody><tr style="background-color: #d4e9e2; color: #333333;"><td style="border: 3px solid #1f5f57; padding: 12px;">起點邏輯</td><td style="border: 3px solid #1f5f57; padding: 12px;">多從既有機轉、文獻累積、研究者假設出發</td><td style="border: 3px solid #1f5f57; padding: 12px;">可從大規模資料中更早辨識高價值靶點與候選分子</td><td style="border: 3px solid #1f5f57; padding: 12px;">差別不只在快，而是在「先看哪裡」</td></tr><tr style="background-color: #ffffff; color: #333333;"><td style="border: 3px solid #1f5f57; padding: 12px;">靶點辨識</td><td style="border: 3px solid #1f5f57; padding: 12px;">常需長時間逐步驗證，容易走很多彎路</td><td style="border: 3px solid #1f5f57; padding: 12px;">可整合多組學與疾病網路訊號，較快收斂到關鍵節點，如 TNIK</td><td style="border: 3px solid #1f5f57; padding: 12px;">真正突破常不是先有藥，而是先找到對的靶點</td></tr><tr style="background-color: #d4e9e2; color: #333333;"><td style="border: 3px solid #1f5f57; padding: 12px;">分子篩選方式</td><td style="border: 3px solid #1f5f57; padding: 12px;">大量試錯、逐輪優化，成本與時間都高</td><td style="border: 3px solid #1f5f57; padding: 12px;">先用模型篩掉大量低機率分子，再集中資源做優化</td><td style="border: 3px solid #1f5f57; padding: 12px;">AI 像先幫忙把海水退掉一半，再開始找針</td></tr><tr style="background-color: #ffffff; color: #333333;"><td style="border: 3px solid #1f5f57; padding: 12px;">前期研發速度</td><td style="border: 3px solid #1f5f57; padding: 12px;">通常較慢，從靶點到候選藥物需要多年</td><td style="border: 3px solid #1f5f57; padding: 12px;">有機會縮短早期發現到候選藥物的時間</td><td style="border: 3px solid #1f5f57; padding: 12px;">速度提升是優勢，但不是成功保證</td></tr><tr style="background-color: #d4e9e2; color: #333333;"><td style="border: 3px solid #1f5f57; padding: 12px;">在 IPF 的代表案例</td><td style="border: 3px solid #1f5f57; padding: 12px;">過去多數藥物偏向延緩惡化，真正新機轉突破有限</td><td style="border: 3px solid #1f5f57; padding: 12px;">以 TNIK 為標靶、rentosertib 為候選藥物，已走到人體 Phase 2a</td><td style="border: 3px solid #1f5f57; padding: 12px;">這是「不只停在實驗室」的重要訊號</td></tr><tr style="background-color: #ffffff; color: #333333;"><td style="border: 3px solid #1f5f57; padding: 12px;">目前證據層級</td><td style="border: 3px solid #1f5f57; padding: 12px;">多數藥物需經長時間累積，才逐步改變臨床實務</td><td style="border: 3px solid #1f5f57; padding: 12px;">已有前臨床＋人體早期試驗，但仍未等於臨床定論</td><td style="border: 3px solid #1f5f57; padding: 12px;">有進展，不等於已成常規治療</td></tr><tr style="background-color: #d4e9e2; color: #333333;"><td style="border: 3px solid #1f5f57; padding: 12px;">人體試驗意義</td><td style="border: 3px solid #1f5f57; padding: 12px;">通過人體試驗才算真正跨過關鍵門檻</td><td style="border: 3px solid #1f5f57; padding: 12px;">Phase 1 重安全性；Phase 2 看初步療效與劑量訊號</td><td style="border: 3px solid #1f5f57; padding: 12px;">看到人體試驗，要再問「走到第幾期」</td></tr><tr style="background-color: #ffffff; color: #333333;"><td style="border: 3px solid #1f5f57; padding: 12px;">功能指標判讀</td><td style="border: 3px solid #1f5f57; padding: 12px;">需看是否真的改善病人相關結果</td><td style="border: 3px solid #1f5f57; padding: 12px;">IPF 常看 FVC 等肺功能變化與安全性資料</td><td style="border: 3px solid #1f5f57; padding: 12px;">不只看「有沒有變好」，還要看變好了多少、能不能持續</td></tr><tr style="background-color: #d4e9e2; color: #333333;"><td style="border: 3px solid #1f5f57; padding: 12px;">目前限制</td><td style="border: 3px solid #1f5f57; padding: 12px;">耗時、昂貴、失敗率高</td><td style="border: 3px solid #1f5f57; padding: 12px;">仍受資料品質、模型偏差、可解釋性與後續臨床驗證限制</td><td style="border: 3px solid #1f5f57; padding: 12px;">AI 不是魔法，只是把排序能力變強</td></tr><tr style="background-color: #ffffff; color: #333333;"><td style="border: 3px solid #1f5f57; padding: 12px;">對病人的真正意義</td><td style="border: 3px solid #1f5f57; padding: 12px;">可能較慢等到新機轉治療進展</td><td style="border: 3px solid #1f5f57; padding: 12px;">有機會更早看到值得期待的新方向</td><td style="border: 3px solid #1f5f57; padding: 12px;">希望變近了，但還需要時間走完最後幾哩路</td></tr><tr style="background-color: #d4e9e2; color: #333333;"><td style="border: 3px solid #1f5f57; padding: 12px;">對新聞閱讀者的提醒</td><td style="border: 3px solid #1f5f57; padding: 12px;">傳統研發新聞通常較少被神化</td><td style="border: 3px solid #1f5f57; padding: 12px;">AI 題材容易被包裝成「重大突破」</td><td style="border: 3px solid #1f5f57; padding: 12px;">要先問：有沒有靶點？有沒有人體試驗？有沒有功能性結果？</td></tr></tbody></table>

**參考文獻：**

-   (註1) Pun FW, Ozerov IV, Zhavoronkov A. AI-powered therapeutic target discovery. *Trends in Pharmacological Sciences*. 2023;44(10):663-675. [PubMed](https://pubmed.ncbi.nlm.nih.gov/37479540/?utm_source=chatgpt.com)
-   (註2) Ren F, Aliper A, Chen J, et al. A small-molecule TNIK inhibitor targets fibrosis in preclinical and clinical models. *Nature Biotechnology*. 2025;43:63-75. [Nature](https://www.nature.com/articles/s41587-024-02143-0?utm_source=chatgpt.com)
-   (註3) Selman M, Buendia-Roldan I, Pardo A. Artificial intelligence in idiopathic pulmonary fibrosis. *European Respiratory Journal*. 2026;67(1):2501112. [ERS Publications](https://publications.ersnet.org/content/erj/67/1/2501112?utm_source=chatgpt.com)
-   (註4) Xu Z, Ren F, Wang P, et al. A generative AI-discovered TNIK inhibitor for idiopathic pulmonary fibrosis: a randomized phase 2a trial. *Nature Medicine*. 2025. [Nature Medicine](https://www.nature.com/articles/s41591-025-03743-2?utm_source=chatgpt.com)
-   (註5) Xu Z, Ren F, Wang P, et al. *A generative AI-discovered TNIK inhibitor for idiopathic pulmonary fibrosis: a randomized phase 2a trial.* Nature Medicine. 2025 Aug;31(8):2602-2610. [Nature Medicine](https://www.nature.com/articles/s41591-025-03743-2?utm_source=chatgpt.com) / [PubMed](https://pubmed.ncbi.nlm.nih.gov/40461817/?utm_source=chatgpt.com)
-   (註6) Ren F, Aliper A, Chen J, et al. *A small-molecule TNIK inhibitor targets fibrosis in preclinical and clinical models.* Nature Biotechnology. 2025;43(1):63-75. [Nature Biotechnology](https://www.nature.com/articles/s41587-024-02143-0?utm_source=chatgpt.com) / [PubMed](https://pubmed.ncbi.nlm.nih.gov/38459338/?utm_source=chatgpt.com)
-   (註7) Xu Z, Ren F, Wang P, et al. *A generative AI-discovered TNIK inhibitor for idiopathic pulmonary fibrosis: a randomized phase 2a trial.* Nature Medicine. 2025 Aug;31(8):2602-2610. [Nature Medicine](https://www.nature.com/articles/s41591-025-03743-2?utm_source=chatgpt.com) ([nature.com](https://www.nature.com/articles/s41591-025-03743-2?utm_source=chatgpt.com))
-   (註8) Niazi SK. *Artificial intelligence in small-molecule drug discovery: a critical review of methods, applications, and real-world outcomes.* Pharmaceuticals. 2025;18(6):847. [MDPI](https://www.mdpi.com/1424-8247/18/6/847) ([mdpi.com](https://www.mdpi.com/1424-8247/18/6/847))

作者與編輯資訊

**本文作者：**  
[  
GCM上醫預防醫學發展協會 數位編輯部  
](/blog/ai-drug-discovery-in-ipf/)

**投稿學者 :**

[國立臺灣大學公共衛生學院 特聘教授  陳秀熙  教授](https://www.realscience.top/7)

[國立臺灣大學公共衛生學院 兼任助理教授  許辰陽 醫師](https://www.realscience.top/7)

[廣播電台主持人  侯信恩](https://www.realscience.top/7)

**共同作者 :** [楊心怡 廣播電台主持人](https://apple.co/48wzQxQ)

**總編輯：**  
[**草本上膳醫廚－黃子彥**](https://www.facebook.com/drherbalcuisine/)

**編輯：**  
[  
GCM上醫預防醫學發展協會 數位編輯部  
](/blog/ai-drug-discovery-in-ipf/)

**免責聲明：** 本內容部分段落由 AI 協助生成，經專業編輯複核後發布。資訊僅供一般知識分享，非個別化醫療或治療建議；健康疑慮請洽專業人員。若涉及個資或肖像，皆依個資法處理；若含商業合作或聯盟行銷，將以「廣告／合作」明確標註。
