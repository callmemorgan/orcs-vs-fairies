import Phaser from 'phaser';
import GameScene, { project, unproject } from './game/GameScene';
import { createPerformanceGame, countPerformanceUnits, FrameCollector, PERFORMANCE_CENTER } from './qa/performance';
import { createGame, issueCommand } from './core/simulation';
import { mountShell } from './ui/Hud';
import type { HudCallbacks } from './ui/Hud';
import type { FactionId, MapSize } from './core/types';
import './ui/style.css';

let game:Phaser.Game|undefined;
let scene:GameScene|undefined;
let retiring:Phaser.Game|undefined;
let faction:FactionId='orcs';
let opponent:FactionId='fairies';
const benchmark=location.hostname==='127.0.0.1'&&new URLSearchParams(location.search).get('benchmark')==='1';
let collector=new FrameCollector();
let benchmarkCentered=false;
let renderDensity=1;
const root=document.querySelector<HTMLElement>('#app')!;
const shell=mountShell(root,start);
const callbacks:HudCallbacks={
 build:role=>{scene?.setBuildRole(role);shell.notice('Choose a clear location on explored ground. Right-click to cancel.');},
 train:role=>{if(!scene)return;const id=scene.selected.find(id=>scene!.state.entities.some(e=>e.id===id&&e.side===0&&e.kind==='building'&&e.role===(role==='worker'?'hq':'barracks')));if(id===undefined||!issueCommand(scene.state,0,{type:'train',id,role}))shell.notice('Cannot recruit: check resources, population, and production building.');},
 cancelTrain:(id,index,expectedQueue)=>{if(!scene||scene.paused)return;const producer=scene.state.entities.find(e=>e.id===id);if(!producer||JSON.stringify(producer.queue)!==expectedQueue)return;if(issueCommand(scene.state,0,{type:'cancelTrain',id,index})){shell.update(scene.state,scene.selected,callbacks);shell.notice('Recruitment canceled. Resources refunded.');}},
 clearRally:()=>{if(scene&&!scene.paused&&issueCommand(scene.state,0,{type:'clearRally',ids:scene.selected}))shell.update(scene.state,scene.selected,callbacks);},
 ability:()=>{if(scene&&!issueCommand(scene.state,0,{type:'ability',ids:scene.selected}))shell.notice('No selected ability is ready or has an eligible target.');},
 hold:()=>{scene?.holdPosition();},
 attackMove:()=>scene?.beginAttackMove(),
 select:ids=>scene?.selectEntities(ids),
 stop:()=>{if(scene)issueCommand(scene.state,0,{type:'stop',ids:scene.selected});},
 pause:()=>{if(scene)scene.paused=!scene.paused;},
 restart:()=>{retireGame();shell.showMenu();},
 toggleMuted:()=>scene?.toggleMuted(),
 isMuted:()=>scene?.muted??false,
 center:(x,y)=>scene?.centerOn(x,y),
 groups:()=>scene?.controlGroups()??{},
 recallGroup:group=>scene?.recallGroup(group),
 cameraCorners:()=>{if(!scene?.cameras?.main)return [];const c=scene.cameras.main;const {top,bottom}=shell.battlefieldBounds();return [[0,top],[innerWidth,top],[innerWidth,bottom],[0,bottom]].map(([x,y])=>{const p=c.getWorldPoint(x*renderDensity,y*renderDensity);return unproject(p.x,p.y);});}

};
function retireGame(onDestroyed?:()=>void){
 if(retiring){retiring.events.once(Phaser.Core.Events.DESTROY,()=>onDestroyed?.());return;}
 if(!game){onDestroyed?.();return;}
 if(scene){scene.paused=true;scene.input.keyboard?.removeAllListeners('keydown');}
 const previous=game;game=undefined;scene=undefined;retiring=previous;
 previous.events.once(Phaser.Core.Events.DESTROY,()=>{if(retiring===previous)retiring=undefined;onDestroyed?.();});
 previous.destroy(true);
}
function start(next:FactionId,nextOpponent:FactionId=opponent,mapSize:MapSize="medium",seed=4127){
 if(game||retiring){retireGame(()=>start(next,nextOpponent,mapSize,seed));return;}
 faction=next;opponent=nextOpponent;shell.showGame();
 const state=benchmark?createPerformanceGame():createGame(faction,seed,opponent,{mapSize});
 if(benchmark){collector=new FrameCollector();benchmarkCentered=false;}
 // Phaser scales the canvas in CSS; use a physical-pixel game size and
 // matching camera zoom so high-DPI displays do not stretch a low-res buffer.
 renderDensity=Math.min(2,Math.max(1,window.devicePixelRatio||1));
 scene=new GameScene({state,pixelDensity:renderDensity,onSelection:ids=>shell.update(scene!.state,ids,callbacks),onNotice:text=>shell.notice(text),onReady:()=>shell.ready(),viewBounds:()=>{const b=shell.battlefieldBounds();return {top:b.top*renderDensity,bottom:b.bottom*renderDensity};}});
 game=new Phaser.Game({type:Phaser.AUTO,parent:'game-canvas',backgroundColor:'#14201e',antialias:true,roundPixels:false,scale:{mode:Phaser.Scale.FIT,width:Math.round(innerWidth*renderDensity),height:Math.round(innerHeight*renderDensity)},scene:[scene],render:{pixelArt:false,smoothPixelArt:true},fps:{target:60}});
 const currentGame=game,density=renderDensity;
 const resize=()=>currentGame.scale.setGameSize(Math.round(innerWidth*density),Math.round(innerHeight*density));
 window.addEventListener('resize',resize);
 currentGame.events.once(Phaser.Core.Events.DESTROY,()=>window.removeEventListener('resize',resize));
 if(benchmark)game.events.on('postrender',()=>{
  if(!scene||!game||!scene.cameras.main||scene.state.time<=0)return;
  if(!benchmarkCentered){scene.centerOn(PERFORMANCE_CENTER.x,PERFORMANCE_CENTER.y);benchmarkCentered=true;return;}
  const camera=scene.cameras.main,canvas=game.canvas,rect=canvas.getBoundingClientRect();
  const gl=game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer?game.renderer.gl:null;
  const phase=collector.record(performance.now(),{
   units:countPerformanceUnits(scene.state,e=>{const p=project(e.x,e.y);return camera.worldView.contains(p.x,p.y);}),
   viewport:{width:innerWidth,height:innerHeight},canvas:{width:rect.width,height:rect.height},
   drawingBuffer:{width:gl?.drawingBufferWidth??canvas.width,height:gl?.drawingBufferHeight??canvas.height},
   devicePixelRatio,renderDensity,documentVisible:document.visibilityState==='visible',artLoaded:scene.artStatus.loaded&&scene.artStatus.assets===70&&scene.artStatus.renderedUnits===100,paused:scene.paused
  });
  if(phase==='complete')scene.paused=true;
 });
 shell.update(state,[],callbacks);
}
setInterval(()=>{if(scene)shell.update(scene.state,scene.selected,callbacks);},100);
// Read-only diagnostics for repeatable performance and state inspection. Player actions stay in the UI.
Object.defineProperty(window,'rts',{get:()=>scene?{state:scene.state,selected:[...scene.selected],fps:game?.loop.actualFps,paused:scene.paused,camera:{x:scene.cameras.main.scrollX,y:scene.cameras.main.scrollY,zoom:scene.cameras.main.zoom}}:null});
if(location.hostname==='127.0.0.1'&&new URLSearchParams(location.search).has('qa'))setInterval(()=>{
 if(!scene||!game)return;
 const s=scene.state;
 void fetch('/__qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({at:new Date().toISOString(),time:s.time,fps:game.loop.actualFps,viewport:{width:innerWidth,height:innerHeight},drawingBuffer:{width:game.canvas.width,height:game.canvas.height},renderDensity,art:scene.artStatus,audio:scene.audioStatus,camera:{x:scene.cameras.main.scrollX,y:scene.cameras.main.scrollY,zoom:scene.cameras.main.zoom},benchmark:benchmark?collector.summary():undefined,paused:scene.paused,mapSize:s.mapSize,seed:s.seed,draw:s.draw,winner:s.winner,selected:scene.selected,players:s.players,entities:s.entities.map(({path,...e})=>e),resources:s.resources,visible:s.visible.map(x=>x.size)})}).catch(()=>{});
},5000);
if(benchmark){
 const status=document.createElement('div');status.id='benchmark-status';status.style.cssText='position:fixed;top:90px;left:50%;transform:translateX(-50%);z-index:9999;background:#101c18;color:#eee;padding:12px;pointer-events:none';document.body.append(status);
 setInterval(()=>{const r=collector.summary();status.textContent=`SYNTHETIC BENCHMARK · 100 units · ${r.phase} · ${r.averageFps?.toFixed(1)??'—'} FPS${r.phase==='complete'?(r.valid?' · valid sample':' · INVALID: '+r.invalidReasons.join('; ')):''}`;},1000);
 start('orcs');
}
