import type { Catalog, Rule } from './types';

export type SearchRule = Pick<Rule, 'id' | 'name' | 'chineseName'> & {
  variants: Pick<Rule['variants'][number], 'client' | 'description' | 'types' | 'totalLineCount' | 'sourceUpdatedAt' | 'fileChangedAt' | 'providers' | 'archived'>[];
};
export interface Filters { query: string; client: string; type: string; sort: string; archived: boolean }
export function searchIndex(catalog: Catalog): SearchRule[] {
  return catalog.rules.map(rule => ({
    id: rule.id, name: rule.name, chineseName: rule.chineseName,
    variants: rule.variants.map(v => ({ client: v.client, description: v.description, types: v.types, totalLineCount: v.totalLineCount, sourceUpdatedAt: v.sourceUpdatedAt, fileChangedAt: v.fileChangedAt, providers: v.providers, archived: v.archived })),
  }));
}
export const matchingVariants = (rule: SearchRule, filters: Pick<Filters, 'client' | 'type' | 'archived'>) => rule.variants.filter(v => (!filters.client || v.client === filters.client) && (!filters.type || v.types.includes(filters.type)) && (filters.archived || !v.archived));
export const latestDate = (values: (string | null)[]) => values.filter((v): v is string => Boolean(v)).sort().at(-1) || null;
export function searchRules(rules: SearchRule[], filters: Filters): SearchRule[] {
  const terms = filters.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const selected = rules.filter(rule => {
    const variants = matchingVariants(rule, filters);
    if (!variants.length) return false;
    const text = [rule.name, rule.chineseName, ...variants.flatMap(v => [v.description, ...v.providers])].join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
  const dateFor = (rule: SearchRule) => latestDate(matchingVariants(rule, filters).map(v => filters.sort === 'backup' ? v.fileChangedAt : v.sourceUpdatedAt)) || '';
  return selected.sort((a, b) => filters.sort === 'name' ? a.name.localeCompare(b.name, 'en', { numeric: true }) : dateFor(b).localeCompare(dateFor(a)) || a.name.localeCompare(b.name, 'en', { numeric: true }));
}
