import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Artifact, Catalog, Change, Rule, SyncRun, SyncStatus, Variant } from '../src/lib/types.ts';
import { artifactLocation, pathRegistry, publishSnapshot, ruleFile, storedBytes } from './artifact-layout.ts';

export interface SyncOptions {
  source: string;
  allowedOrigins: string[];
  clients: string[];
  repository: string;
  dataDirectory: string;
  concurrency: number;
  timeoutMs: number;
  attempts: number;
  now?: () => Date;
  retryDelayMs?: number;
}

interface SourceArtifact {
  key: string; label?: string; ext: string; url: string;
  binary?: boolean; empty?: boolean; recommended?: boolean;
  dedupe?: { bytes_sha256?: string; semantic_sha256?: string; mode?: string; normalized_header_lines?: number };
}

interface SourceRule {
  id: string; name: string; chinese_name?: string; description?: string;
  manifest: string; types?: string[]; type_counts?: Record<string, number>;
  total_line_count?: number; rule_updated_at?: string;
  providers?: string[];
}

interface SourceManifest {
  client?: string; rule_updated_at?: string; generated_at?: string;
  description?: string; providers?: string[]; type_counts?: Record<string, number>;
  total_line_count?: number; artifacts: SourceArtifact[];
}

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const present = async (file: string) => access(file).then(() => true, () => false);
const jsonRead = async <T>(file: string, fallback: T): Promise<T> => {
  try { return JSON.parse(await readFile(file, 'utf8')) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback; throw error; }
};
const jsonWrite = (file: string, value: unknown) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const segment = (value: string) => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(value) || value.includes('..')) throw new Error(`Unsafe file identifier: ${value}`);
  return value;
};

export function verifyArtifact(bytes: Buffer, artifact: SourceArtifact): Artifact['verification'] {
  const expected = artifact.dedupe?.bytes_sha256;
  if (!expected) return 'recorded';
  if (digest(bytes) === expected) return 'bytes';
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
      if (digest(Buffer.from(body.join('\n'))) === dedupe.semantic_sha256) return 'normalized-header';
    }
  }
  throw new Error(`SHA-256 mismatch (file and declared normalized body): ${artifact.url}`);
}

export async function pool<T, R>(items: T[], concurrency: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let failure: unknown;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!failure) {
      const index = cursor++;
      if (index >= items.length) return;
      try { results[index] = await task(items[index], index); }
      catch (error) { failure ??= error; }
    }
  });
  await Promise.all(workers);
  if (failure) throw failure;
  return results;
}

export async function sync(options: SyncOptions): Promise<SyncStatus> {
  const root = path.resolve(options.dataDirectory);
  const current = path.join(root, 'current');
  const staging = path.join(root, `.staging-${randomUUID()}`);
  const now = (options.now?.() || new Date()).toISOString();
  if (!options.clients.length || options.concurrency < 1 || options.attempts < 1) throw new Error('Invalid sync configuration');
  if (!/^[\w.-]+\/[\w.-]+$/.test(options.repository)) throw new Error('Invalid repository');
  await mkdir(root, { recursive: true });
  await mkdir(staging);
  const oldCatalog = await jsonRead<Catalog>(path.join(current, 'catalog.json'), { schemaVersion: 1, clients: [], rules: [] });
  const oldVariants = new Map<string, Variant>(oldCatalog.rules.flatMap(rule => rule.variants.map(variant => [`${variant.client}/${rule.id}`, variant] as const)));
  let downloadedFiles = 0, reusedFiles = 0, completed = 0;
  const claimPath = pathRegistry();
  const allowed = new Set(options.allowedOrigins);
  const urlFor = (value: string, manifest = false) => {
    const base = manifest && !value.startsWith('/') && !/^https?:/i.test(value) && !value.startsWith('data/') ? `${options.source}/data/` : `${options.source}/`;
    const url = new URL(value, base);
    if (!allowed.has(url.origin) || url.username || url.password) throw new Error(`Unexpected source URL: ${url.origin}${url.pathname}`);
    return url.href;
  };
  const request = async (url: string, validate?: (bytes: Buffer) => void): Promise<Buffer> => {
    let error: unknown;
    for (let attempt = 0; attempt < options.attempts; attempt++) {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': `MagicRuleBackup/1.0 (+https://github.com/${options.repository})`, Accept: '*/*' },
          signal: AbortSignal.timeout(options.timeoutMs), redirect: 'error',
        });
        if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}: ${url}`); }
        const chunks: Uint8Array[] = [];
        let size = 0;
        for await (const chunk of response.body!) {
          size += chunk.byteLength;
          if (size > 100 * 1024 * 1024) { throw new Error(`File exceeds 100 MiB: ${url}`); }
          chunks.push(chunk);
        }
        const bytes = Buffer.concat(chunks);
        if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(bytes.subarray(0, 256).toString('utf8'))) throw new Error(`HTML returned instead of data: ${url}`);
        validate?.(bytes);
        return bytes;
      } catch (cause) {
        error = cause;
        if (attempt + 1 < options.attempts) await new Promise(resolve => setTimeout(resolve, (options.retryDelayMs ?? 1000) * 2 ** attempt));
      }
    }
    throw error;
  };
  const requestJson = async <T>(url: string): Promise<{ bytes: Buffer; value: T }> => {
    const bytes = await request(url);
    try { return { bytes, value: JSON.parse(bytes.toString('utf8')) as T }; }
    catch { throw new Error(`Invalid JSON: ${url}`); }
  };
  try {
    if (await present(current)) await cp(current, staging, { recursive: true });
    await rm(path.join(staging, 'rules'), { recursive: true, force: true });
    await mkdir(path.join(staging, 'rules'), { recursive: true });
    await mkdir(path.join(staging, 'raw', 'meta'), { recursive: true });
    await mkdir(path.join(staging, 'raw', 'index'), { recursive: true });
    const metadata = await pool(['clients', 'capabilities', 'config'], options.concurrency, async name => {
      const result = await requestJson<Record<string, unknown>>(urlFor(`/data/meta/${name}.json`));
      await writeFile(path.join(staging, 'raw', 'meta', `${name}.json`), result.bytes);
      return result.value;
    });
    const available = (metadata[0].clients as { name: string }[] | undefined)?.map(client => client.name);
    if (!available || options.clients.some(client => !available.includes(client))) throw new Error('Selected client missing from upstream directory');
    const indexes = await pool(options.clients, options.concurrency, async client => {
      segment(client);
      const result = await requestJson<{ client?: string; generated_at?: string; rules: SourceRule[] }>(urlFor(`/data/index/${client}.json`));
      if (!Array.isArray(result.value.rules) || !result.value.rules.length) throw new Error(`Empty or invalid index: ${client}`);
      const ids = new Set<string>();
      for (const rule of result.value.rules) {
        segment(rule.id);
        if (!rule.name || !rule.manifest || ids.has(rule.id)) throw new Error(`Invalid or duplicate rule: ${client}/${rule.id}`);
        ids.add(rule.id);
      }
      await writeFile(path.join(staging, 'raw', 'index', `${client}.json`), result.bytes);
      return { client, generatedAt: date(result.value.generated_at), rules: result.value.rules };
    });
    const jobs = indexes.flatMap(index => index.rules.map(rule => ({ client: index.client, rule })));
    console.log(`Syncing ${jobs.length} client records (${options.clients.join(', ')}).`);
    const records = await pool(jobs, options.concurrency, async ({ client, rule }) => {
      const manifestUrl = urlFor(rule.manifest, true);
      const result = await requestJson<SourceManifest>(manifestUrl);
      const manifest = result.value;
      if (!Array.isArray(manifest.artifacts) || (manifest.client && manifest.client !== client)) throw new Error(`Invalid manifest: ${client}/${rule.name}`);
      const directory = path.join(staging, 'raw', 'manifests', client);
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, `${rule.id}.json`), result.bytes);
      const prior = oldVariants.get(`${client}/${rule.id}`);
      const keys = new Set<string>();
      const artifacts: Artifact[] = [];
      for (const artifact of manifest.artifacts) {
        segment(artifact.key); segment(artifact.ext);
        const location = artifactLocation(client, rule.name, artifact.key, artifact.ext, options.repository);
        const identity = `${artifact.key}.${artifact.ext}`;
        if (keys.has(identity)) throw new Error(`Duplicate artifact: ${client}/${rule.id}/${identity}`);
        keys.add(identity);
        claimPath(location.path, `${client}/${rule.id}/${identity}`);
        const relative = location.path;
        const file = path.join(staging, ...relative.split('/').slice(1));
        const sourceUrl = urlFor(artifact.url);
        const expectedHash = artifact.dedupe?.bytes_sha256;
        if (expectedHash && !/^[a-f0-9]{64}$/i.test(expectedHash)) throw new Error(`Invalid artifact hash: ${sourceUrl}`);
        const old = prior?.artifacts.find(item => item.key === artifact.key && item.extension === artifact.ext);
        let bytes: Buffer | undefined;
        if (expectedHash && old && (old.sha256 === expectedHash || old.expectedSha256 === expectedHash) && await present(ruleFile(root, old.path))) {
          const cached = await readFile(ruleFile(root, old.path));
          if (digest(cached) === old?.sha256) {
            try { verifyArtifact(cached, artifact); bytes = cached; reusedFiles++; } catch { /* Re-download corrupt or outdated cache. */ }
          }
        }
        if (!bytes) {
          const cacheKey = digest(Buffer.from(JSON.stringify([sourceUrl, expectedHash, artifact.dedupe?.semantic_sha256])));
          const cacheFile = path.join(root, '.downloads', cacheKey);
          if (expectedHash && await present(cacheFile)) {
            const cached = await readFile(cacheFile);
            try { verifyArtifact(cached, artifact); bytes = cached; reusedFiles++; } catch { /* Fetch again if a cache entry is corrupt. */ }
          }
          if (!bytes) {
            bytes = await request(sourceUrl, data => { verifyArtifact(data, artifact); });
            downloadedFiles++;
            if (expectedHash) {
              await mkdir(path.dirname(cacheFile), { recursive: true });
              await writeFile(cacheFile, bytes);
            }
          }
          if (!bytes.length && !artifact.empty) throw new Error(`Unexpected empty artifact: ${sourceUrl}`);
        }
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, bytes);
        const sha256 = digest(bytes);
        artifacts.push({
          key: artifact.key, label: artifact.label || artifact.key, extension: artifact.ext,
          binary: Boolean(artifact.binary), empty: Boolean(artifact.empty), recommended: Boolean(artifact.recommended),
          ...location,
          sourceUrl, sha256, expectedSha256: expectedHash || null, verification: verifyArtifact(bytes, artifact),
          bytes: bytes.length, changedAt: old?.sha256 === sha256 ? old.changedAt : now,
        });
      }
      const signature = (items: Artifact[]) => JSON.stringify(items.map(item => [item.key, item.extension, item.sha256]).sort());
      const fileChangedAt = prior && signature(prior.artifacts) === signature(artifacts) ? prior.fileChangedAt : now;
      const variant: Variant = {
        client, name: rule.name, chineseName: rule.chinese_name || '',
        description: rule.description || manifest.description || '',
        types: rule.types || Object.keys(manifest.type_counts || {}),
        typeCounts: manifest.type_counts || rule.type_counts || {},
        totalLineCount: manifest.total_line_count ?? rule.total_line_count ?? null,
        sourceUpdatedAt: date(rule.rule_updated_at) || date(manifest.rule_updated_at),
        generatedAt: date(manifest.generated_at), fileChangedAt,
        providers: rule.providers?.length ? rule.providers : manifest.providers || [],
        sourceManifestUrl: manifestUrl, archived: false, artifacts,
      };
      if (++completed % 100 === 0 || completed === jobs.length) console.log(`Validated ${completed}/${jobs.length}; downloaded ${downloadedFiles}, reused ${reusedFiles}.`);
      return { id: rule.id, variant };
    });
    const grouped = new Map<string, Rule>();
    for (const rule of oldCatalog.rules) {
      const variants = rule.variants.filter(v => options.clients.includes(v.client)).map(v => ({ ...v, archived: true }));
      if (variants.length) grouped.set(rule.id, { ...rule, variants });
    }
    const changes: Change[] = [];
    const seen = new Set<string>();
    for (const { id, variant } of records) {
      const key = `${variant.client}/${id}`;
      seen.add(key);
      const prior = oldVariants.get(key);
      if (!prior || prior.archived) changes.push({ id, name: variant.name, client: variant.client, kind: 'added' });
      else if (prior.fileChangedAt !== variant.fileChangedAt || prior.description !== variant.description || prior.sourceUpdatedAt !== variant.sourceUpdatedAt || prior.name !== variant.name || prior.chineseName !== variant.chineseName) changes.push({ id, name: variant.name, client: variant.client, kind: 'modified' });
      const rule = grouped.get(id) || { id, name: variant.name, chineseName: variant.chineseName, variants: [] };
      rule.name = variant.name; rule.chineseName ||= variant.chineseName;
      rule.variants = [...rule.variants.filter(v => v.client !== variant.client), variant].sort((a, b) => options.clients.indexOf(a.client) - options.clients.indexOf(b.client));
      grouped.set(id, rule);
    }
    for (const rule of oldCatalog.rules) for (const variant of rule.variants) {
      if (options.clients.includes(variant.client) && !variant.archived && !seen.has(`${variant.client}/${rule.id}`)) changes.push({ id: rule.id, name: rule.name, client: variant.client, kind: 'removed' });
    }
    // Rebuild archived files too; never leave obsolete or legacy paths in the output tree.
    for (const rule of grouped.values()) for (const variant of rule.variants.filter(v => v.archived)) {
      for (const artifact of variant.artifacts) {
        const location = artifactLocation(variant.client, variant.name, artifact.key, artifact.extension, options.repository);
        claimPath(location.path, `${variant.client}/${rule.id}/${artifact.key}.${artifact.extension} (archived)`);
        const bytes = await storedBytes(root, artifact);
        const file = path.join(staging, ...location.path.split('/').slice(1));
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, bytes);
        Object.assign(artifact, location);
      }
    }
    const catalog: Catalog = { schemaVersion: 1, clients: options.clients, rules: [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'en')) };
    const successfulAt = (options.now?.() || new Date()).toISOString();
    const status: SyncStatus = {
      schemaVersion: 1, source: options.source, lastSuccessfulSyncAt: successfulAt,
      activeRuleCount: catalog.rules.filter(rule => rule.variants.some(v => !v.archived)).length,
      clientRuleCount: records.length, artifactCount: records.reduce((sum, record) => sum + record.variant.artifacts.length, 0),
      totalBytes: records.reduce((sum, record) => sum + record.variant.artifacts.reduce((size, file) => size + file.bytes, 0), 0),
      downloadedFiles, reusedFiles,
      clients: indexes.map(index => ({ name: index.client, count: index.rules.length, generatedAt: index.generatedAt })),
    };
    const history = await jsonRead<SyncRun[]>(path.join(current, 'history.json'), []);
    const run: SyncRun = { syncedAt: successfulAt, added: changes.filter(c => c.kind === 'added').length, modified: changes.filter(c => c.kind === 'modified').length, removed: changes.filter(c => c.kind === 'removed').length, changes };
    await jsonWrite(path.join(staging, 'catalog.json'), catalog);
    await jsonWrite(path.join(staging, 'status.json'), status);
    await jsonWrite(path.join(staging, 'history.json'), [run, ...history].slice(0, 90));
    await publishSnapshot(root, staging);
    await writeFile(path.join(root, '.gitignore'), '.staging-*\n.previous-*\n.downloads/\n');
    await writeFile(path.join(root, '.gitattributes'), '* -text\n');
    await writeFile(path.join(root, 'README.md'), '# MagicRule backup data\n\nGenerated by the main branch sync workflow. Do not edit manually.\n\n`current/raw/` preserves upstream indexes and manifests; `current/rules/` preserves artifact bytes; `current/catalog.json`, `status.json`, and `history.json` describe the snapshot. Original author and license statements remain in upstream files.\n');
    console.log(JSON.stringify(status, null, 2));
    return status;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const config = JSON.parse(await readFile(new URL('../sync.config.json', import.meta.url), 'utf8')) as SyncOptions;
  config.dataDirectory = process.env.BACKUP_DIR || config.dataDirectory;
  await sync(config);
}
