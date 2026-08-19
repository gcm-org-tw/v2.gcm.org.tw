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

/* 醫友健賞團商品。brand 以下這幾欄在舊站是 JetEngine 自訂欄位、WP REST 撈不到，
 * 由 scripts/wp-wom.mjs 從前台抓回來（見 scripts/wp-convert.mjs 的健賞段落）。
 * 心得則量太大，另存 src/data/wom-reviews.json，不進 frontmatter。
 * 全部 optional——「心得募集中」的商品還沒有分數與參與人數，那不是缺漏。 */
const wom = defineCollection({
  loader: glob({ base: './src/content/wom', pattern: '**/*.md' }),
  schema: z.object({
    ...legacyBase,
    gcm_supplier_category: z.array(z.string()).default([]),
    brand: z.string().optional(),
    brandUrl: z.string().optional(),
    campaignStatus: z.string().optional(),
    score: z.number().optional(),
    participants: z.number().optional(),
    period: z.string().optional(),
    cycle: z.string().optional(),
    announceMonth: z.string().optional(),
    spec: z.string().optional(),
    condition: z.string().optional(),
  }),
});

const activities = defineCollection({
  loader: glob({ base: './src/content/activities', pattern: '**/*.md' }),
  schema: z.object(legacyBase),
});

/* WordPress page 型：內容型逐字轉錄；動態型（dynamic: true）之後接 Cloudflare 動態層。 */
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    legacyId: z.number(),
    legacyPath: z.string(),
    dynamic: z.boolean().default(false),
    sourceVerbatim: z.boolean().default(false),
  }),
});

/* GCM 潔淨標章認證（舊站 CPT gcm-clean-label，網址 /gcm-clean-label/<slug>/） */
const cleanLabel = defineCollection({
  loader: glob({ base: './src/content/clean-label', pattern: '**/*.md' }),
  schema: z.object(legacyBase),
});

const podcast = defineCollection({
  loader: glob({ base: './src/content/podcast', pattern: '**/*.md' }),
  schema: z.object(legacyBase),
});

export const collections = { blog, wom, activities, podcast, pages, cleanLabel };
