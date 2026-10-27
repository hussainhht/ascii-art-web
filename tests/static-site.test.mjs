import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(filename));
    else files.push(filename);
  }
  return files;
}
test('published artifact contains only static site assets', async () => {
  const allowed = new Set(['.html', '.css', '.js', '.txt', '.png', '.gif', '.mp3', '.mp4', '.otf', '.woff2']);
  for (const filename of await walk(root)) {
    assert.ok(path.basename(filename) === '.nojekyll' || allowed.has(path.extname(filename)), `Unexpected published file: ${filename}`);
    assert.doesNotMatch(filename, /(?:backend|node_modules|tests|unused|\.git)[\\/]/);
  }
  await access(path.join(root, '.nojekyll'));
});
test('every HTML and CSS asset reference resolves with exact filename case', async () => {
  for (const filename of await walk(root)) {
    if (!/\.(html|css)$/.test(filename)) continue;
    const source = await readFile(filename, 'utf8');
    assert.doesNotMatch(source, /\{\{|localhost:8081|["']\/export|["']\/(?:mario|terminal|normal|dark)?\/?ascii-art["']/);
    const refs = [...source.matchAll(/(?:src|href|action)="([^"]+)"|url\(['"]?([^)'"\s]+)/g)].map(match => match[1] ?? match[2]);
    for (const ref of refs) {
      if (/^(?:https?:|data:|#)/.test(ref) || ref === '/ascii-art-web/') continue;
      assert.ok(!ref.startsWith('/'), `${filename} has root-relative URL ${ref}`);
      const target = path.resolve(path.dirname(filename), ref);
      const siblings = await readdir(path.dirname(target));
      assert.ok(siblings.includes(path.basename(target)), `Missing or wrong-case asset ${ref} in ${filename}`);
    }
  }
});
test('published banner files are byte-identical to original assets', async () => {
  for (const banner of ['standard', 'shadow', 'thinkertoy', 'bigmoney']) {
    const original = await readFile(new URL(`../fonts/${banner}.txt`, import.meta.url));
    const published = await readFile(path.join(root, 'fonts', `${banner}.txt`));
    const hash = content => createHash('sha256').update(content).digest('hex');
    assert.equal(hash(published), hash(original));
  }
});
