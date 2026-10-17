import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeCanonicalZipHash, computeEntryHash, validatePlugin } from '@songloft/plugin-builder';

export async function validateBuild(root) {
  const directory = join(root, 'dist/_build');
  const result = await validatePlugin(directory);
  if (!result.valid) throw new Error(JSON.stringify(result.errors));
  const manifest = JSON.parse(readFileSync(join(directory, 'plugin.json'), 'utf8'));
  if (computeEntryHash(readFileSync(join(directory, manifest.main))) !== manifest.entryHash) {
    throw new Error('Built entryHash mismatch');
  }
  if (computeCanonicalZipHash(directory) !== manifest.zipHash) {
    throw new Error('Built zipHash mismatch');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await validateBuild(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  console.log('Built plugin manifest and hashes are valid.');
}
