import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../sync.config.json', import.meta.url), 'utf8'));
const directory = path.resolve(process.env.BACKUP_DIR || config.dataDirectory);
const git = (...args: string[]) => execFileSync('git', args, { stdio: 'inherit' });
if (existsSync(path.join(directory, '.git'))) {
  console.log('Data worktree already exists.');
} else {
  if (existsSync(directory)) throw new Error(`Data directory exists without a Git worktree: ${directory}`);
  mkdirSync(path.dirname(directory), { recursive: true });
  const remote = execFileSync('git', ['ls-remote', '--heads', 'origin', 'refs/heads/data'], { encoding: 'utf8' }).trim();
  if (remote) {
    git('fetch', 'origin', 'data');
    git('worktree', 'add', '-b', 'data', directory, 'FETCH_HEAD');
  } else {
    git('worktree', 'add', '--detach', directory, 'HEAD');
    git('-C', directory, 'switch', '--orphan', 'data');
  }
}
