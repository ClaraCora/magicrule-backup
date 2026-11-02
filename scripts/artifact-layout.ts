import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, rm } from 'node:fs/promises';
import type { Artifact } from '../src/lib/types.ts';

export function artifactLocation(client: string, name: string, key: string, extension: string, repository: string) {
  for (const value of [client, key, extension]) {
    if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(value) || value.includes('..')) throw new Error(`Unsafe artifact identifier: ${value}`);
  }
  if (typeof name !== 'string' || !name || /[<>:"/\\|?*\x00-\x1f\x7f]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) throw new Error(`Unsafe rule filename: ${client}/${name}`);
  const fileName = `${name}.${extension}`;
  if (Buffer.byteLength(fileName) > 255) throw new Error(`Rule filename exceeds 255 bytes: ${client}/${name}`);
  const relative = `current/rules/${client}/${key}/${fileName}`;
  return { fileName, path: relative, url: `https://raw.githubusercontent.com/${repository}/refs/heads/data/${relative.split('/').map(encodeURIComponent).join('/')}` };
}

export function pathRegistry() {
  const paths = new Map<string, string>();
  return (relative: string, owner: string) => {
    const normalized = relative.normalize('NFC').toLowerCase();
    const prior = paths.get(normalized);
    if (prior !== undefined) throw new Error(`Artifact filename collision: ${relative} (${prior}; ${owner})`);
    paths.set(normalized, owner);
  };
}

export function ruleFile(root: string, relative: string) {
  const file = path.resolve(root, relative);
  if (relative.includes('\\') || !relative.startsWith('current/rules/') || !file.startsWith(path.resolve(root, 'current', 'rules') + path.sep)) throw new Error(`Invalid backup path: ${relative}`);
  return file;
}

export async function storedBytes(root: string, artifact: Artifact) {
  const bytes = await readFile(ruleFile(root, artifact.path));
  if (bytes.length !== artifact.bytes || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) throw new Error(`Stored bytes mismatch: ${artifact.path}`);
  return bytes;
}

export async function publishSnapshot(root: string, staging: string) {
  const current = path.join(root, 'current');
  const previous = path.join(root, `.previous-${randomUUID()}`);
  let hadPrevious = true;
  try { await rename(current, previous); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') hadPrevious = false; else throw error; }
  try { await rename(staging, current); }
  catch (error) { if (hadPrevious) await rename(previous, current); throw error; }
  if (hadPrevious) await rm(previous, { recursive: true, force: true });
}
