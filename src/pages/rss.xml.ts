import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

/* 舊站的 RSS 在 /feed/。GitHub Pages 沒辦法讓一個目錄路徑回 XML content-type，
 * 所以新站的正本在 /rss.xml，/feed/ 由 redirects.json 轉過來。 */
export async function GET(context: APIContext) {
  const posts = (await getCollection('blog'))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .slice(0, 50);

  return rss({
    title: 'GCM 上醫預防醫學發展協會',
    description: '預防醫學、節氣養生與健康促進。',
    site: context.site!,
    items: posts.map(post => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: post.data.legacyPath,
    })),
    customData: '<language>zh-TW</language>',
  });
}
