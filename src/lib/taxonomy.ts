/* 分類法名稱表：由 scripts/wp-convert.mjs 從舊站 taxonomy 匯出成 src/data/taxonomy.json。
 * 查不到名稱時退回 slug，寧可顯示 slug 也不要讓建置炸掉（1,300+ 頁批次產生，容錯優先）。 */
import taxonomy from '../data/taxonomy.json';

type Term = { name: string; description?: string; count?: number; link?: string };
type Taxonomy = Record<string, Record<string, Term>>;

const tax = taxonomy as Taxonomy;

export function term(taxName: string, slug: string): Term | undefined {
  return tax[taxName]?.[slug];
}

export function label(taxName: string, slug: string): string {
  return tax[taxName]?.[slug]?.name || slug;
}

export const cateLabel = (slug: string) => label('blog-cate', slug);

export function allTerms(taxName: string): { slug: string; term: Term }[] {
  return Object.entries(tax[taxName] ?? {}).map(([slug, term]) => ({ slug, term }));
}
