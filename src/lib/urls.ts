/* 舊網址 → 路由參數。
 *
 * frontmatter 的 legacyPath 是舊站原樣的 pathname（percent-encoded，例如中文 slug 或全形冒號）。
 * Astro 的動態路由比對走「解碼後」的字串，所以 getStaticPaths 的 params 一律要餵解碼版，
 * 否則 /blog/christian-tcm-guide％ef％bc％9a-… 這種頁面會在 build 時
 * NoMatchingStaticPathFound。（2026-08-19 實際踩到）
 */
export function slugFromLegacy(legacyPath: string, prefix: string): string {
  let p = legacyPath;
  try { p = decodeURIComponent(p); } catch { /* 已是解碼狀態 */ }
  return p.replace(new RegExp(`^${prefix}`), '').replace(/\/$/, '');
}
