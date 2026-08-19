import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/* 舊站（WordPress）內容逐字轉錄而來，schema 對齊 scripts/wp-convert.mjs 產出的 frontmatter。
 * legacyPath 是網址保留契約的錨——路由一律以它為準，不另行造 slug。 */
const legacyBase = {
  title: z.string(),
  description: z.string().optional(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  heroImage: z.string().optional(),
  heroImageAlt: z.string().optional(),
  legacyId: z.number(),
  legacyPath: z.string(),
  sourceVerbatim: z.boolean().default(false),
};

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    ...legacyBase,
    blog_cate: z.array(z.string()).default([]),
    blog_tag: z.array(z.string()).default([]),
    blog_tag_keyword: z.array(z.string()).default([]),
    blog_tag_theme: z.array(z.string()).default([]),
    blog_fr_doctors: z.array(z.string()).default([]),
  }),
});

const wom = defineCollection({
  loader: glob({ base: './src/content/wom', pattern: '**/*.md' }),
  schema: z.object({
    ...legacyBase,
    gcm_supplier_category: z.array(z.string()).default([]),
  }),
});

const activities = defineCollection({
  loader: glob({ base: './src/content/activities', pattern: '**/*.md' }),
  schema: z.object(legacyBase),
});

const podcast = defineCollection({
  loader: glob({ base: './src/content/podcast', pattern: '**/*.md' }),
  schema: z.object(legacyBase),
});

export const collections = { blog, wom, activities, podcast };
