import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Catalog, SyncRun, SyncStatus } from './types';

const directory = path.resolve(process.env.BACKUP_DIR || '.cache/backup', 'current');
const read = async <T>(name: string): Promise<T> => {
  try { return JSON.parse(await readFile(path.join(directory, name), 'utf8')) as T; }
  catch (cause) { throw new Error(`Cannot read backup ${name}. Run npm run prepare:data and npm run sync first, or set BACKUP_DIR.`, { cause }); }
};
let catalog: Promise<Catalog> | undefined;
let status: Promise<SyncStatus> | undefined;
export const loadCatalog = () => catalog ||= read<Catalog>('catalog.json');
export const loadStatus = () => status ||= read<SyncStatus>('status.json');
export const loadHistory = () => read<SyncRun[]>('history.json');
