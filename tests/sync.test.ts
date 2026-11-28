import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { migrate, sync, verifyArtifact } from '../scripts/sync.ts';
import { sha256 as sha, sourceId, sourceRules } from '../scripts/config-rules.ts';
import { verifyCustom } from '../scripts/verify.ts';

test('normalized shared headers require the declared body hash; binary files require exact hashes', () => {
  const header = '# NAME: Example\n# AUTHOR: MagicRule\n# REPO: https://magicrule.pages.dev\n# UPDATED: old\n';
  const body = 'DOMAIN,example.com\n';
  const artifact = { key: 'rules', ext: 'list', url: 'https://example.com/rule.list', dedupe: { mode: 'standard_header_normalized', normalized_header_lines: 4, bytes_sha256: sha(header + body), semantic_sha256: sha(body) } };
  assert.equal(verifyArtifact(Buffer.from(header.replace('old', 'new') + body), artifact), 'normalized-header');
  assert.throws(() => verifyArtifact(Buffer.from(header.replace('old', 'new') + body.replace('example.com', 'tampered.com')), artifact), /SHA-256 mismatch/);
  assert.throws(() => verifyArtifact(Buffer.from(header.replace('old', 'new') + body), { ...artifact, binary: true }), /SHA-256 mismatch/);
  assert.throws(() => verifyArtifact(Buffer.from('arbitrary\nheader\nlines\nhere\n' + body), artifact), /SHA-256 mismatch/);
});

test('five-line normalization removes only DESC metadata before the rule body', () => {
  const header = '# NAME: AdvertisingLite\n# AUTHOR: MagicRule\n# REPO: https://magicrule.pages.dev\n# UPDATED: old\n';
  const counts = '# DOMAIN: 1\n# DOMAIN-SUFFIX: 1\n';
  const description = '# DESC: Contains URL-REGEX rules\n';
  const rules = '\nDOMAIN,example.com\nDOMAIN-SUFFIX,ads.example.com\n';
  const original = header + counts + description + rules;
  const artifact = { key: 'rules', ext: 'list', url: 'https://example.com/AdvertisingLite.list', dedupe: { mode: 'standard_header_normalized', normalized_header_lines: 5, bytes_sha256: sha(original), semantic_sha256: sha(counts + rules) } };
  const changed = original.replace('# UPDATED: old', '# UPDATED: new').replace('Contains URL-REGEX rules', 'Updated description');
  assert.equal(verifyArtifact(Buffer.from(changed), artifact), 'normalized-header');
  assert.equal(verifyArtifact(Buffer.from(original), artifact), 'bytes');
  for (const modified of [changed.replace('ads.example.com', 'tampered.example.com'), changed.replace('# DOMAIN: 1', '# DOMAIN: 999')]) {
    assert.throws(() => verifyArtifact(Buffer.from(modified), artifact), /SHA-256 mismatch/);
  }
  for (const modified of [header + counts + rules, header + counts + description + description + rules, header + counts + rules + description]) {
    assert.throws(() => verifyArtifact(Buffer.from(modified), artifact), /Invalid five-line normalized header/);
  }
  assert.throws(() => verifyArtifact(Buffer.from(changed), { ...artifact, binary: true }), /SHA-256 mismatch/);
  assert.throws(() => verifyArtifact(Buffer.from(changed), { ...artifact, dedupe: { ...artifact.dedupe, normalized_header_lines: 6 } }), /SHA-256 mismatch/);
});

test('migration and targeted refresh preserve all subscription paths and roll back on failed verification', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'magicrule-targeted-test-'));
  let version = 1;
  let forbidden = false;
  let corrupt = false;
  const requests: string[] = [];
  const manifests: Record<string, string> = {};
  const manifestPath = (id: string) => '/data/' + id + '/manifest.json';
  const artifactPath = (id: string) => '/artifacts/' + id;
  const sourceText = (id: string, revision: number) => {
    const extra = 'rev' + revision + '.openai.com';
    if (id === 'Mihomo/GlobalAI') return 'payload: ["DOMAIN,' + extra + '", "DOMAIN-SUFFIX,deepseek.com"]\n';
    if (id === 'Egern/GlobalAI') return 'domain_suffix_set: [deepseek.com]\ndomain_set: [' + extra + ']\n';
    if (id === 'Egern/NetEaseMusic') return 'domain_suffix_set: [music.163.com]\nuser_agent_set:\n - %E7\n';
    return '# AUTHOR: Example\nDOMAIN,' + extra + '\nDOMAIN-SUFFIX,deepseek.com\n';
  };
  const server = createServer((req, res) => {
    const pathname = req.url!;
    requests.push(pathname);
    const spec = sourceRules.find(item => [manifestPath(sourceId(item)), artifactPath(sourceId(item))].includes(pathname));
    if (!spec) { res.statusCode = 404; res.end('unexpected'); return; }
    const id = sourceId(spec);
    if (forbidden && id === 'Egern/GlobalAI') {
      res.writeHead(403, { 'Content-Type': 'text/plain', 'CF-Ray': 'unit-test' });
      res.end('error code: 1010\n');
    } else if (pathname === manifestPath(id)) {
      res.end(JSON.stringify({ client: spec.client, rule: spec.name, artifacts: [
        { key: 'other', ext: 'bin', url: '/unrelated' },
        { key: spec.key, ext: spec.extension, url: artifactPath(id), dedupe: { bytes_sha256: sha(sourceText(id, version)) } },
      ] }));
    } else {
      res.end(corrupt && id === 'Egern/GlobalAI' ? 'wrong bytes' : sourceText(id, version));
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  });
  const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  const catalog = { rules: [] as unknown[] };
  const current = path.join(root, 'current');
  for (const spec of sourceRules) {
    const id = sourceId(spec);
    const file = 'current/rules/' + id + '.' + spec.extension;
    const text = sourceText(id, 1);
    const diskPath = path.join(root, file);
    await mkdir(path.dirname(diskPath), { recursive: true });
    await writeFile(diskPath, text);
    manifests[id] = origin + manifestPath(id);
    catalog.rules.push({ variants: [{
      client: spec.client, name: spec.name, sourceManifestUrl: manifests[id], sourceUpdatedAt: null,
      artifacts: [{
        path: file, key: spec.key, extension: spec.extension, sourceUrl: origin + artifactPath(id),
        sha256: sha(text), bytes: Buffer.byteLength(text), verification: 'bytes',
      }],
    }] });
  }
  const legacyDate = '2026-11-27T03:00:39.681Z';
  await writeFile(path.join(current, 'catalog.json'), JSON.stringify(catalog));
  await writeFile(path.join(current, 'status.json'), JSON.stringify({ lastSuccessfulSyncAt: legacyDate }));
  await migrate(root);
  assert.equal(requests.length, 0);
  assert.deepEqual(await readdir(current), ['custom']);
  const seed = await verifyCustom(current);
  assert.equal(seed.syncedAt, legacyDate);
  assert.deepEqual(seed.files.map(file => file.file).sort(), [
    'Egern/DomesticAI.yaml', 'Egern/ForeignAI.yaml', 'Egern/NetEaseMusic.yaml',
    'Loon/DomesticAI.list', 'Loon/ForeignAI.list',
    'Mihomo/DomesticAI.yaml', 'Mihomo/ForeignAI.yaml', 'Mihomo/WebRTC.list',
    'Surge/DomesticAI.list', 'Surge/ForeignAI.list',
  ]);
  assert.ok((await readFile(path.join(current, 'custom/Loon/ForeignAI.list'), 'utf8')).includes('DOMAIN,rev1.openai.com'));
  version = 2;
  const options = {
    allowedOrigins: [origin], manifests, repository: 'example/fixture', dataDirectory: root,
    requestIntervalMs: 0, timeoutMs: 1_000, attempts: 1, now: () => new Date('2026-11-28T04:00:00Z'),
  };
  const refreshed = await sync(options);
  assert.deepEqual(requests, sourceRules.flatMap(spec => [manifestPath(sourceId(spec)), artifactPath(sourceId(spec))]));
  assert.deepEqual(refreshed.files.map(file => file.file), seed.files.map(file => file.file));
  assert.equal(refreshed.syncedAt, options.now().toISOString());
  const published = await readFile(path.join(current, 'custom/manifest.json'));
  const changed = await readFile(path.join(current, 'custom/Loon/ForeignAI.list'), 'utf8');
  assert.ok(changed.includes('DOMAIN,rev2.openai.com'));
  assert.ok(!changed.includes('DOMAIN,rev1.openai.com'));
  const oldWebRTC = seed.files.find(file => file.file.endsWith('WebRTC.list'));
  assert.deepEqual(refreshed.files.find(file => file.file.endsWith('WebRTC.list')), oldWebRTC);

  forbidden = true;
  requests.length = 0;
  await assert.rejects(sync(options), /HTTP 403.*unit-test.*Cloudflare error 1010/);
  assert.equal(requests.filter(url => url === manifestPath('Egern/GlobalAI')).length, 1);
  assert.deepEqual(await readFile(path.join(current, 'custom/manifest.json')), published);
  forbidden = false;
  corrupt = true;
  await assert.rejects(sync(options), /Upstream request or validation failed/);
  assert.deepEqual(await readFile(path.join(current, 'custom/manifest.json')), published);
  assert.equal(await readFile(path.join(current, 'custom/Loon/ForeignAI.list'), 'utf8'), changed);
});
