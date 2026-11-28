import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import type { Catalog } from '../src/lib/types.ts';
import { publishSnapshot } from './artifact-layout.ts';
import {
  directSourceGroups, generateConfigRules, sha256, sourceId, sourceRules,
  type CustomManifest, type DirectSource, type DirectSourceId, type DirectSources, type RuleSource,
} from './config-rules.ts';
import { generateDirectRules } from './direct-rules.ts';
import { verifyCustom } from './verify.ts';

interface SyncOptions {
  allowedOrigins: string[];
  repository: string;
  dataDirectory: string;
  requestIntervalMs: number;
  timeoutMs: number;
  attempts: number;
  now?: () => Date;
}

interface SourceArtifact {
  key: string;
  ext: string;
  url: string;
  binary?: boolean;
  dedupe?: { bytes_sha256?: string; semantic_sha256?: string; mode?: string; normalized_header_lines?: number };
}

interface SourceManifest {
  client: string;
  rule: string;
  rule_updated_at?: string;
  artifacts: SourceArtifact[];
}

const asDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, 'utf8'));
const exists = (file: string) => access(file).then(() => true, (error: NodeJS.ErrnoException) => {
  if (error.code === 'ENOENT') return false;
  throw error;
});

function retryAfterMs(value: string | null): number {
  if (value && /^\d+$/.test(value)) return Number(value) * 1000;
  const deadline = value ? Date.parse(value) : NaN;
  return Number.isFinite(deadline) ? Math.max(0, deadline - Date.now()) : 5_000;
}

async function cloudflareErrorCode(response: Response): Promise<string | undefined> {
  if (response.headers.get('content-type')?.split(';')[0] !== 'text/plain' || !response.body) {
    await response.body?.cancel();
    return;
  }
  let prefix = '';
  for await (const chunk of response.body) {
    prefix += Buffer.from(chunk.subarray(0, 128 - prefix.length)).toString('utf8');
    if (prefix.length >= 128) break;
  }
  return /^\s*error code:\s*(\d{4})\b/i.exec(prefix)?.[1];
}

export function verifyArtifact(bytes: Buffer, artifact: SourceArtifact): 'bytes' | 'normalized-header' {
  const expected = artifact.dedupe?.bytes_sha256;
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Missing or invalid upstream SHA-256: ' + artifact.url);
  if (sha256(bytes) === expected) return 'bytes';
  const dedupe = artifact.dedupe;
  if (!artifact.binary && dedupe?.mode === 'standard_header_normalized' && [4, 5].includes(dedupe.normalized_header_lines ?? 0) && /^[a-f0-9]{64}$/.test(dedupe.semantic_sha256 || '')) {
    const lines = bytes.toString('utf8').split('\n');
    const labels = ['NAME', 'AUTHOR', 'REPO', 'UPDATED'];
    if (labels.every((label, index) => lines[index]?.startsWith(`# ${label}: `))) {
      const body = lines.slice(4);
      // Upstream counts DESC as a fifth normalized metadata line, even when
      // rule-count comments occur between UPDATED and DESC. Never skip rules.
      if (dedupe.normalized_header_lines === 5) {
        const end = body.findIndex(line => !line.startsWith('#'));
        const header = body.slice(0, end < 0 ? body.length : end);
        const descriptions = header.flatMap((line, index) => line.startsWith('# DESC: ') ? [index] : []);
        if (descriptions.length === 1) body.splice(descriptions[0], 1);
        else throw new Error(`Invalid five-line normalized header: ${artifact.url}`);
      }
      if (sha256(Buffer.from(body.join('\n'))) === dedupe.semantic_sha256) return 'normalized-header';
    }
  }
  throw new Error(`SHA-256 mismatch (file and declared normalized body): ${artifact.url}`);
}

function fetchUpstream(options: SyncOptions) {
  let nextRequestAt = 0;
  return async (url: string, validate?: (bytes: Buffer) => void): Promise<Buffer> => {
    for (let attempt = 1; ; attempt++) {
      const wait = nextRequestAt - performance.now();
      if (wait > 0) await delay(Math.ceil(wait));
      nextRequestAt = performance.now() + options.requestIntervalMs;

      let response: Response | undefined;
      try {
        response = await fetch(url, {
          headers: { 'User-Agent': 'MagicRuleBackup/1.0 (+https://github.com/' + options.repository + ')', Accept: '*/*' },
          signal: AbortSignal.timeout(options.timeoutMs), redirect: 'error',
        });
        if (response.ok && response.headers.get('cf-mitigated') !== 'challenge') {
          const chunks: Uint8Array[] = [];
          let size = 0;
          for await (const chunk of response.body!) {
            size += chunk.byteLength;
            if (size > 4 * 1024 * 1024) throw new Error('Upstream response exceeds 4 MiB: ' + url);
            chunks.push(chunk);
          }
          const bytes = Buffer.concat(chunks);
          validate?.(bytes);
          console.log('HTTP ' + response.status + ' ' + url);
          return bytes;
        }
      } catch (error) {
        if (attempt >= options.attempts) throw new Error('Upstream request or validation failed: ' + url, { cause: error });
        await delay(1_000 * attempt);
        continue;
      }
      const ray = response.headers.get('cf-ray');
      const detail = ray && /^[\w-]{1,80}$/.test(ray) ? ' (CF-Ray: ' + ray + ')' : '';
      const message = 'HTTP ' + response.status + ': ' + url + detail;
      if (response.status === 403 || response.headers.get('cf-mitigated') === 'challenge') {
        const code = await cloudflareErrorCode(response).catch(() => undefined);
        throw new Error(message + (code ? ' — Cloudflare error ' + code : ' — upstream access denied'));
      }
      await response.body?.cancel();
      const retryable = response.status === 429 || response.status === 408 || response.status >= 500;
      if (!retryable || attempt >= options.attempts) throw new Error(message);
      const cooldown = response.status === 429 ? Math.max(1_000, retryAfterMs(response.headers.get('retry-after'))) : 1_000 * attempt;
      if (cooldown > 60_000) throw new Error(message + ' — Retry-After exceeds 60 seconds');
      console.warn(message + ' — retrying after ' + cooldown + 'ms');
      nextRequestAt = Math.max(nextRequestAt, performance.now() + cooldown);
    }
  };
}

async function generateAndPublish(
  root: string,
  generate: (staging: string, previous?: CustomManifest) => Promise<CustomManifest>,
  migrating = false,
) {
  const previous = migrating ? undefined : await verifyCustom(path.join(root, 'current')).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
  const staging = await mkdtemp(path.join(root, '.staging-'));
  try {
    const manifest = await generate(staging, previous);
    await verifyCustom(staging);
    await publishSnapshot(root, staging);
    return manifest;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function sync(options: SyncOptions & ({ sources: DirectSources } | { manifests: Record<string, string> })) {
  const allowed = new Set(options.allowedOrigins);
  const checkedUrl = (value: string, base?: string) => {
    const url = new URL(value, base);
    if (!allowed.has(url.origin) || url.username || url.password || url.hash) throw new Error('Unexpected upstream URL: ' + url.origin + url.pathname);
    return url.href;
  };
  const request = fetchUpstream(options);
  const root = path.resolve(options.dataDirectory);
  const syncedAt = () => (options.now?.() ?? new Date()).toISOString();
  if ('sources' in options) {
    const inputs = new Map<DirectSourceId, DirectSource & { bytes: Buffer }>();
    for (const id of Object.values(directSourceGroups).flat()) {
      const source = options.sources[id];
      if (!source) throw new Error('Missing configured source: ' + id);
      const url = checkedUrl(source.url);
      inputs.set(id, { ...source, url, bytes: await request(url) });
    }
    const manifest = await generateAndPublish(root, (staging, previous) =>
      generateDirectRules(inputs, staging, syncedAt(), previous));
    console.log('Validated ' + inputs.size + ' author inputs and generated ' + manifest.files.length + ' subscriptions.');
    return manifest;
  }
  const inputs = new Map<string, RuleSource>();
  const downloads = new Map<string, Buffer>();
  for (const spec of sourceRules) {
    const id = sourceId(spec);
    const manifestUrl = checkedUrl(options.manifests[id]);
    const manifest = JSON.parse((await request(manifestUrl)).toString('utf8')) as SourceManifest;
    if (manifest.client !== spec.client || manifest.rule !== spec.name || !Array.isArray(manifest.artifacts)) {
      throw new Error('Unexpected upstream manifest for ' + id + ': ' + manifestUrl);
    }
    const matches = manifest.artifacts.filter(artifact => artifact.key === spec.key && artifact.ext === spec.extension && !artifact.binary);
    if (matches.length !== 1) throw new Error('Missing or ambiguous source artifact: ' + id);
    const artifact = matches[0];
    const url = checkedUrl(artifact.url, manifestUrl);
    const bytes = downloads.get(url) ?? await request(url, data => { verifyArtifact(data, artifact); });
    const verification = verifyArtifact(bytes, artifact);
    downloads.set(url, bytes);
    inputs.set(id, { bytes, url, manifestUrl, updatedAt: asDate(manifest.rule_updated_at), verification });
  }
  const manifest = await generateAndPublish(root, (staging, previous) =>
    generateConfigRules(inputs, path.join(staging, 'custom'), syncedAt(), previous));
  console.log('Verified ' + inputs.size + ' upstream files (' + downloads.size + ' distinct downloads) and generated ' + manifest.files.length + ' subscriptions.');
  return manifest;
}

export async function migrate(root: string) {
  const catalogPath = path.join(root, 'current/catalog.json');
  if (!await exists(catalogPath)) return;
  const catalog = await readJson<Catalog>(catalogPath);
  const status = await readJson<{ lastSuccessfulSyncAt: string }>(path.join(root, 'current/status.json'));
  const syncedAt = asDate(status.lastSuccessfulSyncAt);
  if (!syncedAt) throw new Error('Invalid legacy snapshot timestamp');
  const inputs = new Map<string, RuleSource>();
  for (const spec of sourceRules) {
    const id = sourceId(spec);
    const variants = catalog.rules.flatMap(rule => rule.variants).filter(variant => !variant.archived && variant.client === spec.client && variant.name === spec.name);
    if (variants.length !== 1) throw new Error('Missing or ambiguous legacy source: ' + id);
    const variant = variants[0];
    const matches = variant.artifacts.filter(artifact => artifact.key === spec.key && artifact.extension === spec.extension);
    if (matches.length !== 1) throw new Error('Missing or ambiguous legacy artifact: ' + id);
    const artifact = matches[0];
    const filename = path.resolve(root, artifact.path);
    if (!filename.startsWith(path.resolve(root, 'current/rules') + path.sep)) throw new Error('Invalid legacy artifact path: ' + id);
    const bytes = await readFile(filename);
    if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256 || artifact.verification === 'recorded') {
      throw new Error('Legacy source verification failed: ' + id);
    }
    inputs.set(id, {
      bytes, url: artifact.sourceUrl, manifestUrl: variant.sourceManifestUrl,
      updatedAt: variant.sourceUpdatedAt, verification: artifact.verification,
    });
  }
  await generateAndPublish(root, staging =>
    generateConfigRules(inputs, path.join(staging, 'custom'), syncedAt), true);
  for (const file of ['README.md', '.gitignore', '.gitattributes']) await rm(path.join(root, file), { force: true });
  console.log('Migrated the previously verified source files to the 10 existing subscription paths.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = await readJson<SyncOptions & { sources: DirectSources }>(path.join(import.meta.dirname, '../sync.config.json'));
  options.dataDirectory = path.resolve(process.env.BACKUP_DIR || options.dataDirectory);
  if (process.argv.includes('--migrate')) await migrate(options.dataDirectory);
  else await sync(options);
}
