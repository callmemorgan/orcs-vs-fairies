// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
import GameScene from '../src/game/GameScene';
import {createGame} from '../src/core/simulation';
import {dispatchPlayerCommand,registerPlayerCommandObserver,registerPlayerCommandInterceptor} from '../src/game/commands';
import type { Command } from '../src/core/types';
import {mountImprovementHost} from '../src/improvements/host';
import { observeFactionCommands } from '../src/improvements/accessibility/factionAcknowledgments';
import { FACTION_ACKNOWLEDGMENTS } from '../src/improvements/accessibility/factionVoice';
const disposers:Array<()=>void>=[];
afterEach(()=>{for(const dispose of disposers.splice(0))dispose();document.body.replaceChildren();});
it('acknowledges one accepted dispatched action and rejects enemy/paused/intercepted actions',()=>{
 const state=createGame('orcs');const worker=state.entities.find(e=>e.side===0&&e.role==='worker')!,enemy=state.entities.find(e=>e.side===1)!;
 const scene={state,paused:false},other={state:createGame('fairies'),paused:false};const voice=vi.fn();
 disposers.push(registerPlayerCommandObserver(source=>{if(source===scene)voice();}));
 expect(dispatchPlayerCommand(scene,{type:'hold',ids:[worker.id]})).toBe(true);expect(worker.order.type).toBe('hold');expect(voice).toHaveBeenCalledTimes(1);
 expect(dispatchPlayerCommand(scene,{type:'hold',ids:[enemy.id]})).toBe(false);scene.paused=true;expect(dispatchPlayerCommand(scene,{type:'stop',ids:[worker.id]})).toBe(false);expect(voice).toHaveBeenCalledTimes(1);scene.paused=false;
 dispatchPlayerCommand(other,{type:'stop',ids:[other.state.entities.find(e=>e.side===0&&e.kind==='unit')!.id]});expect(voice).toHaveBeenCalledTimes(1);
 disposers.push(registerPlayerCommandInterceptor(()=>true));expect(dispatchPlayerCommand(scene,{type:'stop',ids:[worker.id]})).toBe(true);expect(voice).toHaveBeenCalledTimes(1);expect(worker.order.type).toBe('hold');
});
it('routes host commands through that same accepted-action observer once',()=>{
 const state=createGame('fairies');const scene={state,paused:false,selected:[],selectEntities:()=>{},centerOn:()=>{}};const root=document.createElement('div');root.innerHTML='<div class="menu-content"></div><div class="war-hud"></div>';let command!:(command:Command)=>boolean;
 const heard=vi.fn();disposers.push(registerPlayerCommandObserver(source=>{if(source===scene)heard();}));
 const host=mountImprovementHost(root,[{id:'voice-test',mount:context=>{command=context.command;return {};}}],{current:()=>scene,notice:()=>{},setPaused:value=>{scene.paused=value;}});disposers.push(host.dispose);
 const worker=state.entities.find(e=>e.side===0&&e.role==='worker')!;expect(command({type:'hold',ids:[worker.id]})).toBe(true);expect(heard).toHaveBeenCalledTimes(1);expect(worker.order.type).toBe('hold');
});
it('only changed selections containing owned entities play the selected faction acknowledgment',()=>{
 const state=createGame('tideborn');const own=state.entities.find(e=>e.side===0&&e.kind==='unit')!,enemy=state.entities.find(e=>e.side===1)!;const scene=Object.create(GameScene.prototype) as any;Object.assign(scene,{state,selected:[],audio:{playAcknowledgment:vi.fn()},options:{onSelection:vi.fn()}});
 scene.select([own.id]);scene.select([own.id]);scene.select([enemy.id]);scene.select([]);expect(scene.audio.playAcknowledgment).toHaveBeenCalledExactlyOnceWith('tideborn','selection');
});
it('defines six distinct synthetic formants and separate selection/order calls',()=>{expect(new Set(Object.values(FACTION_ACKNOWLEDGMENTS).map(calls=>JSON.stringify(calls.selection))).size).toBe(6);for(const calls of Object.values(FACTION_ACKNOWLEDGMENTS)){expect(calls.order).toHaveLength(2);expect(calls.selection[0].formant).toBeGreaterThan(0);}});

it('tears down scene acknowledgment and audio once across shutdown/destroy',()=>{
 const state=createGame('dwarves'),scene={state,paused:false},audio={playAcknowledgment:vi.fn(),dispose:vi.fn()},worker=state.entities.find(e=>e.side===0&&e.role==='worker')!;
 const cleanup=observeFactionCommands(scene,audio);disposers.push(cleanup);
 dispatchPlayerCommand(scene,{type:'hold',ids:[worker.id]});expect(audio.playAcknowledgment).toHaveBeenCalledExactlyOnceWith('dwarves','order');
 cleanup();cleanup();dispatchPlayerCommand(scene,{type:'stop',ids:[worker.id]});expect(worker.order.type).toBe('idle');expect(audio.playAcknowledgment).toHaveBeenCalledTimes(1);expect(audio.dispose).toHaveBeenCalledTimes(1);
});
