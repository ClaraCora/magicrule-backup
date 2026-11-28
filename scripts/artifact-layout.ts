import { randomUUID } from 'node:crypto';
import { rename, rm } from 'node:fs/promises';
import path from 'node:path';

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
