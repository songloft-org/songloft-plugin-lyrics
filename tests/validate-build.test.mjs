import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { computeCanonicalZipHash, computeEntryHash } from '@songloft/plugin-builder';
import { validateBuild } from '../scripts/validate-build.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'lyrics-validate-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, 'dist/_build');
  mkdirSync(join(directory, 'static'), { recursive: true });
  const manifest = JSON.parse(readFileSync(new URL('../plugin.json', import.meta.url), 'utf8'));
  manifest.main = 'main.js';
  const entry = 'globalThis.onInit = () => {};';
  writeFileSync(join(directory, 'main.js'), entry);
  writeFileSync(join(directory, 'static/index.html'), '<p>Lyrics</p>');
  manifest.entryHash = computeEntryHash(entry);
  manifest.zipHash = computeCanonicalZipHash(directory);
  writeFileSync(join(directory, 'plugin.json'), JSON.stringify(manifest));
  return { root, directory };
}

test('validation reads the built manifest even when root metadata is not published yet', async t => {
  const { root } = fixture(t);
  await validateBuild(root);
});

test('validation rejects altered entry bytes', async t => {
  const { root, directory } = fixture(t);
  writeFileSync(join(directory, 'main.js'), 'corrupt');
  await assert.rejects(validateBuild(root), /entryHash mismatch/);
});

test('validation rejects altered static assets', async t => {
  const { root, directory } = fixture(t);
  writeFileSync(join(directory, 'static/index.html'), 'corrupt');
  await assert.rejects(validateBuild(root), /zipHash mismatch/);
});
