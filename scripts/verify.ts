import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { customFiles, directSourceGroups, sha256, sourceId, sourceRules, type CustomManifest } from './config-rules.ts';

function validateSourceLink(value: string, secureOnly: boolean) {
  const url = new URL(value);
  if ((url.protocol !== 'https:' && (secureOnly || url.protocol !== 'http:')) || url.username || url.password || url.hash) {
    throw new Error('Invalid source link: ' + value);
  }
}

export async function verifyCustom(snapshot: string): Promise<CustomManifest> {
  const directory = path.join(snapshot, 'custom');
  const manifest: CustomManifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if ((manifest.schemaVersion !== 1 && manifest.schemaVersion !== 2) || !Number.isFinite(Date.parse(manifest.syncedAt)) ||
      !/^[a-f0-9]{64}$/.test(manifest.policySha256) ||
      !Array.isArray(manifest.files) || manifest.files.length !== customFiles.length) {
    throw new Error('Invalid custom rules manifest');
  }
  const expected = new Set(customFiles);
  if (manifest.schemaVersion === 1) {
    const sourceKeys = new Set(sourceRules.map(sourceId));
    for (const [id, source] of Object.entries(manifest.sources)) {
      if (!sourceKeys.delete(id) || !/^[a-f0-9]{64}$/.test(source.sha256) ||
          !['bytes', 'normalized-header'].includes(source.verification)) {
        throw new Error('Invalid source entry: ' + id);
      }
      validateSourceLink(source.url, false);
      validateSourceLink(source.manifestUrl, false);
    }
    if (sourceKeys.size) throw new Error('Missing source entries in the custom manifest');
  } else {
    const expectedIds = Object.values(directSourceGroups).flat();
    if (Object.keys(manifest.sources).length !== expectedIds.length) throw new Error('Unexpected direct source count');
    for (const id of expectedIds) {
      const source = manifest.sources[id];
      if (!source || !/^[a-f0-9]{64}$/.test(source.sha256) || !Number.isSafeInteger(source.bytes) || source.bytes < 1 || !source.license) {
        throw new Error('Invalid direct source entry: ' + id);
      }
      validateSourceLink(source.url, true);
      validateSourceLink(source.repo, true);
    }
  }
  for (const artifact of manifest.files) {
    if (!expected.delete(artifact.file) || !Number.isFinite(Date.parse(artifact.changedAt))) throw new Error('Invalid custom file: ' + artifact.file);
    const bytes = await readFile(path.join(directory, artifact.file));
    if (!bytes.length || bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) {
      throw new Error('Custom file verification failed: ' + artifact.file);
    }
  }
  const actual = await readdir(directory, { recursive: true, withFileTypes: true });
  const files = actual.filter(entry => !entry.isDirectory()).map(entry => path.relative(directory, path.join(entry.parentPath, entry.name)));
  if (actual.some(entry => !entry.isDirectory() && !entry.isFile()) ||
      files.length !== customFiles.length + 1 || files.some(file => file !== 'manifest.json' && !customFiles.includes(file)) ||
      (await readdir(snapshot)).some(name => name !== 'custom')) {
    throw new Error('Unexpected files in the custom snapshot');
  }
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const directory = path.resolve(process.env.BACKUP_DIR || '.cache/backup', 'current');
  const manifest = await verifyCustom(directory);
  console.log('Verified ' + manifest.files.length + ' custom subscriptions and their manifest.');
}
