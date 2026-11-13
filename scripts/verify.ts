import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pool, verifyArtifact } from './sync.ts';
import { artifactLocation, pathRegistry, storedBytes } from './artifact-layout.ts';
import type { Catalog, SyncStatus } from '../src/lib/types.ts';

export async function verifySnapshot(root: string, config: { clients: string[]; repository: string }, requireNamed = true) {
  const current = path.join(root, 'current');
  const catalog: Catalog = JSON.parse(await readFile(path.join(current, 'catalog.json'), 'utf8'));
  const status: SyncStatus = JSON.parse(await readFile(path.join(current, 'status.json'), 'utf8'));
  // Verify the clients already published in this snapshot. Configuration may
  // include a new client that will be added by the next successful sync.
  const clients = catalog.clients;
  if (!Array.isArray(clients) || !clients.length || new Set(clients).size !== clients.length
    || clients.some(client => !config.clients.includes(client))
    || status.clients.length !== clients.length || new Set(status.clients.map(client => client.name)).size !== clients.length
    || status.clients.some(client => !clients.includes(client.name))
    || catalog.rules.some(rule => rule.variants.some(variant => !clients.includes(variant.client)))) {
    throw new Error('Snapshot clients do not match catalog or configuration');
  }
  let records = 0, files = 0, bytes = 0, retainedFiles = 0;
  const methods = { bytes: 0, 'normalized-header': 0, recorded: 0 };
  const claimPath = pathRegistry();
  const expectedFiles = new Set<string>();
  for (const client of clients) {
    const index = JSON.parse(await readFile(path.join(current, 'raw', 'index', client + '.json'), 'utf8'));
    const sourceIds = new Set(index.rules.map((rule: { id: string }) => rule.id));
    const variants = catalog.rules.flatMap(rule => rule.variants.filter(v => v.client === client).map(variant => ({ id: rule.id, variant })));
    const active = variants.filter(record => !record.variant.archived);
    if (sourceIds.size !== index.rules.length || active.length !== index.rules.length || index.rules.length !== status.clients.find(c => c.name === client)?.count || active.some(record => !sourceIds.has(record.id))) throw new Error('Index records mismatch: ' + client);
    await pool(variants, 4, async ({ id, variant }) => {
      const manifest = JSON.parse(await readFile(path.join(current, 'raw', 'manifests', client, id + '.json'), 'utf8'));
      if (manifest.artifacts.length !== variant.artifacts.length) throw new Error('Artifact count mismatch: ' + client + '/' + id);
      const identities = new Set<string>();
      for (const source of manifest.artifacts) {
        const identity = source.key + '.' + source.ext;
        if (identities.has(identity)) throw new Error('Duplicate manifest artifact: ' + client + '/' + id + '/' + identity);
        identities.add(identity);
        const artifact = variant.artifacts.find(a => a.key === source.key && a.extension === source.ext);
        if (!artifact) throw new Error('Missing artifact: ' + client + '/' + id + '/' + identity);
        if (requireNamed) {
          const location = artifactLocation(client, variant.name, artifact.key, artifact.extension, config.repository);
          if (artifact.path !== location.path || artifact.url !== location.url || artifact.fileName !== location.fileName) throw new Error('Artifact naming mismatch: ' + client + '/' + id + '/' + identity);
        }
        claimPath(artifact.path, client + '/' + id + '/' + identity);
        expectedFiles.add(artifact.path);
        const data = await storedBytes(root, artifact);
        const method = verifyArtifact(data, source);
        if (method !== artifact.verification) throw new Error('Verification metadata mismatch: ' + artifact.path);
        if (!variant.archived) { methods[method]++; files++; bytes += data.length; }
        else retainedFiles++;
      }
      if (!variant.archived) records++;
    });
  }
  if (records !== status.clientRuleCount || files !== status.artifactCount || bytes !== status.totalBytes || catalog.rules.filter(rule => rule.variants.some(v => !v.archived)).length !== status.activeRuleCount) throw new Error('Snapshot totals do not match status');
  if (requireNamed) {
    const actualFiles: string[] = [];
    async function walk(directory: string, relative: string) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative + '/' + entry.name);
        else if (entry.isFile()) actualFiles.push(relative + '/' + entry.name);
        else throw new Error('Unexpected backup entry: ' + relative + '/' + entry.name);
      }
    }
    await walk(path.join(current, 'rules'), 'current/rules');
    if (actualFiles.length !== expectedFiles.size || actualFiles.some(file => !expectedFiles.has(file))) throw new Error('Unlisted or legacy rule files remain in snapshot');
  }
  return { verifiedRecords: records, verifiedFiles: files, verifiedBytes: bytes, retainedFiles, methods };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const config = JSON.parse(await readFile(new URL('../sync.config.json', import.meta.url), 'utf8'));
  const root = path.resolve(process.env.BACKUP_DIR || config.dataDirectory);
  console.log(JSON.stringify(await verifySnapshot(root, config), null, 2));
}
