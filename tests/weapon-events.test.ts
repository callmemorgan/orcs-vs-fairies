// @vitest-environment happy-dom
import {expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
import GameScene from '../src/game/GameScene';
import {createGame,isVisible} from '../src/core/simulation';
function fixture(visibleSource:boolean,ownedTarget=true,visibleTarget=false){
 const state=createGame('orcs',4127,'fairies',{controllers:['external','external']});
 const source=state.entities.find(e=>e.side===1&&e.role==='melee')!,target=state.entities.find(e=>e.side===(ownedTarget?0:1)&&e.role==='worker')!;
 state.visible[0].clear();if(visibleSource)state.visible[0].add(Math.floor(source.y)*state.width+Math.floor(source.x));if(visibleTarget)state.visible[0].add(Math.floor(target.y)*state.width+Math.floor(target.x));
 state.events=[{type:'attack',side:1,x:source.x,y:source.y,source:source.id,target:target.id,amount:5}];
 const scene=Object.create(GameScene.prototype) as any;
 Object.assign(scene,{state,audio:{playWeapon:vi.fn(),play:vi.fn()},options:{onNotice:vi.fn()},attackedNoticeAt:new Map(),buildingAlertAt:-Infinity,workerAlertAt:-Infinity,combatEffects:[],resultSoundPlayed:false});
 return {scene,source,target};
}
it('consumes visible attacks with their weapon-specific sound',()=>{const {scene}=fixture(true);scene.processEvents();expect(scene.audio.playWeapon).toHaveBeenCalledExactlyOnceWith('pike');});
it('acknowledges an owned victim with neutral impact without revealing its hidden attacker',()=>{const {scene,source}=fixture(false);expect(isVisible(scene.state,0,source.x,source.y)).toBe(false);scene.processEvents();expect(scene.audio.playWeapon).toHaveBeenCalledExactlyOnceWith('impact');expect(scene.options.onNotice).toHaveBeenCalledWith('Workers under attack!');expect(scene.combatEffects).toHaveLength(0);});
it('gives a visible victim neutral impact but hides wholly unobserved fighting',()=>{const visible=fixture(false,false,true);visible.scene.processEvents();expect(visible.scene.audio.playWeapon).toHaveBeenCalledExactlyOnceWith('impact');const hidden=fixture(false,false,false);hidden.scene.processEvents();expect(hidden.scene.audio.playWeapon).not.toHaveBeenCalled();});
