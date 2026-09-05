# Isolated build reproduction

Updated 2026-09-05T08:22:39.698424+00:00 in `/home/morgana/Projects/orcs-vs-Fairies`. The isolated build reproduced all **67 current primary production files byte-for-byte**, including `index-9PMVYv2m.js`. No output files were changed, added or missing relative to the primary build.

The previous `index-6tDjccOB.js`, harvest-setting `index-BbPjUpKo.js`, and initial Hold Position `index-Cb-bnvUW.js` revisions each reproduced all 67 files identically. This report now describes the corrected Hold Position target-range build (`index-9PMVYv2m.js`); the current comparison files replace those earlier snapshots. This audit made no gameplay changes.

## Current run

Refreshed `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/` and `public/` in `work/build-reproduction/`. The copied `src/` and `public/` directories were replaced completely so obsolete files could not remain. Input hashes are recorded in `work/build-reproduction/input-snapshot.json`.

The primary and isolated lockfiles matched byte-for-byte before refresh, so this run reused the isolated dependency installation from the earlier successful `npm ci`. It did not share the primary `node_modules` or rerun installation. The earlier install log remains `work/build-reproduction/npm-ci.log`.

From `work/build-reproduction/`:

```bash
npm run build > npm-build.log 2>&1
```

The original execution session `90535` completed with exit code **0**. This command ran TypeScript checking and Vite production bundling. Vite `7.3.6` produced `index-9PMVYv2m.js` (1,454.29 kB as rounded in the log). The environment used Node `v24.20.0` and npm `11.19.0`, as recorded during the initial isolated installation.

`work/build-reproduction/output-comparison.json` contains SHA-256 and size for all 67 isolated and primary production files. All matched. Primary source inputs changed between this refresh and the report check: [].

No primary source, dependency directory, production output or browser state was modified by this run. The root browser match could continue against its existing production files.

## Build and launch instructions

In the main project or a separate copy with a complete `public/assets/` directory:

```bash
npm ci
npm run build
npm run preview -- --port 4176 --strictPort
```

`npm ci` restores locked dependencies; `npm run build` produces `dist/`; the preview command serves that build at `http://127.0.0.1:4176/` until interrupted. The initial isolated installation exited 0 and installed 45 packages. It reported an unapproved esbuild postinstall warning, but the subsequent build succeeded under this machine's current package-manager policy and cache.

An earlier launch check of `index-DBgkXH8x.js` verified HTTP 200 and exact response bytes for HTML, JavaScript, CSS, the manifest and representative artwork. Its historical results remain in `work/build-reproduction/launch-check.json` and `preview.log`. **The launch check was not repeated for this refreshed build.** No preview server was started by the current run. The previous preview and RAF probe servers were stopped.

Generating Blender art is a separate operation documented in `docs/REGENERATING_ASSETS.md`, with measured reproduction evidence in `docs/evidence/ASSET_REPRODUCTION.md`.

## Current evidence hashes

| File | SHA-256 |
| --- | --- |
| `package-lock.json` | `22a61805eca0167e2b0a47aab1d10c8b24c5425d15f179322284485bf4544e09` |
| `work/build-reproduction/input-snapshot.json` | `1ea5343c28697d346a961a1a22d9d035eecc9be4d79c3a361594f5bbdb034ef7` |
| `work/build-reproduction/output-comparison.json` | `5dc880bfecaa1286812fe90bf4459a2e2dab8f91763e242d372007a69ad1a935` |
| `work/build-reproduction/npm-build.log` | `880b688b69dff4ef29cddceecbe9ca94f99516a8488af3ce9c4aec960e24747a` |
| `work/build-reproduction/dist/assets/index-9PMVYv2m.js` | `19212ce16b095ff3d80fb701548491faa22ac2a09524b5c64a01e9a844c57ba3` |

This result establishes byte-identical production output from a separate project directory using matching locked dependencies and current copied inputs on this machine. It does not establish fresh-machine installation behavior, cross-platform determinism, browser gameplay or current performance.
