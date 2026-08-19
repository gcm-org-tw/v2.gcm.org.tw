import { ASSET_BASE, ASSET_PREFIXES } from '../../site.config.mjs';

/* 把內容裡的舊站圖片路徑接上 ASSET_BASE。
 * 內容一律保留 `/wp-content/uploads/…` 原樣（那是舊站的網址），這裡只負責決定它指到哪；
 * ASSET_BASE 設成空字串就完全還原成舊站網址。 */
export function assetUrl(path) {
  if (!path || !ASSET_BASE) return path;
  if (!ASSET_PREFIXES.some(p => path.startsWith(p))) return path;
  return ASSET_BASE + path;
}

/* Markdown 裡原樣保留的 HTML（turndown 的 keep 清單：figure/iframe/table/audio/video）
 * 在 hast 裡是 `raw` 節點，不會被 element 走訪到——2026-08-19 首次切 R2 時漏了 89 條。
 * 這裡對 raw 字串做前綴替換，且只在前面是引號／空白／逗號／括號時才換，
 * 這樣已經改寫過的網址（…r2.dev/wp-content/uploads/…）不會被二次加前綴。 */
function rewriteRaw(value) {
  let out = value;
  for (const prefix of ASSET_PREFIXES) {
    out = out.replace(
      new RegExp(`(["'\\s,(])${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
      `$1${ASSET_BASE}${prefix}`
    );
  }
  return out;
}

/** rehype 外掛：改寫 Markdown 渲染出來的 img/source/a/video/audio 的資產路徑 */
export function rehypeAssetBase() {
  return async tree => {
    if (!ASSET_BASE) return;
    const { visit } = await import('unist-util-visit');
    visit(tree, 'raw', node => {
      if (typeof node.value === 'string') node.value = rewriteRaw(node.value);
    });
    visit(tree, 'element', node => {
      for (const attr of ['src', 'href', 'poster']) {
        const v = node.properties?.[attr];
        if (typeof v === 'string') node.properties[attr] = assetUrl(v);
      }
      const srcset = node.properties?.srcSet ?? node.properties?.srcset;
      if (typeof srcset === 'string') {
        const out = srcset.split(',').map(part => {
          const [u, ...rest] = part.trim().split(/\s+/);
          return [assetUrl(u), ...rest].join(' ');
        }).join(', ');
        if (node.properties.srcSet !== undefined) node.properties.srcSet = out;
        else node.properties.srcset = out;
      }
    });
  };
}
