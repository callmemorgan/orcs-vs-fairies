import { registerPlayerCommandObserver, type CommandScene } from '../../game/commands';
import type GameAudio from '../../game/GameAudio';
/** One observer per scene, with the same disposal callback for shutdown and destruction. */
export function observeFactionCommands(scene:CommandScene,audio:Pick<GameAudio,'playAcknowledgment'|'dispose'>){
 const stop=registerPlayerCommandObserver(source=>{if(source===scene)audio.playAcknowledgment(scene.state.players[scene.viewSide??0].faction,'order');});
 let disposed=false;
 return ()=>{if(disposed)return;disposed=true;stop();audio.dispose();};
}
