import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

export interface DomainScope { domains: string[]; suffixes: string[] }
export interface ConfigPolicy { foreignAI: DomainScope; domesticAI: DomainScope; webRTC: string[] }
export type DomainEntry = { type: 'DOMAIN' | 'DOMAIN-SUFFIX'; value: string };
export const clients = ['Mihomo', 'Egern', 'Loon', 'Surge'] as const;
type AIClient = (typeof clients)[number];
export const extensionFor = (client: AIClient) => client === 'Loon' || client === 'Surge' ? 'list' : 'yaml';
export const sourceRules = [
  ...clients.map(client => ({ client, name: 'GlobalAI', key: client === 'Mihomo' ? 'classical' : 'rules', extension: extensionFor(client) })),
  { client: 'Egern', name: 'NetEaseMusic', key: 'rules', extension: 'yaml' },
];
const webRTCSource = 'https://raw.githubusercontent.com/ClaraCora/ege/main/mihomo/WebRTC.list';
export const customFiles = [
  ...clients.flatMap(client => ['ForeignAI', 'DomesticAI'].map(name => client + '/' + name + '.' + extensionFor(client))),
  'Egern/NetEaseMusic.yaml', 'Mihomo/WebRTC.list',
];
export interface RuleSource {
  bytes: Buffer;
  url: string;
  manifestUrl: string;
  updatedAt: string | null;
  verification: 'bytes' | 'normalized-header';
}
export interface CustomFile {
  file: string;
  sha256: string;
  bytes: number;
  changedAt: string;
  typeCounts: Record<string, number>;
}
export const directSourceGroups = {
  ai: ['vpsdance-ai', 'v2fly-ai', 'sukka-ai'],
  music: ['acl4ssr-music', 'mazetsz-music', 'sukka-music'],
} as const;
export type DirectSourceId = (typeof directSourceGroups)[keyof typeof directSourceGroups][number];
export interface DirectSource { url: string; repo: string; license: string }
export type DirectSources = Record<DirectSourceId, DirectSource>;

interface ManifestBase {
  syncedAt: string;
  policySha256: string;
  files: CustomFile[];
}
export interface LegacyManifest extends ManifestBase {
  schemaVersion: 1;
  sources: Record<string, Omit<RuleSource, 'bytes'> & { sha256: string }>;
}
export interface DirectManifest extends ManifestBase {
  schemaVersion: 2;
  sources: Record<DirectSourceId, DirectSource & { sha256: string; bytes: number }>;
}
export type CustomManifest = LegacyManifest | DirectManifest;
export const sourceId = ({ client, name }: { client: string; name: string }) => client + '/' + name;
export const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const beneath = (domain: string, root: string) => domain === root || domain.endsWith('.' + root);
export const validDomain = (s: string) => s === s.toLowerCase() && s.includes('.') && !s.startsWith('.') && !/^\d+(\.\d+)+$/.test(s) && /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/.test(s);

export function validatePolicy(policy: ConfigPolicy) {
  for (const scope of [policy.foreignAI, policy.domesticAI]) {
    for (const values of [scope.domains, scope.suffixes]) {
      if (!Array.isArray(values) || values.some(v => typeof v !== 'string' || !validDomain(v)) || new Set(values).size !== values.length) throw new Error('Invalid or duplicate policy domain');
    }
    if (!scope.suffixes.length) throw new Error('Empty AI scope');
  }
  if (!Array.isArray(policy.webRTC) || !policy.webRTC.length || policy.webRTC.some(v => !validDomain(v)) || new Set(policy.webRTC).size !== policy.webRTC.length) throw new Error('Invalid WebRTC domains');
  const shared = ['github.com', 'google.com', 'googleapis.com', 'gstatic.com', 'firebaseapp.com', 'microsoft.com', 'live.com', 'amazonaws.com', 'cloudflare.com', 'auth0.com', 'storage.googleapis.com', 'api.github.com'];
  for (const domain of shared) {
    if (policy.foreignAI.domains.includes(domain) || policy.foreignAI.suffixes.some(root => beneath(domain, root))) throw new Error('Shared infrastructure cannot be scoped to AI: ' + domain);
  }
  for (const root of policy.domesticAI.suffixes) {
    if (policy.foreignAI.suffixes.some(other => beneath(root, other) || beneath(other, root))) throw new Error('Overlapping foreign/domestic scope: ' + root);
  }
}

export function domainEntries(text: string, client: AIClient): DomainEntry[] {
  const entries: DomainEntry[] = [];
  if (client === 'Loon' || client === 'Surge') {
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || (client === 'Surge' && /^(\/\/|;)/.test(line))) continue;
      const [type, domain, ...extra] = line.split(',');
      if (type === 'DOMAIN' || type === 'DOMAIN-SUFFIX') {
        if (extra.length || !domain) throw new Error(`Invalid ${client} domain rule`);
        entries.push({ type, value: domain });
      }
    }
    if (!entries.length) throw new Error(`Invalid or empty ${client} source rules`);
  } else if (client === 'Mihomo') {
    const value = YAML.parse(text);
    if (!Array.isArray(value?.payload) || value.payload.some((v: unknown) => typeof v !== 'string')) throw new Error('Invalid Mihomo source payload');
    for (const line of value.payload as string[]) {
      const [type, domain] = line.split(',');
      if (type === 'DOMAIN' || type === 'DOMAIN-SUFFIX') entries.push({ type, value: domain });
    }
  } else {
    const value = YAML.parse(text);
    if (!value || typeof value !== 'object' || 'payload' in value || !Array.isArray(value.domain_suffix_set)) throw new Error('Invalid Egern source rules');
    for (const [key, type] of [['domain_set', 'DOMAIN'], ['domain_suffix_set', 'DOMAIN-SUFFIX']] as const) {
      if (value[key] != null && (!Array.isArray(value[key]) || value[key].some((v: unknown) => typeof v !== 'string'))) throw new Error('Invalid Egern domain list');
      for (const domain of value[key] || []) entries.push({ type, value: domain });
    }
  }
  if (entries.some(e => !validDomain(e.value))) throw new Error('Invalid source domain');
  return entries;
}

export function scopedEntries(entries: DomainEntry[], scope: DomainScope): DomainEntry[] {
  const selected: DomainEntry[] = [...entries.filter(e => scope.suffixes.some(root => beneath(e.value, root)) || (e.type === 'DOMAIN' && scope.domains.includes(e.value))), ...scope.domains.map(value => ({ type: 'DOMAIN' as const, value }))];
  return [...new Map(selected.map(e => [e.type + ',' + e.value, e])).values()].sort((a, b) => a.type.localeCompare(b.type) || a.value.localeCompare(b.value));
}

export function repairMusicYaml(text: string) {
  // A percent sign cannot start a plain YAML scalar. Quote only those list values;
  // preserve all actual domains, networks, user agents and attribution.
  const fixed = text.replace(/^(\s*-\s+)(%[^\r\n]*)$/gm, (_, indent, value) => indent + JSON.stringify(value));
  const data = YAML.parse(fixed);
  if (!data || !Array.isArray(data.domain_suffix_set) || !Array.isArray(data.user_agent_set) || 'payload' in data) throw new Error('Invalid repaired NetEaseMusic rules');
  return fixed;
}

export function render(entries: DomainEntry[], client: AIClient) {
  if (!entries.length) throw new Error('Refusing to publish an empty AI ruleset');
  if (client === 'Loon' || client === 'Surge') return entries.map(e => e.type + ',' + e.value).join('\n') + '\n';
  if (client === 'Mihomo') return YAML.stringify({ payload: entries.map(e => e.type + ',' + e.value) });
  return YAML.stringify({ no_resolve: true, domain_set: entries.filter(e => e.type === 'DOMAIN').map(e => e.value), domain_suffix_set: entries.filter(e => e.type === 'DOMAIN-SUFFIX').map(e => e.value) });
}

export type RuleFiles = Map<string, { text: string; typeCounts: Record<string, number> }>;

export async function writeConfigRules(
  output: string, metadata: Omit<LegacyManifest, 'files'> | Omit<DirectManifest, 'files'>,
  files: RuleFiles, previous?: CustomManifest,
): Promise<CustomManifest> {
  const manifest: CustomManifest = {
    ...metadata,
    files: [...files].map(([file, { text, typeCounts }]) => {
      const hash = sha256(text);
      const prior = previous?.files.find(entry => entry.file === file);
      return { file, sha256: hash, bytes: Buffer.byteLength(text), changedAt: prior?.sha256 === hash ? prior.changedAt : metadata.syncedAt, typeCounts };
    }),
  };
  for (const [name, { text }] of files) {
    const target = path.join(output, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text);
  }
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

export function addWebRTC(files: RuleFiles, policy: ConfigPolicy) {
  files.set('Mihomo/WebRTC.list', {
    text: '# NAME: WebRTC\n# SOURCE: ' + webRTCSource
      + '\n# DERIVED: explicit STUN/TURN hosts only; no global destination-port rules.\n'
      + policy.webRTC.map(domain => 'DOMAIN,' + domain).join('\n') + '\n',
    typeCounts: { DOMAIN: policy.webRTC.length },
  });
}

export async function generateConfigRules(
  inputs: Map<string, RuleSource>, output: string, syncedAt: string, previous?: CustomManifest,
): Promise<CustomManifest> {
  const policyText = await readFile(new URL('../config-rules/policy.json', import.meta.url), 'utf8');
  const policy: ConfigPolicy = JSON.parse(policyText);
  validatePolicy(policy);
  const sources: LegacyManifest['sources'] = {};
  function source(id: string) {
    const input = inputs.get(id);
    if (!input) throw new Error('Missing verified source: ' + id);
    const { bytes, ...provenance } = input;
    sources[id] = { ...provenance, sha256: sha256(bytes) };
    return bytes.toString('utf8');
  }
  const files: RuleFiles = new Map();
  for (const client of clients) {
    const id = client + '/GlobalAI';
    const original = source(id);
    const entries = domainEntries(original, client);
    const attribution = original.split(/\r?\n/).filter(line => /^# (AUTHOR|REPO|UPDATED):/.test(line));
    for (const [name, scope] of [['ForeignAI', policy.foreignAI], ['DomesticAI', policy.domesticAI]] as const) {
      const selected = scopedEntries(entries, scope);
      const header = [
        '# NAME: ' + name, ...attribution,
        '# DERIVED: scoped domains only; no shared cloud IP/ASN, process or keyword rules.',
        '# SOURCE: ' + sources[id].url, '# SOURCE-SHA256: ' + sources[id].sha256, '', '',
      ].join('\n');
      const typeCounts: Record<string, number> = {};
      for (const { type } of selected) typeCounts[type] = (typeCounts[type] ?? 0) + 1;
      files.set(client + '/' + name + '.' + extensionFor(client), { text: header + render(selected, client), typeCounts });
    }
  }
  const musicId = 'Egern/NetEaseMusic';
  const music = repairMusicYaml(source(musicId));
  const typeCounts = Object.fromEntries(Object.entries(YAML.parse(music) as Record<string, unknown>)
    .filter(([key, value]) => key.endsWith('_set') && Array.isArray(value))
    .map(([key, value]) => [key.replace(/_set$/, '').replaceAll('_', '-').toUpperCase(), (value as unknown[]).length]));
  files.set('Egern/NetEaseMusic.yaml', {
    text: '# DERIVED: YAML quoting repair; original rule values and attribution preserved.\n# SOURCE: '
      + sources[musicId].url + '\n# SOURCE-SHA256: ' + sources[musicId].sha256 + '\n' + music,
    typeCounts,
  });
  addWebRTC(files, policy);
  return writeConfigRules(output, { schemaVersion: 1, syncedAt, policySha256: sha256(policyText), sources }, files, previous);
}
