import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import { domainEntries, repairMusicYaml, scopedEntries, validatePolicy } from '../scripts/config-rules.ts';

test('AI scoping excludes shared domains, lookalikes, cloud ASNs and process rules in all four clients', () => {
  const scope = { domains: ['copilot-proxy.githubusercontent.com'], suffixes: ['openai.com', 'githubcopilot.com'] };
  const mihomo = domainEntries(YAML.stringify({ payload: ['DOMAIN-SUFFIX,openai.com', 'DOMAIN,api.openai.com', 'DOMAIN-SUFFIX,notopenai.com', 'DOMAIN,storage.googleapis.com', 'DOMAIN,api.github.com', 'DOMAIN-SUFFIX,githubcopilot.com', 'DOMAIN,copilot-proxy.githubusercontent.com', 'IP-ASN,14061', 'PROCESS-NAME,Codex.exe', 'DOMAIN-KEYWORD,codex'] }), 'Mihomo');
  const egern = domainEntries(YAML.stringify({ domain_set: ['api.openai.com', 'storage.googleapis.com', 'api.github.com', 'copilot-proxy.githubusercontent.com'], domain_suffix_set: ['openai.com', 'notopenai.com', 'githubcopilot.com'], asn_set: [14061] }), 'Egern');
  const loon = domainEntries('# AUTHOR: source\r\nDOMAIN-SUFFIX,openai.com\r\nDOMAIN,api.openai.com\r\nDOMAIN-SUFFIX,notopenai.com\r\nDOMAIN,storage.googleapis.com\r\nDOMAIN,api.github.com\r\nDOMAIN-SUFFIX,githubcopilot.com\r\nDOMAIN,copilot-proxy.githubusercontent.com\r\nIP-ASN,14061,no-resolve\r\nPROCESS-NAME,Codex.exe\r\nDOMAIN-KEYWORD,codex\r\n', 'Loon');
  const selected = scopedEntries(mihomo, scope);
  assert.deepEqual(selected, scopedEntries(egern, scope));
  assert.deepEqual(selected, scopedEntries(loon, scope));
  const surge = domainEntries('# AUTHOR: source\n// Surge comment\n; Surge comment\n' + loon.map(e => `${e.type},${e.value}`).join('\n') + '\nIP-ASN,14061,no-resolve\nPROCESS-NAME,Codex.exe\nDOMAIN-KEYWORD,codex\nURL-REGEX,^https://example.com\n', 'Surge');
  assert.deepEqual(selected, scopedEntries(surge, scope));
  assert.equal(selected.length, 4);
  assert.ok(!selected.some(e => /storage|api.github.com|notopenai/.test(e.value)));
});

test('Loon and Surge parsing reject YAML, empty sources, invalid domains and embedded policies', () => {
  for (const client of ['Loon', 'Surge'] as const) {
    for (const text of ['payload: ["DOMAIN-SUFFIX,openai.com"]', '# no domains\nIP-ASN,14061,no-resolve\n', 'DOMAIN\n', 'DOMAIN-SUFFIX,\n', 'DOMAIN,https://openai.com\n', 'DOMAIN-SUFFIX,openai.com,AI\n']) {
      assert.throws(() => domainEntries(text, client), /Invalid/);
    }
  }
});

test('music quoting repair preserves every rule value and fails on unrelated malformed YAML', () => {
  const text = '# AUTHOR: original\nno_resolve: true\ndomain_suffix_set:\n  - music.163.com\nuser_agent_set:\n  - %E7%BD%91\n  - "%E7*"\n';
  const fixed = repairMusicYaml(text);
  assert.deepEqual(YAML.parse(fixed).user_agent_set, ['%E7%BD%91', '%E7*']);
  assert.ok(fixed.startsWith('# AUTHOR: original'));
  assert.equal(repairMusicYaml(fixed), fixed);
  assert.throws(() => repairMusicYaml('domain_suffix_set: [broken\nuser_agent_set: []'));
});

test('policy rejects shared infrastructure and overlapping domestic/foreign AI scope', () => {
  const base = { foreignAI: { domains: [], suffixes: ['openai.com'] }, domesticAI: { domains: [], suffixes: ['deepseek.com'] }, webRTC: ['stun.example.com'] };
  validatePolicy(base);
  assert.throws(() => validatePolicy({ ...base, foreignAI: { domains: [], suffixes: ['google.com'] } }));
  assert.throws(() => validatePolicy({ ...base, foreignAI: { domains: [], suffixes: ['deepseek.com'] } }));
});
