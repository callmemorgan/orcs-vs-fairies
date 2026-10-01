import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeSessionFile, createSessionFile } from '@ovf/core/session-storage';
import { MatchRecorder, ReplayPlayer, replayChecksum } from '@ovf/core/replays';
import { saveGame, SAVE_VERSION } from '@ovf/core/saves';
import { SIMULATION_REVISION } from '@ovf/core/versions';
import { authenticate, productProvenance, sha256, writeJson } from './provenance';

const [endpointPath,outputPath,pin,manifestPath,checkpointPath] = process.argv.slice(2);
assert(endpointPath && outputPath && pin && manifestPath, 'Usage: node validator.mjs <endpoint> <receipt> <pin> <build-manifest> [command-checkpoint]');
const startedAt=new Date().toISOString(),start=performance.now();
const inputs=[endpointPath,...(checkpointPath?[checkpointPath]:[])];
let provenance:ReturnType<typeof authenticate>|undefined;
const verified:Array<Record<string,unknown>>=[];
try {
  provenance=authenticate(pin,manifestPath,'validator');
  assert.equal(SAVE_VERSION,4); assert.equal(SIMULATION_REVISION,'4.0.1');
  for(const path of inputs) {
    const bytes=readFileSync(path),input=JSON.parse(bytes.toString('utf8'));
    assert.equal(input.game?.version,4); assert(input.replay);
    assert.equal(input.replay.initial?.version,4); assert.equal(input.replay.checksumVersion,4);
    assert.equal(input.replay.simulationRevision,'4.0.1');
    const decoded=decodeSessionFile(bytes.toString('utf8'));
    assert.deepEqual(decoded.file,input,'Complete decoded session must equal original emitted session');
    assert.deepEqual(saveGame(decoded.state),input.game,'Complete resaved game/runtime must equal original envelope');
    const recorder=new MatchRecorder(decoded.state);
    try {
      const currentReplay=recorder.export(),session=createSessionFile(decoded.state,currentReplay);
      assert.equal(input.format,session.format); assert.equal(input.version,session.version);
      assert.equal(input.replay.format,currentReplay.format); assert.equal(input.replay.version,currentReplay.version);
    } finally {recorder.dispose();}
    const player=new ReplayPlayer(input.replay);
    let replayedTicks=0;
    try {
      replayedTicks=player.advance(input.replay.finalTick-player.state.tick);
      assert(player.finished,'Replay must consume all recorded commands and steps');
      assert.equal(player.state.tick,input.game.state.tick);
      assert.equal(replayChecksum(player.state),input.replay.finalChecksum);
      assert.deepEqual(saveGame(player.state),input.game,'Full replay game/runtime endpoint must equal original envelope');
      assert.deepEqual(player.analysis,input.replay.analysis);
      assert.deepEqual(player.technologyTimings,input.replay.technologies);
    } finally {player.dispose();}
    verified.push({path:resolve(path),bytes:bytes.length,sha256:sha256(bytes),tick:input.game.state.tick,replayedTicks,finalChecksum:input.replay.finalChecksum,completeDecoderSessionEqual:true,completeResaveEnvelopeEqual:true,completeReplayEnvelopeEqual:true,analysisEqual:true,technologyTimingsEqual:true,continuation:'outside-feature53-probe'});
  }
  assert.deepEqual(productProvenance(pin),provenance.product,'Frozen source/config changed during validation');
  writeJson(outputPath,{status:'passed',sourcePin:pin,startedAt,finishedAt:new Date().toISOString(),wallSeconds:(performance.now()-start)/1000,provenance,verified,continuation:'not-run; no survival gate'});
  process.stdout.write(JSON.stringify({status:'passed',receipt:resolve(outputPath),verifiedSessions:verified.length})+'\n');
} catch(error) {
  const failure=error instanceof Error?{name:error.name,message:error.message}:{message:String(error)};
  writeJson(outputPath,{status:'unmet',sourcePin:pin,startedAt,finishedAt:new Date().toISOString(),wallSeconds:(performance.now()-start)/1000,provenance:provenance??null,verified,failure,continuation:'not-run'});
  process.stderr.write(JSON.stringify(failure)+'\n'); process.exitCode=1;
}
