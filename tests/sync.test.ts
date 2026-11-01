import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sync, verifyArtifact } from '../scripts/sync.ts';
import type { Catalog } from '../src/lib/types.ts';

const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

test('complete snapshots, incremental reuse, timestamps, delisting, rollback and retry', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'magicrule-test-'));
  const state = { version: 1, remove: false, invalid: '', retry: 0, day: 1 };
  const binary = Buffer.from([0x4d, 0x52, 0x53, 0, 255, 0, 1]);
  let origin = '';
  const rule = (client: string, id: string) => ({ id, name: id === 'a' ? 'Example' : 'Keep', chinese_name: id === 'a' ? '示例' : '保留', manifest: `${origin}/data/rules/${client}/${id}/manifest.json`, types: ['DOMAIN'], total_line_count: 1, providers: ['https://example.com/author'], ...(id === 'a' ? { rule_updated_at: '2026-01-01T00:00:00Z' } : {}) });
  const server = createServer((req, res) => {
    const url = new URL(req.url!, origin);
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/data/meta/clients.json') return void res.end(JSON.stringify({ clients: [{ name: 'Loon' }, { name: 'Mihomo' }] }));
    if (url.pathname.startsWith('/data/meta/')) return void res.end('{}');
    if (url.pathname.startsWith('/data/index/')) {
      const client = url.pathname.includes('Loon') ? 'Loon' : 'Mihomo';
      const rules = client === 'Loon' ? [...(state.remove ? [] : [rule(client, 'a')]), rule(client, 'b')] : [rule(client, 'a')];
      return void res.end(JSON.stringify({ client, generated_at: '2026-11-01T00:00:00Z', rules }));
    }
    if (url.pathname.endsWith('/manifest.json')) {
      const [, , , client, id] = url.pathname.split('/');
      const isBinary = client === 'Mihomo';
      const bytes = isBinary ? binary : Buffer.from(`DOMAIN,${id}${state.version}.example\n`);
      const artifactUrl = state.invalid === 'origin' ? 'https://unexpected.example/file.list' : `${origin}/artifacts/${client}-${id}-${state.version}.${isBinary ? 'mrs' : 'list'}`;
      return void res.end(JSON.stringify({ client, total_line_count: 1, artifacts: [{ key: 'rules', ext: isBinary ? 'mrs' : 'list', url: artifactUrl, binary: isBinary, dedupe: { bytes_sha256: sha(bytes) } }] }));
    }
    if (url.pathname.startsWith('/artifacts/')) {
      if (state.invalid === 'timeout') return;
      if (state.invalid === '404') { res.statusCode = 404; return void res.end('not found'); }
      if (state.invalid === 'html') return void res.end('<!doctype html><html>Missing</html>');
      if (state.invalid === 'hash') return void res.end('corrupt');
      if (state.retry > 0) { state.retry--; res.statusCode = 503; return void res.end('retry'); }
      const isBinary = url.pathname.endsWith('.mrs');
      const id = url.pathname.includes('-b-') ? 'b' : 'a';
      res.setHeader('Content-Type', 'application/octet-stream');
      return void res.end(isBinary ? binary : Buffer.from(`DOMAIN,${id}${state.version}.example\n`));
    }
    res.statusCode = 404; res.end('missing');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const options = { source: origin, allowedOrigins: [origin], clients: ['Loon', 'Mihomo'], repository: 'example/rules', dataDirectory: directory, concurrency: 2, timeoutMs: 2000, attempts: 3, retryDelayMs: 1, now: () => new Date(`2026-11-${String(state.day).padStart(2, '0')}T00:00:00Z`) };
  const catalog = async () => JSON.parse(await readFile(path.join(directory, 'current/catalog.json'), 'utf8')) as Catalog;
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, { recursive: true, force: true }); });

  const first = await sync(options);
  assert.equal(first.activeRuleCount, 2); assert.equal(first.clientRuleCount, 3); assert.equal(first.artifactCount, 3);
  const original = await catalog();
  assert.equal(original.rules.find(r => r.id === 'b')!.variants[0].sourceUpdatedAt, null, 'generation time must not masquerade as rule update');
  assert.deepEqual(await readFile(path.join(directory, 'current/rules/Mihomo/a/rules.mrs')), binary, 'binary bytes are preserved');
  state.day++;
  const second = await sync(options);
  assert.equal(second.downloadedFiles, 0); assert.equal(second.reusedFiles, 3);
  assert.deepEqual(await catalog(), original, 'unchanged sync does not change rule dates');
  state.day++; state.version++;
  await sync(options);
  const updated = await catalog();
  assert.notEqual(updated.rules[0].variants[0].fileChangedAt, original.rules[0].variants[0].fileChangedAt);
  const binaryVariant = updated.rules.find(r => r.id === 'a')!.variants.find(v => v.client === 'Mihomo')!;
  assert.equal(binaryVariant.fileChangedAt, original.rules.find(r => r.id === 'a')!.variants.find(v => v.client === 'Mihomo')!.fileChangedAt, 'unchanged binary keeps its date');
  state.day++; state.remove = true;
  await sync(options);
  assert.equal((await catalog()).rules.find(r => r.id === 'a')!.variants.find(v => v.client === 'Loon')!.archived, true);
  assert.equal(await readFile(path.join(directory, 'current/rules/Loon/a/rules.list'), 'utf8'), 'DOMAIN,a2.example\n', 'delisted files remain downloadable');
  const before = await readFile(path.join(directory, 'current/catalog.json'));
  const statusBefore = await readFile(path.join(directory, 'current/status.json'));
  for (const invalid of ['hash', 'html', '404', 'origin', 'timeout']) {
    state.invalid = invalid; state.version++;
    await assert.rejects(sync({ ...options, timeoutMs: invalid === 'timeout' ? 100 : options.timeoutMs }));
    assert.deepEqual(await readFile(path.join(directory, 'current/catalog.json')), before, `${invalid} must not publish a partial catalog`);
    assert.deepEqual(await readFile(path.join(directory, 'current/status.json')), statusBefore, `${invalid} must not update successful time`);
    assert.equal((await readdir(directory)).some(name => name.startsWith('.staging-')), false);
  }
  state.invalid = ''; state.retry = 2; state.version++; state.day++;
  assert.ok((await sync(options)).downloadedFiles > 0, 'transient failures retry successfully');
});

test('normalized shared headers require the declared body hash; binary files require exact hashes', () => {
  const header = '# NAME: Example\n# AUTHOR: MagicRule\n# REPO: https://magicrule.pages.dev\n# UPDATED: old\n';
  const body = 'DOMAIN,example.com\n';
  const artifact = { key: 'rules', ext: 'list', url: 'https://example.com/rule.list', dedupe: { mode: 'standard_header_normalized', normalized_header_lines: 4, bytes_sha256: sha(header + body), semantic_sha256: sha(body) } };
  assert.equal(verifyArtifact(Buffer.from(header.replace('old', 'new') + body), artifact), 'normalized-header');
  assert.throws(() => verifyArtifact(Buffer.from(header.replace('old', 'new') + body.replace('example.com', 'tampered.com')), artifact), /SHA-256 mismatch/);
  assert.throws(() => verifyArtifact(Buffer.from(header.replace('old', 'new') + body), { ...artifact, binary: true }), /SHA-256 mismatch/);
  assert.throws(() => verifyArtifact(Buffer.from('arbitrary\nheader\nlines\nhere\n' + body), artifact), /SHA-256 mismatch/);
});
