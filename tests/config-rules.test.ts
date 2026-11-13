import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { domainEntries, generateConfigRules, repairMusicYaml, scopedEntries, validatePolicy } from '../scripts/config-rules.ts';

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

test('derived outputs are repeatable, preserve raw inputs and stay published when a source hash fails', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'magicrule-derived-'));
  try {
    const catalog = { rules: [] as unknown[] };
    const originals: [string, string][] = [];
    for (const [client, name, key, extension, text] of [
      ['Mihomo', 'GlobalAI', 'classical', 'yaml', 'payload: ["DOMAIN-SUFFIX,openai.com", "DOMAIN-SUFFIX,deepseek.com", "DOMAIN,storage.googleapis.com"]\n'],
      ['Egern', 'GlobalAI', 'rules', 'yaml', 'domain_suffix_set: [openai.com, deepseek.com]\ndomain_set: [storage.googleapis.com]\n'],
      ['Loon', 'GlobalAI', 'rules', 'list', '# AUTHOR: MagicRule\nDOMAIN-SUFFIX,openai.com\nDOMAIN-SUFFIX,deepseek.com\nDOMAIN,storage.googleapis.com\nIP-ASN,14061,no-resolve\nDOMAIN-KEYWORD,sentry\n'],
      ['Surge', 'GlobalAI', 'rules', 'list', '# AUTHOR: MagicRule Surge\n# REPO: https://magicrule.pages.dev\n# UPDATED: 2026-11-12\nDOMAIN-SUFFIX,openai.com\nDOMAIN-SUFFIX,deepseek.com\nDOMAIN,storage.googleapis.com\nIP-ASN,14061,no-resolve\nPROCESS-NAME,Codex.exe\nDOMAIN-KEYWORD,sentry\nURL-REGEX,^https://example.com\n'],
      ['Egern', 'NetEaseMusic', 'rules', 'yaml', 'domain_suffix_set: [music.163.com]\nuser_agent_set:\n - %E7\n'],
    ]) {
      const file = `current/rules/${client}/${key}/${name}.${extension}`;
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), text);
      originals.push([file, text]);
      catalog.rules.push({ variants: [{ client, name, archived: false, artifacts: [{ key, extension, path: file, url: 'https://example.com/' + file, sha256: createHash('sha256').update(text).digest('hex') }] }] });
    }
    await writeFile(path.join(root, 'current/catalog.json'), JSON.stringify(catalog));
    const first = await generateConfigRules(root);
    assert.equal(first.files.length, 10);
    assert.deepEqual(await generateConfigRules(root), first);
    for (const [file, text] of originals) assert.equal(await readFile(path.join(root, file), 'utf8'), text);
    const foreign = await readFile(path.join(root, 'current/custom/Loon/ForeignAI.list'), 'utf8');
    const domestic = await readFile(path.join(root, 'current/custom/Loon/DomesticAI.list'), 'utf8');
    assert.ok(foreign.includes('# AUTHOR: MagicRule\n'));
    assert.ok(foreign.includes('DOMAIN-SUFFIX,openai.com\n'));
    assert.ok(!/deepseek|storage.googleapis.com|IP-ASN|DOMAIN-KEYWORD|payload:/.test(foreign));
    assert.ok(domestic.includes('DOMAIN-SUFFIX,deepseek.com\n'));
    assert.ok(!domestic.includes('openai.com'));
    assert.deepEqual(domainEntries(foreign, 'Loon'), domainEntries(await readFile(path.join(root, 'current/custom/Mihomo/ForeignAI.yaml'), 'utf8'), 'Mihomo'));
    const surgeForeignPath = path.join(root, 'current/custom/Surge/ForeignAI.list');
    const surgeForeign = await readFile(surgeForeignPath, 'utf8');
    const surgeDomestic = await readFile(path.join(root, 'current/custom/Surge/DomesticAI.list'), 'utf8');
    assert.ok(surgeForeign.includes('# AUTHOR: MagicRule Surge\n# REPO: https://magicrule.pages.dev\n# UPDATED: 2026-11-12\n'));
    assert.ok(surgeForeign.includes('# SOURCE: https://example.com/current/rules/Surge/rules/GlobalAI.list\n'));
    assert.ok(surgeForeign.includes('# SOURCE-SHA256: ' + first.sources['Surge/GlobalAI'].sha256 + '\n'));
    assert.deepEqual(domainEntries(surgeForeign, 'Surge'), domainEntries(foreign, 'Loon'));
    assert.deepEqual(domainEntries(surgeDomestic, 'Surge'), domainEntries(domestic, 'Loon'));
    assert.ok(!/deepseek|storage.googleapis.com|^IP-ASN,|^PROCESS-NAME,|^DOMAIN-KEYWORD,|^URL-REGEX,|payload:/m.test(surgeForeign));
    const surgeSource = originals[3];
    const surgeUpdated = surgeSource[1] + 'DOMAIN,surge-only.openai.com\n';
    await writeFile(path.join(root, surgeSource[0]), surgeUpdated);
    const surgeVariants = catalog.rules[3] as { variants: { artifacts: { sha256: string }[] }[] };
    surgeVariants.variants[0].artifacts[0].sha256 = createHash('sha256').update(surgeUpdated).digest('hex');
    await writeFile(path.join(root, 'current/catalog.json'), JSON.stringify(catalog));
    await generateConfigRules(root);
    const updatedSurgeForeign = await readFile(surgeForeignPath, 'utf8');
    assert.ok(updatedSurgeForeign.includes('DOMAIN,surge-only.openai.com\n'));
    assert.ok(!(await readFile(path.join(root, 'current/custom/Loon/ForeignAI.list'), 'utf8')).includes('surge-only.openai.com'));
    // A fresh upstream domain in an existing service scope is included on the next generation.
    const updated = originals[2][1] + 'DOMAIN,new-api.openai.com\n';
    await writeFile(path.join(root, originals[2][0]), updated);
    const variants = catalog.rules[2] as { variants: { artifacts: { sha256: string }[] }[] };
    variants.variants[0].artifacts[0].sha256 = createHash('sha256').update(updated).digest('hex');
    await writeFile(path.join(root, 'current/catalog.json'), JSON.stringify(catalog));
    await generateConfigRules(root);
    const publishedForeign = await readFile(path.join(root, 'current/custom/Loon/ForeignAI.list'), 'utf8');
    assert.ok(publishedForeign.includes('DOMAIN,new-api.openai.com\n'));
    const published = await readFile(path.join(root, 'current/custom/manifest.json'), 'utf8');
    await writeFile(path.join(root, surgeSource[0]), 'tampered');
    await assert.rejects(generateConfigRules(root), /Source hash mismatch/);
    assert.equal(await readFile(path.join(root, 'current/custom/manifest.json'), 'utf8'), published);
    assert.equal(await readFile(path.join(root, 'current/custom/Loon/ForeignAI.list'), 'utf8'), publishedForeign);
    assert.equal(await readFile(surgeForeignPath, 'utf8'), updatedSurgeForeign);
  } finally { await rm(root, { recursive: true, force: true }); }
});
