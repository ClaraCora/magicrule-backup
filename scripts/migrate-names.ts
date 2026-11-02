import { cp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Catalog } from '../src/lib/types.ts';
import { artifactLocation, pathRegistry, publishSnapshot, storedBytes } from './artifact-layout.ts';
import { verifySnapshot } from './verify.ts';

export async function migrateNames(root: string, config: { clients: string[]; repository: string }) {
  const current = path.join(root, 'current');
  try { await access(current); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { movedFiles: 0, skipped: 'No snapshot yet; run sync to create one.' }; throw error; }
  const catalog: Catalog = JSON.parse(await readFile(path.join(current, 'catalog.json'), 'utf8'));
  await verifySnapshot(root, config, false);
  const stagingRoot = path.join(root, `.staging-${randomUUID()}`);
  const staging = path.join(stagingRoot, 'current');
  const claimPath = pathRegistry();
  let movedFiles = 0;
  try {
    await cp(current, staging, { recursive: true });
    await rm(path.join(staging, 'rules'), { recursive: true, force: true });
    await mkdir(path.join(staging, 'rules'));
    for (const rule of catalog.rules) for (const variant of rule.variants) for (const artifact of variant.artifacts) {
      const location = artifactLocation(variant.client, variant.name, artifact.key, artifact.extension, config.repository);
      claimPath(location.path, `${variant.client}/${rule.id}/${artifact.key}.${artifact.extension}`);
      const bytes = await storedBytes(root, artifact);
      const file = path.join(stagingRoot, location.path);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
      if (artifact.path !== location.path || artifact.fileName !== location.fileName || artifact.url !== location.url) movedFiles++;
      Object.assign(artifact, location);
    }
    await writeFile(path.join(staging, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
    const verified = await verifySnapshot(stagingRoot, config);
    await publishSnapshot(root, staging);
    return { movedFiles, ...verified };
  } finally { await rm(stagingRoot, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const config = JSON.parse(await readFile(new URL('../sync.config.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(await migrateNames(path.resolve(process.env.BACKUP_DIR || config.dataDirectory), config), null, 2));
}
