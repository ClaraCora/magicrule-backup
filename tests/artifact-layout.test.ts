import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactLocation, pathRegistry, ruleFile } from '../scripts/artifact-layout.ts';

test('rule names remain the basename while directories distinguish formats and clients', () => {
  const yaml = artifactLocation('Mihomo', 'Google', 'classical', 'yaml', 'example/rules');
  assert.equal(yaml.fileName, 'Google.yaml');
  assert.equal(yaml.path, 'current/rules/Mihomo/classical/Google.yaml');
  assert.ok(yaml.url.endsWith('/Mihomo/classical/Google.yaml'));
  assert.equal(artifactLocation('Mihomo', 'Google', 'domain-mrs', 'mrs', 'example/rules').fileName, 'Google.mrs');
  assert.equal(artifactLocation('Egern', 'Google', 'rules', 'yaml', 'example/rules').fileName, 'Google.yaml');
  assert.equal(artifactLocation('Loon', 'Google', 'rules', 'list', 'example/rules').fileName, 'Google.list');
  assert.ok(artifactLocation('Loon', 'A B', 'rules', 'list', 'example/rules').url.endsWith('/A%20B.list'));
});

test('unsafe names, escaping paths, and case-insensitive filename collisions fail explicitly', () => {
  for (const name of ['', '../escape', 'A/B', 'A\\B', 'Bad?', 'CON', 'NUL.txt', 'Trailing.', 'Trailing ', 'x'.repeat(256)]) {
    assert.throws(() => artifactLocation('Egern', name, 'rules', 'yaml', 'example/rules'), /filename/);
  }
  assert.throws(() => ruleFile('/backup', 'current/rules/../../../outside'));
  const claim = pathRegistry();
  claim('current/rules/Loon/rules/Google.list', 'first');
  assert.throws(() => claim('current/rules/Loon/rules/google.list', 'second'), /collision.*first; second/);
});
