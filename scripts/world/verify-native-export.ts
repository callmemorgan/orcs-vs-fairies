import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {decodeSessionFile,createSessionFile} from '../../src/core/session-storage';
import {saveGame,SAVE_VERSION} from '../../src/core/saves';
import {ReplayPlayer,MatchRecorder} from '../../src/core/replays';
import {stepGame} from '../../src/core/simulation';
import {SIMULATION_REVISION} from '../../src/core/versions';
import {worldSourceProof,worldBundleProof,sha,checkCurrentSession} from './proof-common.mjs';

const inputPath=process.argv[2],outputPath=process.argv[3];assert(inputPath&&outputPath,'Pass native session JSON, new report JSON and optional full source pin');
const provenance=await worldSourceProof(process.argv[4]),bundle=worldBundleProof(provenance),bytes=readFileSync(inputPath),input=JSON.parse(bytes.toString());checkCurrentSession(input,provenance);
assert.equal(SAVE_VERSION,provenance.saveVersion);assert.equal(SIMULATION_REVISION,provenance.simulationRevision);
const decoded=decodeSessionFile(bytes.toString());assert.deepEqual(decoded.file.game,input.game);assert.deepEqual(saveGame(decoded.state),input.game);
const player=new ReplayPlayer(input.replay);let continuationRecorder:MatchRecorder|undefined;
try {
 const initialTick=player.state.tick,advanced=player.advance(input.replay.finalTick-initialTick);assert(player.finished);assert.deepEqual(saveGame(player.state),input.game);
 const restored=decodeSessionFile(bytes.toString()).state;continuationRecorder=new MatchRecorder(decoded.state,input.replay);
 for(let i=0;i<20;i++){stepGame(decoded.state,.05);stepGame(restored,.05);assert.deepEqual(saveGame(decoded.state),saveGame(restored));}
 const continued=createSessionFile(decoded.state,continuationRecorder.export()),continuationPlayer=new ReplayPlayer(continued.replay);
 try{continuationPlayer.advance(continued.replay!.finalTick-continuationPlayer.state.tick);assert(continuationPlayer.finished);assert.deepEqual(saveGame(continuationPlayer.state),continued.game);}finally{continuationPlayer.dispose();}
 assert.deepEqual(await worldSourceProof(provenance.sourcePin),provenance,'Source changed during native proof');
 const continuedTicks=decoded.state.tick-input.game.state.tick,result={input:inputPath,inputSha256:sha(bytes),provenance,bundle,checker:{path:'scripts/world/verify-native-export.ts',sha256:sha(readFileSync('scripts/world/verify-native-export.ts'))},nativeDecoderPassed:true,completeEnvelopeRoundtripPassed:true,completeReplayEnvelopePassed:true,identicalContinuationSteps:20,identicalContinuedTicks:continuedTicks,continuedReplayEnvelopePassed:true,initialTick,advanced,finalTick:input.game.state.tick,continuedTick:decoded.state.tick,saveVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION};
 writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({input:inputPath,sourcePin:provenance.sourcePin,saveVersion:SAVE_VERSION,simulationRevision:SIMULATION_REVISION,finalTick:input.game.state.tick,identicalContinuedTicks:continuedTicks,completeReplayEnvelopePassed:true}));
}finally{continuationRecorder?.dispose();player.dispose();}
