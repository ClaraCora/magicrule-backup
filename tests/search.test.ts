import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactChoices, defaultArtifact, searchRules } from '../src/lib/search.ts';
import type { Filters, SearchRule } from '../src/lib/search.ts';

const filters: Filters = { query: '', client: '', type: '', sort: 'updated', archived: false };
const rules: SearchRule[] = [
  { id: 'a', name: 'Example', chineseName: '示例', variants: [
    { client: 'Loon', description: '视频应用', types: ['DOMAIN'], totalLineCount: 5, sourceUpdatedAt: '2026-01-01T00:00:00Z', fileChangedAt: '2026-11-01T00:00:00Z', providers: ['https://example.com/author'], archived: false, artifacts: [{ key: 'rules', extension: 'list', fileName: 'Example.list', url: 'https://example.com/Loon/rules/Example.list' }] },
    { client: 'Mihomo', description: '', types: ['IP-CIDR'], totalLineCount: 2, sourceUpdatedAt: '2026-02-01T00:00:00Z', fileChangedAt: '2026-11-01T00:00:00Z', providers: [], archived: false, artifacts: [{ key: 'classical', extension: 'yaml', fileName: 'Example.yaml', url: 'https://example.com/Mihomo/classical/Example.yaml' }, { key: 'ipcidr-mrs', extension: 'mrs', fileName: 'Example.mrs', url: 'https://example.com/Mihomo/ipcidr-mrs/Example.mrs' }] },
  ] },
  { id: 'b', name: 'Old', chineseName: '旧规则', variants: [{ client: 'Loon', description: '', types: ['DOMAIN'], totalLineCount: 1, sourceUpdatedAt: null, fileChangedAt: null, providers: [], archived: true, artifacts: [{ key: 'rules', extension: 'list', fileName: 'Old.list', url: 'https://example.com/Loon/rules/Old.list' }] }] },
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
test('format filtering and quick copy identify one artifact in the same client and type', () => {
  assert.equal(searchRules(rules, { ...filters, client: 'Loon', format: 'mrs' }).length, 0);
  assert.equal(searchRules(rules, { ...filters, type: 'DOMAIN', format: 'mrs' }).length, 0);
  assert.equal(searchRules(rules, { ...filters, client: 'Mihomo', type: 'IP-CIDR', format: 'mrs' }).length, 1);
  const choices = artifactChoices(rules[0], filters);
  assert.equal(defaultArtifact(choices)?.artifact.url, 'https://example.com/Mihomo/classical/Example.yaml');
  const mrs = defaultArtifact(artifactChoices(rules[0], { ...filters, format: 'mrs' }));
  assert.equal(mrs?.variant.client, 'Mihomo'); assert.equal(mrs?.artifact.fileName, 'Example.mrs');
  assert.equal(mrs?.artifact.url, 'https://example.com/Mihomo/ipcidr-mrs/Example.mrs');
  assert.equal(defaultArtifact(artifactChoices(rules[0], { ...filters, client: 'Loon' }))?.artifact.fileName, 'Example.list');
  assert.equal(artifactChoices(rules[1], filters).length, 0);
  assert.equal(defaultArtifact(artifactChoices(rules[1], { ...filters, archived: true }))?.variant.archived, true);
});
