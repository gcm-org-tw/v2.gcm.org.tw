/* robots.txt 由 site.config.mjs 產生，不再是 public/ 裡的靜態檔——
 * 之前那份寫死 gcm.org.tw 並留了「建站時記得換」的註解，那種註解遲早會被忘記。
 * 收錄開關與 Sitemap 網址都跟著 SITE_URL／INDEXABLE 走。 */
import { SITE_URL, INDEXABLE } from '../../site.config.mjs';

export function GET() {
  const body = INDEXABLE
    ? [
        '# 開放一般與 AI 爬蟲；Sitemap 行供 Google 等自動發現',
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${SITE_URL}/sitemap-index.xml`,
        '',
      ].join('\n')
    : [
        '# 驗收網址：內容與正式站 gcm.org.tw 相同，開放收錄會造成重複內容互打，',
        '# 所以全站不收錄。切換到正式網域時把 site.config.mjs 的 INDEXABLE 設成 true。',
        'User-agent: *',
        'Disallow: /',
        '',
      ].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
