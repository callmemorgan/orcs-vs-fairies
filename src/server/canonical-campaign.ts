import type { CampaignVictoryVerifier } from './campaign-verification';

// This sibling bundle is built from the same integrated core as the client.
let runtime:{verifyCanonicalCampaignVictory?:CampaignVictoryVerifier};
try{runtime=await import(new URL('./campaign-runtime.mjs',import.meta.url).href);}
catch{throw new Error('Canonical campaign verification is unavailable on this server.');}
if(typeof runtime.verifyCanonicalCampaignVictory!=='function')throw new Error('Canonical campaign verification is unavailable on this server.');
export const verifyCanonicalCampaignVictory:CampaignVictoryVerifier=runtime.verifyCanonicalCampaignVictory;
