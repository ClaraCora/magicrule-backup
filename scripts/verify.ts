import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pool, verifyArtifact } from './sync.ts';
import type { Catalog, SyncStatus } from '../src/lib/types.ts';

const config = JSON.parse(await readFile(new URL('../sync.config.json', import.meta.url), 'utf8'));
const root = path.resolve(process.env.BACKUP_DIR || config.dataDirectory);
const current = path.join(root, 'current');
const catalog: Catalog = JSON.parse(await readFile(path.join(current, 'catalog.json'), 'utf8'));
const status: SyncStatus = JSON.parse(await readFile(path.join(current, 'status.json'), 'utf8'));
let records = 0, files = 0, bytes = 0;
const methods = { bytes: 0, 'normalized-header': 0, recorded: 0 };
for (const client of config.clients as string[]) {
  const index = JSON.parse(await readFile(path.join(current, 'raw', 'index', `${client}.json`), 'utf8'));
  if (index.rules.length !== status.clients.find(c => c.name === client)?.count) throw new Error(`Index count mismatch: ${client}`);
  await pool(index.rules as { id: string }[], 4, async sourceRule => {
    const variant = catalog.rules.find(rule => rule.id === sourceRule.id)?.variants.find(v => v.client === client && !v.archived);
    if (!variant) throw new Error(`Missing record: ${client}/${sourceRule.id}`);
    const manifest = JSON.parse(await readFile(path.join(current, 'raw', 'manifests', client, `${sourceRule.id}.json`), 'utf8'));
    if (manifest.artifacts.length !== variant.artifacts.length) throw new Error(`Artifact count mismatch: ${client}/${sourceRule.id}`);
    for (const source of manifest.artifacts) {
      const artifact = variant.artifacts.find(a => a.key === source.key && a.extension === source.ext);
      if (!artifact) throw new Error(`Missing artifact: ${source.key}`);
      const file = path.resolve(root, artifact.path);
      if (!file.startsWith(path.join(current, 'rules') + path.sep)) throw new Error(`Invalid backup path: ${artifact.path}`);
      const data = await readFile(file);
      if (createHash('sha256').update(data).digest('hex') !== artifact.sha256 || data.length !== artifact.bytes) throw new Error(`Stored bytes mismatch: ${artifact.path}`);
      const method = verifyArtifact(data, source);
      if (method !== artifact.verification) throw new Error(`Verification metadata mismatch: ${artifact.path}`);
      methods[method]++; files++; bytes += data.length;
    }
    records++;
  });
}
if (records !== status.clientRuleCount || files !== status.artifactCount || bytes !== status.totalBytes) throw new Error('Snapshot totals do not match status');
console.log(JSON.stringify({ verifiedRecords: records, verifiedFiles: files, verifiedBytes: bytes, methods }, null, 2));
