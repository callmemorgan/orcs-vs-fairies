// src/server/canonical-campaign.ts
var runtime;
try {
  runtime = await import(new URL("./campaign-runtime.mjs", import.meta.url).href);
} catch {
  throw new Error("Canonical campaign verification is unavailable on this server.");
}
if (typeof runtime.verifyCanonicalCampaignVictory !== "function") throw new Error("Canonical campaign verification is unavailable on this server.");
var verifyCanonicalCampaignVictory = runtime.verifyCanonicalCampaignVictory;
export {
  verifyCanonicalCampaignVictory
};
