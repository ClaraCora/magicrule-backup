import test from 'node:test';
import assert from 'node:assert/strict';
import { searchRules } from '../src/lib/search.ts';
import type { Filters, SearchRule } from '../src/lib/search.ts';

const filters: Filters = { query: '', client: '', type: '', sort: 'updated', archived: false };
const rules: SearchRule[] = [
  { id: 'a', name: 'Example', chineseName: '示例', variants: [
    { client: 'Loon', description: '视频应用', types: ['DOMAIN'], totalLineCount: 5, sourceUpdatedAt: '2026-01-01T00:00:00Z', fileChangedAt: '2026-11-01T00:00:00Z', providers: ['https://example.com/author'], archived: false },
    { client: 'Mihomo', description: '', types: ['IP-CIDR'], totalLineCount: 2, sourceUpdatedAt: '2026-02-01T00:00:00Z', fileChangedAt: '2026-11-01T00:00:00Z', providers: [], archived: false },
  ] },
  { id: 'b', name: 'Old', chineseName: '旧规则', variants: [{ client: 'Loon', description: '', types: ['DOMAIN'], totalLineCount: 1, sourceUpdatedAt: null, fileChangedAt: null, providers: [], archived: true }] },
];
test('search handles Chinese, descriptions, sources, clients, same-variant types and delisting', () => {
  for (const query of ['示例', 'EXAMPLE', '视频', 'author']) assert.equal(searchRules(rules, { ...filters, query }).length, 1);
  assert.equal(searchRules(rules, { ...filters, client: 'Loon', type: 'IP-CIDR' }).length, 0);
  assert.equal(searchRules(rules, { ...filters, client: 'Mihomo', type: 'IP-CIDR' }).length, 1);
  assert.equal(searchRules(rules, { ...filters, query: '不存在' }).length, 0);
  assert.equal(searchRules(rules, filters).length, 1);
  assert.equal(searchRules(rules, { ...filters, archived: true }).length, 2);
  assert.equal(searchRules(rules, { ...filters, archived: true })[1].id, 'b');
});
