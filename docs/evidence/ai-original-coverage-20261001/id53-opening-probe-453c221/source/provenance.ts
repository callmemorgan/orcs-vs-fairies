import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

declare const __OVF_PROOF_PIN__: string;
declare const __OVF_PROOF_SOURCE_DIGEST__: string;
declare const __OVF_HELPER_SOURCE_DIGEST__: string;
export const PIN = '453c2218af9973b9eca8fb78392435bd9d46a740';
export const CONFIG_PATHS = ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'vitest.config.ts', 'index.html', 'editor.html'];
export const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
export const jsonBytes = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
export const writeJson = (path: string, value: unknown) => writeFileSync(path, jsonBytes(value), { flag: 'wx' });

export function fileInventory(directory: string, excluded: string[] = []) {
  const walk = (dir: string, prefix = ''): Array<{path:string;bytes:number;sha256:string}> => readdirSync(dir).sort().flatMap(name => {
    const path = join(dir, name), relative = prefix + name, stat = lstatSync(path);
    assert(!stat.isSymbolicLink(), `Artifact must not be a symlink: ${relative}`);
    if (excluded.includes(relative)) return [];
    return stat.isDirectory() ? walk(path, relative + '/') : [{ path: relative, bytes: stat.size, sha256: sha256(readFileSync(path)) }];
  });
  return walk(directory);
}

export function productProvenance(sourcePin: string) {
  assert.equal(sourcePin, PIN);
  const repository = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding:'utf8' }).trim();
  const git = (...args: string[]) => execFileSync('git', ['-C', repository, ...args], { maxBuffer:64 * 1024 * 1024 });
  assert.equal(git('rev-parse', 'HEAD').toString().trim(), sourcePin, 'Checkout HEAD must be the frozen product pin');
  const entries = git('ls-tree', '-r', '-z', sourcePin).toString().split('\0').filter(Boolean).map(entry => {
    const [metadata, path] = entry.split('\t'), [mode, kind, blob] = metadata.split(' ');
    return { path, mode, kind, blob };
  }).filter(entry => entry.path.startsWith('src/') || CONFIG_PATHS.includes(entry.path));
  const actualSrc = (dir: string, prefix = 'src'): string[] => {
    assert(!lstatSync(dir).isSymbolicLink());
    return readdirSync(dir).sort().flatMap(name => {
      const path = join(dir, name), relative = prefix + '/' + name, stat = lstatSync(path);
      assert(!stat.isSymbolicLink(), `Source must not be a symlink: ${relative}`);
      return stat.isDirectory() ? actualSrc(path, relative) : [relative];
    });
  };
  assert.deepEqual(actualSrc(join(repository, 'src')).sort(), entries.filter(e => e.path.startsWith('src/')).map(e => e.path).sort());
  assert.deepEqual(entries.filter(e => CONFIG_PATHS.includes(e.path)).map(e => e.path).sort(), [...CONFIG_PATHS].sort());
  const files = entries.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map(entry => {
    const path = join(repository, entry.path), stat = lstatSync(path), bytes = readFileSync(path);
    assert(stat.isFile() && !stat.isSymbolicLink() && entry.kind === 'blob' && ['100644','100755'].includes(entry.mode));
    assert(bytes.equals(git('cat-file','blob',entry.blob)), `Source/config differs from frozen Git bytes: ${entry.path}`);
    return { path:entry.path, bytes:bytes.length, sha256:sha256(bytes), gitBlob:entry.blob, bytesMatchGit:true };
  });
  return { repository, sourcePin, digest:sha256(files.map(f => `${f.path}\0${f.sha256}\n`).join('')), files };
}

export function authenticate(sourcePin: string, manifestPath: string, kind: 'driver'|'validator') {
  const product = productProvenance(sourcePin);
  assert.equal(__OVF_PROOF_PIN__, sourcePin);
  assert.equal(__OVF_PROOF_SOURCE_DIGEST__, product.digest);
  const manifestBytes = readFileSync(manifestPath), manifest = JSON.parse(manifestBytes.toString());
  assert.equal(manifest.status, 'built-not-executed');
  assert.equal(manifest.product.sourcePin, sourcePin);
  assert.equal(manifest.product.digest, product.digest);
  assert.deepEqual(manifest.product.files, product.files);
  const helperFiles = manifest.helper.files.map((entry: {path:string;bytes:number;sha256:string}) => {
    const path = resolve(manifest.helper.directory, entry.path);
    assert(path.startsWith(resolve(manifest.helper.directory) + '/'));
    const stat = lstatSync(path), bytes = readFileSync(path);
    assert(stat.isFile() && !stat.isSymbolicLink());
    assert.equal(bytes.length, entry.bytes); assert.equal(sha256(bytes), entry.sha256);
    return entry;
  });
  const digest = sha256(helperFiles.map((entry: {path:string;sha256:string}) => `${entry.path}\0${entry.sha256}\n`).join(''));
  assert.equal(digest, manifest.helper.digest); assert.equal(digest, __OVF_HELPER_SOURCE_DIGEST__);
  const executablePath = resolve(process.argv[1]), executableBytes = readFileSync(executablePath);
  assert.equal(executablePath, resolve(manifest.bundles[kind].path));
  assert.equal(sha256(executableBytes), manifest.bundles[kind].sha256);
  const bundle=manifest.bundles[kind],metaBytes=readFileSync(bundle.metafile.path);
  assert.equal(metaBytes.length,bundle.metafile.bytes);assert.equal(sha256(metaBytes),bundle.metafile.sha256);
  const inputs=bundle.inputs.map((entry:{path:string;bytes:number;sha256:string})=>{
    const stat=lstatSync(entry.path),bytes=readFileSync(entry.path);assert(stat.isFile()&&!stat.isSymbolicLink());
    assert.equal(bytes.length,entry.bytes);assert.equal(sha256(bytes),entry.sha256);return entry;
  });
  return { product, helper:manifest.helper, manifest:{path:resolve(manifestPath),bytes:manifestBytes.length,sha256:sha256(manifestBytes)}, executable:{path:executablePath,bytes:executableBytes.length,sha256:sha256(executableBytes)}, metafile:{path:resolve(bundle.metafile.path),bytes:metaBytes.length,sha256:sha256(metaBytes)}, inputs, kind };
}
