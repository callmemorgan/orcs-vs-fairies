// @vitest-environment happy-dom
import {expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
import GameScene from '../../src/game/GameScene';
import {createGame,isVisible} from '../../src/core/simulation';
function scene(visible:boolean){
 const state=createGame('orcs',4127,'fairies',{controllers:['external','external']});
 const source=state.entities.find(e=>e.side===1&&e.role==='melee')!,target=state.entities.find(e=>e.side===0&&e.role==='worker')!;
 state.visible[0].clear();if(visible)state.visible[0].add(Math.floor(source.y)*state.width+Math.floor(source.x));
 state.events=[{type:'attack',side:1,x:source.x,y:source.y,source:source.id,target:target.id,amount:5}];
 const scene=Object.create(GameScene.prototype) as any;
 Object.assign(scene,{state,audio:{playWeapon:vi.fn(),play:vi.fn()},options:{onNotice:vi.fn()},attackedNoticeAt:new Map(),buildingAlertAt:-Infinity,workerAlertAt:-Infinity,combatEffects:[],resultSoundPlayed:false});
 return {scene,source,target};
}
it('plays the visible attacker weapon through scene event consumption',()=>{
 const {scene}=sceneFixture(true);scene.processEvents();expect(scene.audio.playWeapon).toHaveBeenCalledWith('pike');
});
it('plays a neutral impact when an unseen attacker damages an owned worker',()=>{
 const {scene,source,target}=sceneFixture(false);expect(isVisible(scene.state,0,source.x,source.y)).toBe(false);expect(target.side).toBe(0);
 scene.processEvents();expect(scene.options.onNotice).toHaveBeenCalledWith('Workers under attack!');expect(scene.audio.playWeapon).toHaveBeenCalledWith('impact');
});
const sceneFixture=scene;
