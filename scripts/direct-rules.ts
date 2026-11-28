import { execFileSync } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { isIPv4 } from 'node:net';
import path from 'node:path';
import YAML from 'yaml';
import {
  addWebRTC, clients, directSourceGroups, domainEntries, extensionFor, render, scopedEntries, sha256,
  validDomain, validatePolicy, writeConfigRules, type ConfigPolicy, type CustomManifest,
  type DirectManifest, type DirectSource, type DirectSourceId, type DomainEntry, type RuleFiles,
} from './config-rules.ts';

type Input = DirectSource & { bytes: Buffer };
type Compatibility = { include: string[]; omit: string[] };
interface DirectPolicy extends ConfigPolicy {
  compatibility: { foreignAI: Compatibility; domesticAI: Compatibility; music: string[] };
}
const manifestUrl = 'https://raw.githubusercontent.com/ClaraCora/magicrule-backup/refs/heads/data/current/custom/manifest.json';
const ruleKey = ({ type, value }: { type: string; value: string }) => type + ',' + value;

interface TaggedDomain extends DomainEntry { tags: Set<string> }

export function readV2flyCategories(read: (file: string) => string) {
  const pending = new Set<string>();
  const parsed = new Map<string, TaggedDomain[]>();
  function expand(file: string): TaggedDomain[] {
    if (!/^[a-z0-9_-][a-z0-9_.!-]*$/.test(file) || pending.has(file) || parsed.size + pending.size >= 100) {
      throw new Error('Invalid, recursive or excessive v2fly includes: ' + file);
    }
    const cached = parsed.get(file);
    if (cached) return cached;
    pending.add(file);
    const result: TaggedDomain[] = [];
    for (const line of read(file).split(/\r?\n/)) {
      const [entry, ...attributes] = line.split('#', 1)[0].trim().split(/\s+/);
      if (!entry) continue;
      if (attributes.some(tag => !/^@-?[\w!-]+$/.test(tag))) throw new Error('Invalid v2fly attribute: ' + line);
      if (entry.startsWith('include:')) {
        for (const rule of expand(entry.slice('include:'.length))) {
          if (attributes.every(tag => tag.startsWith('@-') ? !rule.tags.has(tag.slice(2)) : rule.tags.has(tag.slice(1)))) result.push(rule);
        }
      } else if (!/^(keyword|regexp):/.test(entry)) {
        const value = entry.replace(/^(full|domain):/, '');
        if (!validDomain(value)) throw new Error('Invalid v2fly domain: ' + entry);
        result.push({ type: entry.startsWith('full:') ? 'DOMAIN' : 'DOMAIN-SUFFIX', value, tags: new Set(attributes.map(tag => tag.slice(1))) });
      }
      if (result.length > 10_000) throw new Error('Excessive v2fly entries: ' + file);
    }
    pending.delete(file);
    parsed.set(file, result);
    return result;
  }
  return { foreignAI: expand('category-ai-!cn'), domesticAI: expand('category-ai-cn') };
}

function parseMusic(content: string) {
  const entries: { type: keyof typeof musicKeys; value: string }[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [type, value, ...options] = line.split(',').map(part => part.trim());
    if (!value || !Object.hasOwn(musicKeys, type)) throw new Error('Unsupported NetEaseMusic rule: ' + line);
    const valid = options.length === 0 || (type === 'IP-CIDR' && options.length === 1 && options[0] === 'no-resolve');
    const parts = /^([^/]+)\/(\d{1,2})$/.exec(value);
    if (!valid || (type === 'IP-CIDR' && !(parts && isIPv4(parts[1]) && Number(parts[2]) <= 32)) ||
        (type.startsWith('DOMAIN') && !validDomain(value)) ||
        (type === 'USER-AGENT' && /[\x00-\x1f\x7f]/.test(value))) {
      throw new Error('Invalid NetEaseMusic rule: ' + line);
    }
    entries.push({ type: type as keyof typeof musicKeys, value });
  }
  return entries;
}

const musicKeys = {
  DOMAIN: 'domain_set',
  'DOMAIN-SUFFIX': 'domain_suffix_set',
  'IP-CIDR': 'ip_cidr_set',
  'USER-AGENT': 'user_agent_set',
};

export async function generateDirectRules(
  inputs: Map<DirectSourceId, Input>, staging: string, syncedAt: string, previous?: CustomManifest,
) {
  const policyText = await readFile(new URL('../config-rules/policy.json', import.meta.url), 'utf8');
  const policy: DirectPolicy = JSON.parse(policyText);
  validatePolicy(policy);
  const sources = {} as DirectManifest['sources'];
  function source(id: DirectSourceId) {
    const { bytes, ...meta } = inputs.get(id)!;
    sources[id] = { ...meta, bytes: bytes.length, sha256: sha256(bytes) };
    return bytes;
  }
  function header(group: keyof typeof directSourceGroups, name: string, derived: string) {
    return [
      '# NAME: ' + name, ...directSourceGroups[group].map(id => '# SOURCE: ' + sources[id].repo + ' (' + sources[id].license + ')'),
      '# DERIVED: ' + derived, '# INPUT-CHECKSUMS: ' + manifestUrl, '', '',
    ].join('\n');
  }

  const commonAI = (['vpsdance-ai', 'sukka-ai'] as const).flatMap(id => {
    const entries = domainEntries(source(id).toString('utf8'), 'Surge');
    if (entries.length < (id === 'vpsdance-ai' ? 200 : 25)) throw new Error('Incomplete source: ' + id);
    return entries;
  });
  const archive = path.join(staging, 'v2fly.tar.gz');
  await writeFile(archive, source('v2fly-ai'));
  const v2 = readV2flyCategories(file => execFileSync('tar', ['-xOf', archive, 'domain-list-community-master/data/' + file], {
    encoding: 'utf8', timeout: 10_000, maxBuffer: 256 * 1024,
  }));
  await rm(archive);
  if (v2.foreignAI.length < 200 || v2.domesticAI.length < 75) throw new Error('Incomplete v2fly AI categories');
  const files: RuleFiles = new Map();
  const ai = (['foreignAI', 'domesticAI'] as const).map(scope => {
    const { include, omit } = policy.compatibility[scope];
    const selected = scopedEntries([...commonAI, ...v2[scope], ...domainEntriesOrEmpty(include)], policy[scope]);
    const excluded = new Set(omit);
    const entries = selected.filter(rule => !excluded.has(ruleKey(rule)));
    if (entries.length < (scope === 'foreignAI' ? 200 : 35)) throw new Error('Incomplete AI rules: ' + scope);
    const typeCounts: Record<string, number> = {};
    for (const { type } of entries) typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    return { name: scope === 'foreignAI' ? 'ForeignAI' : 'DomesticAI', entries, typeCounts };
  });
  for (const client of clients) {
    for (const { name, entries, typeCounts } of ai) {
      files.set(client + '/' + name + '.' + extensionFor(client), {
        text: header('ai', name, 'Scoped service domains, with local compatibility rules.') + render(entries, client),
        typeCounts,
      });
    }
  }

  const musicEntries = directSourceGroups.music.flatMap(id => {
    const entries = parseMusic(source(id).toString('utf8'));
    if (entries.length < (id === 'sukka-music' ? 4 : 20)) throw new Error('Incomplete source: ' + id);
    return entries;
  });
  musicEntries.push(...parseMusic(policy.compatibility.music.join('\n')));
  const music: Record<string, boolean | string[]> = { no_resolve: true };
  const musicCounts: Record<string, number> = {};
  for (const [type, key] of Object.entries(musicKeys)) {
    const values = [...new Set(musicEntries.filter(rule => rule.type === type).map(rule => rule.value))].sort();
    if (!values.length) throw new Error('Missing NetEaseMusic rules of type ' + type);
    music[key] = values;
    musicCounts[type] = values.length;
  }
  files.set('Egern/NetEaseMusic.yaml', {
    text: header('music', 'NetEaseMusic', 'Merged into Egern YAML with local compatibility rules.')
      + '# COMPATIBILITY: Legacy matches from MagicRule and https://github.com/LM-Firefly/Rules\n'
      + YAML.stringify(music, { defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' }),
    typeCounts: musicCounts,
  });
  addWebRTC(files, policy);
  return writeConfigRules(path.join(staging, 'custom'), {
    schemaVersion: 2, syncedAt, sources, policySha256: sha256(policyText),
  }, files, previous);
}

function domainEntriesOrEmpty(lines: string[]) {
  return lines.length ? domainEntries(lines.join('\n'), 'Surge') : [];
}
