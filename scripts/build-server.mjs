import { build } from 'esbuild';
import { mkdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory=resolve(process.argv[2]??'dist-server');await mkdir(directory,{recursive:true});
await build({entryPoints:['src/server/main.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:resolve(directory,'rts-server.js')});
await build({entryPoints:['src/server/canonical-campaign.ts'],bundle:true,platform:'node',format:'esm',outfile:resolve(directory,'canonical-campaign.mjs')});
const campaign=resolve('src/core/campaign.ts'),runtime=resolve(directory,'campaign-runtime.mjs');
if(await stat(campaign).catch(error=>{if(error.code==='ENOENT')return null;throw error;}))await build({stdin:{contents:`export {verifyCanonicalCampaignVictory} from ${JSON.stringify(campaign)};`,resolveDir:process.cwd(),sourcefile:'canonical-campaign-runtime.ts'},bundle:true,platform:'node',format:'esm',outfile:runtime});
else await rm(runtime,{force:true});
