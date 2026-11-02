import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { domainEntries, generateConfigRules, repairMusicYaml, scopedEntries, validatePolicy } from '../scripts/config-rules.ts';

test('AI scoping excludes shared domains, lookalikes, cloud ASNs and process rules in both client formats', () => {
  const scope = { domains: ['copilot-proxy.githubusercontent.com'], suffixes: ['openai.com', 'githubcopilot.com'] };
  const mihomo = domainEntries(YAML.stringify({ payload: ['DOMAIN-SUFFIX,openai.com', 'DOMAIN,api.openai.com', 'DOMAIN-SUFFIX,notopenai.com', 'DOMAIN,storage.googleapis.com', 'DOMAIN,api.github.com', 'DOMAIN-SUFFIX,githubcopilot.com', 'DOMAIN,copilot-proxy.githubusercontent.com', 'IP-ASN,14061', 'PROCESS-NAME,Codex.exe', 'DOMAIN-KEYWORD,codex'] }), 'Mihomo');
  const egern = domainEntries(YAML.stringify({ domain_set: ['api.openai.com', 'storage.googleapis.com', 'api.github.com', 'copilot-proxy.githubusercontent.com'], domain_suffix_set: ['openai.com', 'notopenai.com', 'githubcopilot.com'], asn_set: [14061] }), 'Egern');
  const selected = scopedEntries(mihomo, scope);
  assert.deepEqual(selected, scopedEntries(egern, scope));
  assert.equal(selected.length, 4);
  assert.ok(!selected.some(e => /storage|api.github.com|notopenai/.test(e.value)));
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

test('derived outputs are repeatable, preserve raw inputs and stay published when a source hash fails', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'magicrule-derived-'));
  try {
    const catalog = { rules: [] as unknown[] };
    const originals: [string, string][] = [];
    for (const [client, name, key, text] of [
      ['Mihomo', 'GlobalAI', 'classical', 'payload: ["DOMAIN-SUFFIX,openai.com", "DOMAIN-SUFFIX,deepseek.com", "DOMAIN,storage.googleapis.com"]\n'],
      ['Egern', 'GlobalAI', 'rules', 'domain_suffix_set: [openai.com, deepseek.com]\ndomain_set: [storage.googleapis.com]\n'],
      ['Egern', 'NetEaseMusic', 'rules', 'domain_suffix_set: [music.163.com]\nuser_agent_set:\n - %E7\n'],
    ]) {
      const file = `current/rules/${client}/${key}/${name}.yaml`;
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), text);
      originals.push([file, text]);
      catalog.rules.push({ variants: [{ client, name, archived: false, artifacts: [{ key, extension: 'yaml', path: file, url: 'https://example.com/' + file, sha256: createHash('sha256').update(text).digest('hex') }] }] });
    }
    await writeFile(path.join(root, 'current/catalog.json'), JSON.stringify(catalog));
    const first = await generateConfigRules(root);
    assert.equal(first.files.length, 6);
    assert.deepEqual(await generateConfigRules(root), first);
    for (const [file, text] of originals) assert.equal(await readFile(path.join(root, file), 'utf8'), text);
    const published = await readFile(path.join(root, 'current/custom/manifest.json'), 'utf8');
    await writeFile(path.join(root, originals[2][0]), 'tampered');
    await assert.rejects(generateConfigRules(root), /Source hash mismatch/);
    assert.equal(await readFile(path.join(root, 'current/custom/manifest.json'), 'utf8'), published);
  } finally { await rm(root, { recursive: true, force: true }); }
});
