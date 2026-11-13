import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import type { Artifact, Catalog } from '../src/lib/types.ts';

export interface DomainScope { domains: string[]; suffixes: string[] }
export interface ConfigPolicy { foreignAI: DomainScope; domesticAI: DomainScope; webRTC: string[] }
type DomainEntry = { type: 'DOMAIN' | 'DOMAIN-SUFFIX'; value: string };
type AIClient = 'Mihomo' | 'Egern' | 'Loon' | 'Surge';
const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const beneath = (domain: string, root: string) => domain === root || domain.endsWith('.' + root);
const validDomain = (s: string) => s === s.toLowerCase() && s.includes('.') && !s.startsWith('.') && !/^\d+(\.\d+)+$/.test(s) && /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/.test(s);

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

function render(entries: DomainEntry[], client: AIClient) {
  if (!entries.length) throw new Error('Refusing to publish an empty AI ruleset');
  if (client === 'Loon' || client === 'Surge') return entries.map(e => e.type + ',' + e.value).join('\n') + '\n';
  if (client === 'Mihomo') return YAML.stringify({ payload: entries.map(e => e.type + ',' + e.value) });
  return YAML.stringify({ no_resolve: true, domain_set: entries.filter(e => e.type === 'DOMAIN').map(e => e.value), domain_suffix_set: entries.filter(e => e.type === 'DOMAIN-SUFFIX').map(e => e.value) });
}

export async function generateConfigRules(root: string, output = path.join(root, 'current', 'custom')) {
  root = path.resolve(root);
  const policyText = await readFile(new URL('../config-rules/policy.json', import.meta.url), 'utf8');
  const policy: ConfigPolicy = JSON.parse(policyText);
  validatePolicy(policy);
  const catalog: Catalog = JSON.parse(await readFile(path.join(root, 'current', 'catalog.json'), 'utf8'));
  const sources: Record<string, { path: string; url: string; sha256: string }> = {};
  async function source(client: string, name: string, key: string, extension = 'yaml') {
    const matches = catalog.rules.flatMap(r => r.variants.filter(v => v.client === client && v.name === name && !v.archived).flatMap(v => v.artifacts.filter(a => a.key === key && a.extension === extension)));
    if (matches.length !== 1) throw new Error('Missing or ambiguous source: ' + client + '/' + name);
    const artifact: Artifact = matches[0];
    const file = path.resolve(root, artifact.path);
    if (!file.startsWith(root + path.sep)) throw new Error('Escaping source path');
    const bytes = await readFile(file);
    if (sha256(bytes) !== artifact.sha256) throw new Error('Source hash mismatch: ' + artifact.path);
    sources[client + '/' + name] = { path: artifact.path, url: artifact.url, sha256: artifact.sha256 };
    return bytes.toString('utf8');
  }
  const files: Record<string, string> = {};
  for (const client of ['Mihomo', 'Egern', 'Loon', 'Surge'] as const) {
    const extension = client === 'Loon' || client === 'Surge' ? 'list' : 'yaml';
    const original = await source(client, 'GlobalAI', client === 'Mihomo' ? 'classical' : 'rules', extension);
    const entries = domainEntries(original, client);
    const attribution = original.split(/\r?\n/).filter(line => /^# (AUTHOR|REPO|UPDATED):/.test(line)).join('\n');
    for (const [name, scope] of [['ForeignAI', policy.foreignAI], ['DomesticAI', policy.domesticAI]] as const) {
      const selected = scopedEntries(entries, scope);
      files[`${client}/${name}.${extension}`] = `# NAME: ${name}\n${attribution}\n# DERIVED: scoped domains only; no shared cloud IP/ASN, process or keyword rules.\n# SOURCE: ${sources[client + '/GlobalAI'].url}\n# SOURCE-SHA256: ${sources[client + '/GlobalAI'].sha256}\n\n` + render(selected, client);
    }
  }
  const music = await source('Egern', 'NetEaseMusic', 'rules');
  files['Egern/NetEaseMusic.yaml'] = '# DERIVED: YAML quoting repair; original rule values and attribution preserved.\n# SOURCE-SHA256: ' + sources['Egern/NetEaseMusic'].sha256 + '\n' + repairMusicYaml(music);
  files['Mihomo/WebRTC.list'] = '# NAME: WebRTC\n# SOURCE: https://raw.githubusercontent.com/ClaraCora/ege/main/mihomo/WebRTC.list\n# DERIVED: explicit STUN/TURN hosts only; no global destination-port rules.\n' + policy.webRTC.map(domain => 'DOMAIN,' + domain).join('\n') + '\n';
  for (const [name, text] of Object.entries(files)) {
    if (name.endsWith('.yaml')) YAML.parse(text);
    if (name.startsWith('Loon/')) domainEntries(text, 'Loon');
    if (name.startsWith('Surge/')) domainEntries(text, 'Surge');
  }
  const manifest = { schemaVersion: 1, policySha256: sha256(policyText), sources, files: Object.entries(files).map(([file, text]) => ({ file, sha256: sha256(text), bytes: Buffer.byteLength(text) })) };
  // Everything is prepared and validated before writing. The workflow commits
  // this complete batch with the validated backup only after the build succeeds.
  for (const [name, text] of Object.entries({ ...files, 'manifest.json': JSON.stringify(manifest, null, 2) + '\n' })) {
    const target = path.join(output, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target + '.tmp', text);
    await rename(target + '.tmp', target);
  }
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(process.env.BACKUP_DIR || '.cache/backup');
  const manifest = await generateConfigRules(root, process.env.CONFIG_RULES_OUTPUT);
  console.log(JSON.stringify({ generatedFiles: manifest.files, sources: manifest.sources }, null, 2));
}
