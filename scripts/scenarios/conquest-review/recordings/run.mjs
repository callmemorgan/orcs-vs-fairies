import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = process.env.SOURCE_ROOT;
const archiveDirectory = process.env.PRIVATE_ARCHIVE_DIR;
assert(sourceRoot && isAbsolute(sourceRoot), 'SOURCE_ROOT must be an absolute path');
assert(archiveDirectory && isAbsolute(archiveDirectory), 'PRIVATE_ARCHIVE_DIR must be an absolute path');
const toolRoot = process.env.TOOL_ROOT ?? sourceRoot;
const esbuildBinary = process.env.ESBUILD_BIN ?? join(toolRoot, 'node_modules/.bin/esbuild');
mkdirSync(archiveDirectory, {recursive:true});
const runnerPath = join(scriptDirectory,'runner.ts');
const runnerSource = readFileSync(runnerPath, 'utf8');
const entryPath = join(archiveDirectory,'entry.ts');
writeFileSync(entryPath,runnerSource.replaceAll('@proof/',sourceRoot.replace(/\/$/,'')+'/'));
const bundlePath = join(archiveDirectory,'runner.mjs');
const metafilePath = join(archiveDirectory,'esbuild-metafile.json');
const build = spawnSync(esbuildBinary,[entryPath,'--bundle','--platform=node','--format=esm',`--outfile=${bundlePath}`,`--metafile=${metafilePath}`],{cwd:sourceRoot,encoding:'utf8'});
if (build.status !== 0) {process.stderr.write(build.stdout+build.stderr);process.exit(build.status??1);}
const metafile = JSON.parse(readFileSync(metafilePath,'utf8'));
const sources = Object.keys(metafile.inputs).map(input=>resolve(sourceRoot,input)).filter(input=>input!==entryPath).sort().map(path=>({path:relative(sourceRoot,path),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
const manifest = {
  schemaVersion:1,sourceRevision:process.env.SOURCE_REVISION??'unspecified',sourceRoot,
  geometryDependencyRevision:'d1171b9',runnerSha256:createHash('sha256').update(runnerSource).digest('hex'),
  launcherSha256:createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  sources,
};
writeFileSync(join(archiveDirectory,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const run = spawnSync(process.execPath,[bundlePath],{cwd:sourceRoot,env:{...process.env,PRIVATE_ARCHIVE_DIR:archiveDirectory},stdio:'inherit'});
if (run.status !== 0) process.exit(run.status??1);
for (const source of sources) assert.equal(createHash('sha256').update(readFileSync(join(sourceRoot,source.path))).digest('hex'),source.sha256,`Source changed during proof: ${source.path}`);
