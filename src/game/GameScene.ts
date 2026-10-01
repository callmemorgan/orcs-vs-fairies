import Phaser from 'phaser';
import ArtRuntime from './ArtRuntime';
import GameAudio from './GameAudio';
import type { Side, GameState, BuildingRole, Command, Entity, UnitRole } from '../core/types';
import { canPlace, isHostile, isVisible, issueCommand, stepGame } from '../core/simulation';
import { PlayerView } from '../core/observation';
import { buildingFor, entityDefinition, factionFor, unitFor } from '../core/content-registry';
import { elevationAt, fogKey, levelOf } from '../core/world-map';
import { terrainAt } from '../core/maps';
import { ControlProfiles, inputIsSuppressed } from './Controls';
import type { ControlAction, KeyboardState } from './Controls';
import { GamepadController } from './Gamepad';
import { applyOnlineRenderState } from '../online/render-state';
import type { OnlineRenderState } from '../online/render-state';
import type { ConstructionBlueprint } from '../core/planning';
import type { GameEvent, Vec } from '../core/types';
import { AppearancePreferences, appearancePreferences, markerPolygon, ownershipStyle } from './Appearance';

const TILE_W = 64, TILE_H = 32, OX = 1600, OY = 80;
const CAMERA_TAP:Partial<Record<ControlAction,readonly [number,number]>> = {
  cameraLeft:[-1,0],cameraRight:[1,0],cameraUp:[0,-1],cameraDown:[0,1],
};
export function project(x:number,y:number) { return {x:OX+(x-y)*TILE_W/2,y:OY+(x+y)*TILE_H/2}; }
export function unproject(x:number,y:number) { return {x:((x-OX)/32+(y-OY)/16)/2,y:((y-OY)/16-(x-OX)/32)/2}; }
export interface GameSceneOptions {
  pixelDensity?:number;state:GameState;onSelection:(ids:number[])=>void;onNotice:(text:string)=>void;onReady?:()=>void;viewBounds?:()=>{top:number;bottom:number};
  controls?:ControlProfiles;appearance?:AppearancePreferences;viewSide?:Side;readOnly?:boolean;simulationEnabled?:boolean;remoteFrame?:OnlineRenderState;
  onCommand?:(side:Side,command:Command)=>boolean;onStep?:(state:GameState)=>void;onPhotoMode?:(enabled:boolean)=>void;onPause?:(paused:boolean)=>void;onActionSlot?:(slot:number)=>void;
}
export default class GameScene extends Phaser.Scene {
  public state:GameState;
  public selected:number[]=[];
  public buildRole:BuildingRole|null=null;
  public buildDefinitionId:string|undefined;
  public paused=false;
  private options:GameSceneOptions;
  public readonly controls:ControlProfiles;
  public readonly appearance:AppearancePreferences;
  public readOnly=false;
  public simulationEnabled=true;
  public inputBlocked=false;
  private _viewSide:Side=0;
  public viewLevel=0;
  private groundSignature='';
  public setViewLevel(level:number){if(!Number.isInteger(level)||level<0||level>=(this.state.world?.levels.length??1))throw new Error('Unknown map level.');if(this.viewLevel===level)return;this.viewLevel=level;this.select([]);if(this.ground){this.drawGround();this.drawActors();this.drawFog();}this.events.emit('viewlevel',level);}
  private _photoMode=false;
  private photoPreviousPause=false;
  private art!:ArtRuntime;
  private playerView=new PlayerView(0);
  private audio?:GameAudio;
  private resultSoundPlayed=false;
  public get muted(){return this.audio?.muted??false;}
  public toggleMuted(){return this.audio?.toggleMuted()??false;}
  public get audioStatus(){return this.audio?.status??{state:'locked',muted:false};}
  public get artStatus(){return {enabled:this.art?.enabled??false,loaded:this.art?.loaded??false,assets:this.art?.assetCount??0,loadedAtlasPages:this.art?.loadedAtlasPages??0,decodedAtlasMiB:this.art?.decodedAtlasMiB??0,renderedUnits:this.art?.renderedUnits??0};}
  private ground!:Phaser.GameObjects.Graphics;
  private actors!:Phaser.GameObjects.Graphics;
  private fog!:Phaser.GameObjects.Graphics;
  private overlay!:Phaser.GameObjects.Graphics;
  private heldKeys=new Set<string>();
  private queuedPointerModifiers=new WeakMap<Event,boolean>();
  private keyboardState:KeyboardState={codes:this.heldKeys,ctrl:false,meta:false,alt:false,shift:false};
  private controller=new GamepadController();
  private controllerCursor:{x:number;y:number}|null=null;
  private controllerActive=false;
  public gamepadConnected=false;
  private groups:Record<string,number[]>={};
  private drag:{x:number;y:number;wx:number;wy:number}|null=null;
  private pan:{x:number;y:number}|null=null;
  private attackMode=false;
  private accumulated=0;
  private fogClock=0;
  private attackedNoticeAt=new Map<number,number>();
  private buildingAlertAt=-Infinity;
  private workerAlertAt=-Infinity;
  private combatEffects:{from:{x:number;y:number};to:{x:number;y:number};born:number;color:number;heavy:boolean}[]=[];
  private markers:{x:number;y:number;born:number;attack:boolean}[]=[];
  private remoteFrame:OnlineRenderState|undefined;
  private remoteEventTick=-1;
  private blueprints:readonly ConstructionBlueprint[]=[];
  private blueprintSide:Side=0;
  private blueprintPlacement:{role:BuildingRole;point:(point:Vec)=>void;cancel:()=>void}|undefined;
  constructor(options:GameSceneOptions) {super({key:'world'});this.options=options;this.state=options.state;this.viewLevel=levelOf(options.state.starts[options.viewSide??0]);this.controls=options.controls??new ControlProfiles();this.appearance=options.appearance??appearancePreferences;this._viewSide=options.viewSide??0;this.playerView=new PlayerView(this._viewSide);this.readOnly=options.readOnly??false;this.simulationEnabled=options.simulationEnabled??true;this.remoteFrame=options.remoteFrame;if(this.remoteFrame)this.remoteEventTick=this.state.tick;}
  public get remote(){return !!this.remoteFrame;}
  public get canIssueCommands(){return this.canCommand;}
  public applyRemoteFrame(frame:OnlineRenderState){
    if(!this.remote||frame.localSide!==this.viewSide)throw new Error('Online frame has a different match perspective.');
    const terrainChanged=this.state.terrain.some((tile,i)=>tile!==frame.state.terrain[i]);
    applyOnlineRenderState(this.state,frame);this.remoteFrame=frame;
    const events=frame.observedEvents.filter(event=>event.tick>this.remoteEventTick);
    if(this.actors){if(terrainChanged)this.drawGround();this.processEvents(events.map(event=>({type:event.type as GameEvent['type'],x:event.x,y:event.y,side:event.side??this.viewSide,source:event.source,target:event.target,text:event.text,amount:event.amount,resource:event.resource as GameEvent['resource']})));this.drawFog();}
    this.remoteEventTick=Math.max(this.remoteEventTick,frame.state.tick);
  }
  public setBlueprints(items:readonly ConstructionBlueprint[],side:Side){this.blueprints=items.map(item=>({...item,workerIds:[...item.workerIds]}));this.blueprintSide=side;}
  public beginBlueprintPlacement(role:BuildingRole,point:(point:Vec)=>void,cancel:()=>void):()=>void {
    this.cancelBlueprintPlacement();this.setBuildRole(null);this.blueprintPlacement={role,point,cancel};
    return ()=>this.cancelBlueprintPlacement();
  }
  private cancelBlueprintPlacement(){const pending=this.blueprintPlacement;this.blueprintPlacement=undefined;pending?.cancel();}
  private placeBlueprint(pos:Vec):boolean {
    const pending=this.blueprintPlacement;if(!pending)return false;
    this.blueprintPlacement=undefined;pending.point({x:pending.role==='gate'?Math.round(pos.x):Math.floor(pos.x)+.5,y:pending.role==='gate'?Math.round(pos.y):Math.floor(pos.y)+.5});return true;
  }
  public get viewSide(){return this._viewSide;}
  public set viewSide(side:Side){if(!Number.isInteger(side)||!this.state.players[side])throw new Error('Perspective must identify a player in this match.');if(this._viewSide===side)return;this._viewSide=side;this.playerView=new PlayerView(side);this.groups={};this.select([]);if(this.fog)this.drawFog();}
  public get photoMode(){return this._photoMode;}
  public setPhotoMode(enabled:boolean){
    if(this._photoMode===enabled)return;
    if(enabled){this.photoPreviousPause=this.paused;this.paused=true;this.setBuildRole(null);this.drag=null;this.pan=null;}
    else this.paused=this.photoPreviousPause;
    this._photoMode=enabled;this.options.onPhotoMode?.(enabled);this.options.onPause?.(this.paused);this.events.emit('photomode',enabled);
    if(this.actors){this.drawActors();this.drawOverlay();}
  }
  public togglePause(){if(this.remote){this.options.onNotice('The online match clock keeps running.');return;}if(this.photoMode||this.state.winner!==null||this.state.draw)return;this.paused=!this.paused;this.options.onPause?.(this.paused);}
  public command(command:Command):boolean {if(!this.canCommand)return false;return this.options.onCommand?.(this.viewSide,command)??issueCommand(this.state,this.viewSide,command);}
  private get canCommand(){return !this.readOnly&&!this.photoMode&&!this.inputBlocked&&!this.paused&&!this.state.eliminated[this.viewSide]&&this.state.winner===null&&!this.state.draw;}
  private get controlContext(){return {selected:!!this.selected.length,playable:!this.photoMode&&(this.readOnly||!this.paused&&this.state.winner===null&&!this.state.draw)};}
  private inputSuppressed(target:EventTarget|null=document.activeElement){const modal=!!document.querySelector('dialog[open],.session-overlay:not([hidden]) [role="dialog"]')||Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]:not(dialog)')).some(element=>!element.closest('[hidden]'));return this.inputBlocked||inputIsSuppressed(target,modal);}
  private queueModifier(event?:{shiftKey?:boolean;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean}){
    if(!event)return this.controls.isHeld('queueModifier',this.keyboardState,this.controlContext);
    const captured=this.queuedPointerModifiers.get(event as Event);if(captured!==undefined)return captured;
    const codes=new Set(this.heldKeys);
    for(const [modifier,held] of [['Shift',event.shiftKey],['Control',event.ctrlKey],['Meta',event.metaKey],['Alt',event.altKey]] as const)if(held){codes.add(`${modifier}Left`);codes.add(`${modifier}Right`);}
    return this.controls.isHeld('queueModifier',{codes,shift:!!event.shiftKey,ctrl:!!event.ctrlKey,meta:!!event.metaKey,alt:!!event.altKey},this.controlContext);
  }
  private get pixelDensity(){return this.options.pixelDensity??1;}
  private get dragThreshold(){return 6*this.pixelDensity;}
  preload(){this.art=new ArtRuntime(this,new URLSearchParams(location.search).get('art')!=='placeholder');this.art.preload(this.state.players.map(p=>p.faction),this.state.content);}
  create() {
    const audio=this.audio=new GameAudio(),canvas=this.game.canvas,lifecycle=this.events;
    this.art.ready();
    if(this.art.enabled&&!this.art.loaded)this.options.onNotice('Artwork could not load. Check that the local server is running, then restart the match.');
    this.cameras.main.setBackgroundColor('#131f22');
    this.ground=this.add.graphics().setDepth(-101);this.actors=this.add.graphics().setDepth(0);this.fog=this.add.graphics().setDepth(100000);this.overlay=this.add.graphics().setDepth(100001);
    this.drawGround();
    this.cameras.main.setBounds(OX-this.state.height*32-64,-80,(this.state.width+this.state.height)*32+128,(this.state.width+this.state.height)*16+320).setZoom(this.pixelDensity);
    this.centerOn(this.state.starts[this.viewSide].x,this.state.starts[this.viewSide].y);
    this.input.mouse?.disableContextMenu();
    const keydown=(e:KeyboardEvent)=>this.key(e),keyup=(e:KeyboardEvent)=>{this.heldKeys.delete(e.code);this.updateModifiers(e);};
    window.addEventListener('keydown',keydown);
    window.addEventListener('keyup',keyup);
    // Phaser dispatches pointer input later; remember the modifier at the native event.
    const captureQueue=(event:Event)=>this.queuedPointerModifiers.set(event,this.queueModifier(event as MouseEvent));
    for(const type of ['mousedown','mouseup','touchstart','touchend'])this.game.canvas.addEventListener(type,captureQueue,true);
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
      if(this.inputSuppressed())return;
      if(p.middleButtonDown()){this.drag=null;this.pan={x:p.x,y:p.y};return;}
      this.controllerActive=false;
      if(this.photoMode||this.inputSuppressed()||!this.controlContext.playable)return;
      if(p.rightButtonDown()){this.order(p);return;}
      const world=this.cameras.main.getWorldPoint(p.x,p.y);this.drag={x:p.x,y:p.y,wx:world.x,wy:world.y};
    });
    this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{
      if(this.inputSuppressed()){this.pan=null;return;}
      if(!this.pan)return;
      if(!p.middleButtonDown()){this.pan=null;return;}
      const c=this.cameras.main;c.scrollX-=(p.x-this.pan.x)/c.zoom;c.scrollY-=(p.y-this.pan.y)/c.zoom;this.pan={x:p.x,y:p.y};
    });
    this.input.on('pointerup',(p:Phaser.Input.Pointer)=>{
      if(p.button===1){this.pan=null;return;}
      if(p.button!==0||!this.drag)return;
      const drag=this.drag;this.drag=null;const world=this.cameras.main.getWorldPoint(p.x,p.y);
      if(this.photoMode||this.inputSuppressed()||!this.controlContext.playable)return;
      const pos=unproject(world.x,world.y);
      if(this.placeBlueprint(pos))return;
      if(this.buildRole){
        const role=this.buildRole;
        if(this.command({type:'build',ids:this.selected,role,definitionId:this.buildDefinitionId,x:role==='gate'?Math.round(pos.x):Math.floor(pos.x)+.5,y:role==='gate'?Math.round(pos.y):Math.floor(pos.y)+.5,level:this.viewLevel})) {this.setBuildRole(null);this.options.onNotice('Construction ordered.');this.audio?.play('order');}
        else this.options.onNotice('Cannot build here. Select a worker and check resources and space.');
        return;
      }
      if(this.attackMode){this.attackMode=false;this.order(p,true);return;}
      let ids:number[]=[];
      if(Math.hypot(p.x-drag.x,p.y-drag.y)>this.dragThreshold){
        const x1=Math.min(drag.wx,world.x),x2=Math.max(drag.wx,world.x),y1=Math.min(drag.wy,world.y),y2=Math.max(drag.wy,world.y);
        ids=this.state.entities.filter(e=>{const q=project(e.x,e.y);return e.side===this.viewSide&&this.visible(e)&&e.kind==='unit'&&e.hp>0&&q.x>=x1&&q.x<=x2&&q.y>=y1&&q.y<=y2;}).map(e=>e.id);
      } else {const hit=this.hit(world.x,world.y);if(hit?.side===this.viewSide)ids=[hit.id];}
      if(this.queueModifier(this.input.activePointer.event))ids=[...new Set([...this.selected,...ids])];
      this.select(ids);
    });
    const clearPointerDrag=()=>{this.pan=null;this.drag=null;this.heldKeys.clear();this.keyboardState={codes:this.heldKeys,ctrl:false,meta:false,alt:false,shift:false};this.controller.reset();this.controllerActive=false;};
    this.input.on('pointerupoutside',clearPointerDrag);
    window.addEventListener('blur',clearPointerDrag);
    this.input.on('wheel',(_p:Phaser.Input.Pointer,_o:unknown,_dx:number,dy:number)=>{
      if(this.inputSuppressed())return;
      this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom-dy*.001*this.pixelDensity,0.55*this.pixelDensity,1.8*this.pixelDensity));
    });
    let cleaned=false;
    const cleanup=()=>{
      if(cleaned)return;cleaned=true;
      lifecycle.off(Phaser.Scenes.Events.SHUTDOWN,cleanup);lifecycle.off(Phaser.Scenes.Events.DESTROY,cleanup);
      window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clearPointerDrag);
      for(const type of ['mousedown','mouseup','touchstart','touchend'])canvas.removeEventListener(type,captureQueue,true);
      clearPointerDrag();this.controllerCursor=null;this.gamepadConnected=false;audio.dispose();
      this.cancelBlueprintPlacement();this.blueprints=[];
      if(this.photoMode){this._photoMode=false;this.paused=this.photoPreviousPause;this.options.onPhotoMode?.(false);this.options.onPause?.(this.paused);}
    };
    lifecycle.once(Phaser.Scenes.Events.SHUTDOWN,cleanup);lifecycle.once(Phaser.Scenes.Events.DESTROY,cleanup);
    this.drawFog();
    this.options.onReady?.();
  }
  public controlGroups(){return Object.fromEntries(Object.entries(this.groups).map(([key,ids])=>[key,ids.filter(id=>this.state.entities.some(e=>e.id===id&&e.hp>0&&this.visible(e)))]));}
  public recallGroup(key:string){const ids=this.controlGroups()[key];if(ids?.length)this.select(ids);}
  public selectEntities(ids:number[]){const first=this.state.entities.find(e=>ids.includes(e.id)&&e.side===this.viewSide&&e.hp>0);if(first&&levelOf(first)!==this.viewLevel)this.setViewLevel(levelOf(first));this.select(ids.filter(id=>this.state.entities.some(e=>e.id===id&&e.hp>0&&this.visible(e))));}
  public beginAttackMove(){if(!this.canCommand||!this.selected.length)return;this.attackMode=true;this.buildRole=null;this.options.onNotice('Attack move: click a destination.');}
  public setBuildRole(role:BuildingRole|null,definitionId?:string){this.buildRole=role&&this.canCommand?role:null;this.buildDefinitionId=this.buildRole?definitionId:undefined;this.attackMode=false;}
  public centerOn(x:number,y:number){const q=project(x,y),camera=this.cameras.main;camera.centerOn(q.x,q.y);const bounds=this.photoMode?undefined:this.options.viewBounds?.();if(bounds)camera.scrollY+=(camera.height/2-(bounds.top+bounds.bottom)/2)/camera.zoom;}
  public restart(state:GameState){this.setPhotoMode(false);this.audio?.reset();this.resultSoundPlayed=false;this.art.reset();this.state=state;this.playerView=new PlayerView(this.viewSide);this.paused=false;this.accumulated=0;this.attackedNoticeAt.clear();this.buildingAlertAt=-Infinity;this.workerAlertAt=-Infinity;this.groups={};this.markers=[];this.combatEffects=[];this.heldKeys.clear();this.controller.reset();this.controllerCursor=null;this.setBuildRole(null);this.select([]);this.drawGround();this.drawFog();this.centerOn(this.state.starts[this.viewSide].x,this.state.starts[this.viewSide].y);}
  public holdPosition(){if(!this.command({type:'hold',ids:this.selected}))return false;this.attackMode=false;this.setBuildRole(null);this.audio?.play('order');this.options.onNotice('Holding position: attack in range without pursuing.');return true;}
  private select(ids:number[],audible=true){const changed=ids.length!==this.selected.length||ids.some((id,index)=>id!==this.selected[index]);this.selected=ids;this.options.onSelection(ids);if(audible&&changed&&ids.length)this.audio?.play('selection');}
  private key(e:KeyboardEvent){
    if(this.inputSuppressed(e.target))return;
    this.heldKeys.add(e.code);this.updateModifiers(e);
    const action=this.controls.matchKeyboard(e,this.controlContext);if(!action)return;
    e.preventDefault();
    // A complete tap can arrive between updates, so held-key polling alone loses it.
    const direction=CAMERA_TAP[action];
    if(direction){
      if(!e.repeat){const c=this.cameras.main,step=48*this.pixelDensity/c.zoom;c.scrollX+=direction[0]*step;c.scrollY+=direction[1]*step;}
      return;
    }
    if(e.repeat)return;
    this.activateControl(action);
  }
  private updateModifiers(e:KeyboardEvent){this.keyboardState={codes:this.heldKeys,ctrl:e.ctrlKey,meta:e.metaKey,alt:e.altKey,shift:e.shiftKey};}
  private activateControl(action:ControlAction){
    switch(action){
      case 'cancel':if(this.photoMode)this.setPhotoMode(false);else {this.cancelBlueprintPlacement();this.setBuildRole(null);this.attackMode=false;this.drag=null;}return;
      case 'photoMode':this.setPhotoMode(!this.photoMode);return;
      case 'pause':this.togglePause();return;
      case 'zoomIn':this.zoomBy(.15*this.pixelDensity);return;
      case 'zoomOut':this.zoomBy(-.15*this.pixelDensity);return;
      case 'centerHQ':{const hq=this.state.entities.find(v=>v.side===this.viewSide&&v.role==='hq'&&v.hp>0);if(hq)this.centerOn(hq.x,hq.y);return;}
      case 'selectArmy':this.select(this.state.entities.filter(unit=>unit.side===this.viewSide&&this.visible(unit)&&unit.kind==='unit'&&unit.role!=='worker'&&unit.hp>0).map(unit=>unit.id));return;
      case 'attackMove':this.beginAttackMove();return;
      case 'hold':this.holdPosition();return;
      case 'stop':if(this.command({type:'stop',ids:this.selected}))this.audio?.play('order');return;
      case 'ability':if(this.command({type:'ability',ids:this.selected}))this.audio?.play('order');return;
    }
    if(action.startsWith('action')){if(this.canCommand)this.options.onActionSlot?.(Number(action.slice(6)));return;}
    if(action.startsWith('groupAssign')){const n=action.slice(-1);this.groups[n]=[...this.selected];this.options.onNotice(`Group ${n} assigned.`);}
    else if(action.startsWith('groupRecall'))this.recallGroup(action.slice(-1));
  }
  private zoomBy(delta:number){this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom+delta,.55*this.pixelDensity,1.8*this.pixelDensity));}
  private visible(e:Entity){return levelOf(e)===this.viewLevel&&(e.side===this.viewSide||this.state.visible[this.viewSide].has(fogKey(this.state,e)));}
  private hit(x:number,y:number){return [...this.state.entities].sort((a,b)=>(b.x+b.y)-(a.x+a.y)||b.id-a.id).find(e=>{if(e.hp<=0||!this.visible(e))return false;const rendered=this.art.contains(`entity:${e.id}`,x,y);if(rendered!==null)return rendered;const q=project(e.x,e.y);const r=e.kind==='building'?35:14;return Math.abs(x-q.x)<r&&y>q.y-(e.kind==='building'?65:35)&&y<q.y+12;});}
  private order(p:Phaser.Input.Pointer,attack=false){
    this.orderAt(p.x,p.y,attack,this.queueModifier(p.event));
  }
  private orderAt(x:number,y:number,attack=false,queued=false){
    if(!this.canCommand)return;
    if(this.blueprintPlacement){this.cancelBlueprintPlacement();return;}
    if(this.buildRole){this.setBuildRole(null);return;}
    const world=this.cameras.main.getWorldPoint(x,y);const pos=unproject(world.x,world.y);const hit=this.hit(world.x,world.y);
    let ok=false;
    const own=this.state.entities.filter(e=>this.selected.includes(e.id)&&e.side===this.viewSide&&e.hp>0);
    const producers=own.filter(e=>e.kind==='building'&&(e.role==='hq'||e.role==='barracks'));
    if(producers.length&&!attack&&!own.some(e=>e.kind==='unit')){
      ok=this.command({type:'setRally',ids:producers.map(e=>e.id),x:pos.x,y:pos.y,level:this.viewLevel});
      this.options.onNotice(ok?'Rally point set. New units will move here.':'Choose open ground for the rally point.');
      if(ok)this.audio?.play('order');
      return;
    }
    if(hit&&isHostile(this.state,this.viewSide,hit.side))ok=this.command({type:'attack',ids:this.selected,target:hit.id,queued});
    else if(hit&&hit.side===this.viewSide&&hit.kind==='building'&&hit.hp<hit.maxHp)ok=this.command({type:'repair',ids:this.selected,target:hit.id,queued});
    else {
      const resource=[...this.state.resources].sort((a,b)=>(b.x+b.y)-(a.x+a.y)).find(r=>{if(r.amount<=0||levelOf(r)!==this.viewLevel||!this.state.visible[this.viewSide].has(fogKey(this.state,r)))return false;const rendered=this.art.contains(`resource:${r.id}`,world.x,world.y);if(rendered!==null)return rendered;const q=project(r.x,r.y);return Math.abs(q.x-world.x)<24&&Math.abs(q.y-15-world.y)<30;});
      if(resource&&!attack)ok=this.command({type:'gather',ids:this.selected,target:resource.id,queued});
      else ok=this.command({type:attack?'attackMove':'move',ids:this.selected,x:Phaser.Math.Clamp(pos.x,.5,this.state.width-.5),y:Phaser.Math.Clamp(pos.y,.5,this.state.height-.5),level:this.viewLevel,queued});
    }
    if(ok){this.markers.push({...project(pos.x,pos.y),born:this.time.now,attack});this.audio?.play('order');}
  }
  private controllerSelect(queued:boolean){
    if(!this.controlContext.playable||!this.controllerCursor)return;
    const {x,y}=this.controllerCursor;
    if(this.blueprintPlacement){const world=this.cameras.main.getWorldPoint(x,y);this.placeBlueprint(unproject(world.x,world.y));return;}
    if(this.buildRole){
      const world=this.cameras.main.getWorldPoint(x,y),pos=unproject(world.x,world.y),role=this.buildRole;
      if(this.command({type:'build',ids:this.selected,role,definitionId:this.buildDefinitionId,x:role==='gate'?Math.round(pos.x):Math.floor(pos.x)+.5,y:role==='gate'?Math.round(pos.y):Math.floor(pos.y)+.5,level:this.viewLevel})){this.setBuildRole(null);this.options.onNotice('Construction ordered.');this.audio?.play('order');}
      else this.options.onNotice('Cannot build here. Select a worker and check resources and space.');
      return;
    }
    if(this.attackMode){this.attackMode=false;this.orderAt(x,y,true,queued);return;}
    const world=this.cameras.main.getWorldPoint(x,y),hit=this.hit(world.x,world.y);
    const ids=hit?.side===this.viewSide?[hit.id]:[];
    this.select(queued?[...new Set([...this.selected,...ids])]:ids);
  }
  private cycleSelection(direction:-1|1){
    if(!this.controlContext.playable)return;
    const entities=this.state.entities.filter(e=>e.side===this.viewSide&&e.hp>0).sort((a,b)=>a.id-b.id);
    if(!entities.length)return;
    const index=entities.findIndex(e=>e.id===this.selected[0]);
    const next=entities[index<0?(direction>0?0:entities.length-1):(index+direction+entities.length)%entities.length];
    this.select([next.id]);this.centerOn(next.x,next.y);
    const camera=this.cameras.main,bounds=this.options.viewBounds?.();this.controllerCursor={x:camera.width/2,y:bounds?(bounds.top+bounds.bottom)/2:camera.height/2};
  }
  private updateController(delta:number,suppressed:boolean){
    let pads:readonly (Gamepad|null)[]=[];try{pads=navigator.getGamepads?.()??[];}catch{/* The browser may disable controller access. */}
    const frame=this.controller.update(pads,delta,suppressed);this.gamepadConnected=frame.connected;
    if(!frame.connected){this.controllerActive=false;this.controllerCursor=null;return;}
    if(suppressed)return;
    const camera=this.cameras.main,bounds=this.photoMode?undefined:this.options.viewBounds?.();
    if(!this.controllerCursor)this.controllerCursor={x:camera.width/2,y:bounds?(bounds.top+bounds.bottom)/2:camera.height/2};
    if(frame.cameraX||frame.cameraY||frame.zoom||frame.cursorX||frame.cursorY||frame.pressed.length)this.controllerActive=true;
    camera.scrollX+=frame.cameraX*this.pixelDensity/camera.zoom;camera.scrollY+=frame.cameraY*this.pixelDensity/camera.zoom;
    if(frame.zoom)this.zoomBy(frame.zoom*this.pixelDensity);
    this.controllerCursor.x=Phaser.Math.Clamp(this.controllerCursor.x+frame.cursorX*this.pixelDensity,0,camera.width);
    this.controllerCursor.y=Phaser.Math.Clamp(this.controllerCursor.y+frame.cursorY*this.pixelDensity,bounds?.top??0,bounds?.bottom??camera.height);
    for(const action of frame.pressed){
      switch(action){
        case 'selectPrevious':this.cycleSelection(-1);break;
        case 'selectNext':this.cycleSelection(1);break;
        case 'select':this.controllerSelect(frame.queued);break;
        case 'contextOrder':this.orderAt(this.controllerCursor.x,this.controllerCursor.y,this.attackMode,frame.queued);this.attackMode=false;break;
        case 'attackMode':this.beginAttackMove();break;
        case 'cancel':this.activateControl('cancel');break;
        case 'ability':this.activateControl('ability');break;
        case 'hold':this.activateControl('hold');break;
        case 'stop':this.activateControl('stop');break;
        case 'centerHq':this.activateControl('centerHQ');break;
        case 'pause':this.activateControl('pause');break;
        case 'photo':this.activateControl('photoMode');break;
        default:if(action.startsWith('action'))this.activateControl(action as ControlAction);break;
      }
    }
  }
  update(_time:number,delta:number){
    if(!this.actors)return;
    if(this.simulationEnabled&&!this.paused&&(this.state.winner===null&&!this.state.draw)){
      this.accumulated+=Math.min(delta/1000,.15);
      while(this.accumulated>=.05&&this.state.winner===null&&!this.state.draw){stepGame(this.state,.05);this.accumulated-=.05;this.processEvents();this.options.onStep?.(this.state);}
    }
    const living=this.selected.filter(id=>this.state.entities.some(e=>e.id===id&&e.hp>0&&this.visible(e)));if(living.length!==this.selected.length)this.select(living,false);
    const suppressed=this.inputSuppressed();if(suppressed)this.heldKeys.clear();
    const c=this.cameras.main,s=(suppressed?0:Math.min(delta,40))*.75*this.pixelDensity/c.zoom;
    for(const [action,direction] of Object.entries(CAMERA_TAP))if(this.controls.isHeld(action as ControlAction,this.keyboardState,this.controlContext)){c.scrollX+=direction![0]*s;c.scrollY+=direction![1]*s;}
    this.updateController(delta,suppressed);
    const groundSignature=`${this.viewLevel}|${(this.viewLevel===0?this.state.terrain:this.state.world?.levels[this.viewLevel].terrain??[]).join(',')}`;if(groundSignature!==this.groundSignature){this.groundSignature=groundSignature;this.drawGround();}
    this.drawActors();this.drawOverlay();
    this.fogClock+=delta;if(this.fogClock>150){this.fogClock=0;this.drawFog();}
  }
  private processEvents(events:readonly GameEvent[]=this.state.events){
    const state=this.state, faction=factionFor(state,this.viewSide);
    let buildingAlert:Entity|undefined,workerAlert:Entity|undefined;
    for(const event of events){
      if(event.type==='attack'&&isVisible(state,this.viewSide,event.x,event.y)){
        const source=state.entities.find(e=>e.id===event.source),target=state.entities.find(e=>e.id===event.target);
        if(source&&target&&this.visible(target)){
          const def=source.kind==='unit'?unitFor(state,source):undefined;
          if(source.kind==='building'||(def?.range??0)>3)this.combatEffects.push({from:project(source.x,source.y),to:project(target.x,target.y),born:state.time,color:factionFor(state,source.side).color,heavy:!!def?.buildingDamageMultiplier});
        }
      }
      if(event.type==='attack'&&levelOf(event)===this.viewLevel&&state.visible[this.viewSide].has(fogKey(state,event)))this.audio?.play('attack');
      if(event.type==='attack'){
        const target=state.entities.find(e=>e.id===event.target);
        // An own target is known even if its attacker is outside vision. Never reveal the attacker.
        if(!target||target.side!==this.viewSide)continue;
        if(target.kind==='building'&&state.time-(this.attackedNoticeAt.get(target.id)??-Infinity)>=12)buildingAlert??=target;
        else if(target.kind==='unit'&&target.role==='worker')workerAlert??=target;
      }else if(event.side===this.viewSide){
        if(event.type==='message'&&event.text)this.options.onNotice(event.text);
        if(event.type==='build'&&event.text==='Construction complete'){
          this.audio?.play('build');
          const entity=state.entities.find(e=>e.side===this.viewSide&&e.kind==='building'&&Math.hypot(e.x-event.x,e.y-event.y)<.1);
          this.options.onNotice(entity?`${entityDefinition(state,entity).name} complete.`:'Construction complete.');
        }
        if(event.type==='train'){
          this.audio?.play('train');
          const entity=state.entities.find(e=>e.side===this.viewSide&&e.kind==='unit'&&Math.hypot(e.x-event.x,e.y-event.y)<.1);
          this.options.onNotice(entity?`${entityDefinition(state,entity).name} ready.`:'Unit recruited.');
        }
        if(event.type==='research'&&event.text?.endsWith('complete')){this.audio?.play('train');this.options.onNotice(`${event.text}.`);}
      }
    }
    if((state.winner!==null||state.draw)&&!this.resultSoundPlayed){this.resultSoundPlayed=true;this.audio?.play(state.winningTeam===state.teams[this.viewSide]?'victory':'defeat');}
    if(buildingAlert){
      this.attackedNoticeAt.set(buildingAlert.id,state.time);this.buildingAlertAt=state.time;
      this.options.onNotice(`${entityDefinition(state,buildingAlert).name} under attack!`);
    }else if(workerAlert&&state.time-this.buildingAlertAt>=12&&state.time-this.workerAlertAt>=12){
      this.workerAlertAt=state.time;this.options.onNotice('Workers under attack!');
    }
  }
  private diamond(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,color:number,alpha=1){g.fillStyle(color,alpha);g.beginPath();g.moveTo(x,y-h/2);g.lineTo(x+w/2,y);g.lineTo(x,y+h/2);g.lineTo(x-w/2,y);g.closePath();g.fillPath();}
  private drawGround(){
    this.art.ground(this.state,project,this.viewLevel);
    const g=this.ground;g.clear();
    for(let y=0;y<this.state.height;y++)for(let x=0;x<this.state.width;x++){
      const p=project(x+.5,y+.5);const n=((x*73856093)^(y*19349663)^(this.state.seed||7))>>>0;
      const terrain=terrainAt(this.state,x+.5,y+.5,this.viewLevel);
      const colors={grass:0x536b48,road:0x85805a,mud:0x74634d,shallows:0x5b9b98,water:0x387986,rock:0x697980,bridge:0x95734e,sand:0xc3a568,snow:0xc8d9db,forest:0x2e4931,ice:0x94c9d9};
      this.diamond(g,p.x,p.y,65,33,colors[terrain]);
      const elevation=elevationAt(this.state,{x:x+.5,y:y+.5,level:this.viewLevel});if(elevation){g.lineStyle(1+elevation,0xe5d6a3,.5).lineBetween(p.x-18,p.y+8,p.x,p.y+16);g.lineBetween(p.x,p.y+16,p.x+18,p.y+8);}
      if(terrain==='grass'&&n%4===0){g.lineStyle(1,0x91a262,.35);g.lineBetween(p.x-8,p.y+3,p.x-6,p.y-1);}

    }
  }
  private drawActors(){
    const g=this.actors;g.clear();this.art.begin();
    const appearance=this.appearance.value,teams=(this.state as GameState&{teams?:number[]}).teams;
    const remembered=this.remoteFrame?.resourceMemory??this.playerView.resourcesFor(this.state);
    const objects=[...remembered.filter(r=>r.amount>0&&levelOf(r)===this.viewLevel).map(r=>({sort:r.x+r.y,r})),...this.state.entities.filter(e=>this.visible(e)).map(e=>({sort:e.x+e.y,e}))].sort((a,b)=>a.sort-b.sort);
    for(const obj of objects){
      if('r' in obj){const r=obj.r,p=project(r.x,r.y);if(!this.state.explored[this.viewSide].has(fogKey(this.state,r)))continue;
        const environment=r.kind==='crystal'?'crystal':r.kind==='ore'?'ore':r.id%3===0?'tree-oak':'tree-pine';
        if(this.art.environment(`resource:${r.id}`,environment,p.x,p.y))continue;
        g.fillStyle(0x142a22,.3).fillEllipse(p.x+4,p.y+4,41,17);
        if(r.kind==='wood'){g.fillStyle(0x634d34).fillRect(p.x-3,p.y-25,6,28);g.fillStyle(0x274b3b).fillTriangle(p.x-22,p.y-17,p.x,p.y-67,p.x+22,p.y-17);g.fillStyle(0x3d6950).fillTriangle(p.x-18,p.y-28,p.x-2,p.y-68,p.x+12,p.y-28);g.fillStyle(0x71915b).fillTriangle(p.x-13,p.y-44,p.x-2,p.y-68,p.x+7,p.y-44);}
        else{g.fillStyle(0x53616a).fillTriangle(p.x-19,p.y+1,p.x-9,p.y-22,p.x+13,p.y-2);g.fillStyle(0x92adad).fillTriangle(p.x-9,p.y-22,p.x+3,p.y-25,p.x+13,p.y-2);g.fillStyle(0xb8cfba).fillTriangle(p.x+2,p.y-4,p.x+8,p.y-18,p.x+21,p.y+1);}continue;
      }
      const e=obj.e,p=project(e.x,e.y);const faction=this.state.players[e.side].faction;const orc=faction==='orcs';const style=ownershipStyle(e.side,this.viewSide,appearance,teams);const color=style.color;const selected=!this.photoMode&&this.selected.includes(e.id);const dead=e.hp<=0;const alpha=dead?.35:e.illusion&&e.side===this.playerView.side?.5:1;
      g.fillStyle(0x14201c,.38).fillEllipse(p.x+4,p.y+4,e.kind==='building'?70:27,e.kind==='building'?30:12);
      if(selected){const w=e.kind==='building'?86:39,h=e.kind==='building'?43:21;g.lineStyle(5,0x111a20,1).strokeEllipse(p.x,p.y+2,w,h);g.lineStyle(2.5,style.outline,1).strokeEllipse(p.x,p.y+2,w,h);}
      if(this.art.entity(e,this.state,p.x,p.y,this.playerView.side))continue;
      if(e.kind==='building'){
        const size=e.role==='hq'?1.25:e.role==='tower'?.75:1;const w=48*size,h=(e.role==='tower'?78:43)*size;const y=p.y;
        this.diamond(g,p.x,y,82*size,40*size,orc?0x4c5148:0x427357,alpha);
        g.fillStyle(orc?0x64533f:0x837955,alpha).fillRect(p.x-w/2,y-h,w,h-4);
        if(orc){g.fillStyle(0x353e43,alpha).fillTriangle(p.x-w/2-10,y-h+4,p.x,y-h-23,p.x+w/2+10,y-h+4);g.lineStyle(3,0xb2a57a,alpha).lineBetween(p.x-w/2,y-h+7,p.x-w/2,y-5);g.lineBetween(p.x+w/2,y-h+7,p.x+w/2,y-5);}
        else{g.fillStyle(0x42765b,alpha).fillEllipse(p.x,y-h,80*size,37);g.fillStyle(0x81aa70,alpha).fillEllipse(p.x-9,y-h-7,50*size,22);g.fillStyle(0xa2dcb1,alpha*.8).fillCircle(p.x,y-h-17,5);}
        g.fillStyle(0x263638,alpha).fillRect(p.x-8,y-25,16,22);g.fillStyle(color,alpha).fillRect(p.x+w/2-2,y-h-15,15,13);
        if(e.role==='barracks'){g.lineStyle(3,0xc7c2a0,alpha).lineBetween(p.x-9,y-h+8,p.x+9,y-h+24);g.lineBetween(p.x+9,y-h+8,p.x-9,y-h+24);}
        if(e.role==='depot'){g.fillStyle(0xa08a59,alpha).fillRect(p.x+18,y-15,15,12);}
        if(!this.photoMode&&e.progress<1){g.fillStyle(0x182b2a,.6).fillRect(p.x-34,y-12,68,6);g.fillStyle(0xe4c578).fillRect(p.x-34,y-12,68*e.progress,6);}
      }else{
        const bob=e.animation==='walk'?Math.sin(e.animTime*12)*2:Math.sin(this.state.time*2+e.id)*.5;const y=p.y+bob;
        if(!orc){g.fillStyle(0xc4e8cb,.55*alpha).fillEllipse(p.x-10,y-21,20,12);g.fillEllipse(p.x+10,y-21,20,12);}
        g.lineStyle(3,orc?0x473f37:0x526c52,alpha).lineBetween(p.x-4,y-10,p.x-5,y);g.lineBetween(p.x+4,y-10,p.x+5,y);
        g.fillStyle(orc?0x545c51:0x94ac79,alpha).fillEllipse(p.x,y-17,e.role==='melee'?23:17,20);
        g.fillStyle(orc?0x87936a:0xc9c4a0,alpha).fillCircle(p.x,y-30,6);
        g.fillStyle(color,alpha).fillRect(p.x-6,y-22,12,4);
        const facingAngle=e.facing*Math.PI/4;const dx=Math.cos(facingAngle),dy=Math.sin(facingAngle)*.5;const swing=e.animation==='attack'?Math.sin(e.animTime*15)*7:0;
        if(e.role==='worker'){g.lineStyle(2,0xc9b78e,alpha).lineBetween(p.x+7,y-9,p.x+14+swing,y-31);g.lineBetween(p.x+8,y-29,p.x+20,y-27);}
        if(e.role==='melee'){g.lineStyle(4,0xc5c6b3,alpha).lineBetween(p.x+8,y-12,p.x+14+swing,y-35);g.fillStyle(orc?0x744d3c:0x849f6c,alpha).fillEllipse(p.x-10,y-17,9,17);}
        if(e.role==='ranged'){g.lineStyle(2,0xd2ba7d,alpha).strokeEllipse(p.x+11,y-20,10,23);}
        if(e.role==='special'){g.lineStyle(2,0xbfb586,alpha).lineBetween(p.x+10,y-4,p.x+10,y-36);g.fillStyle(orc?0xebaf58:0xa5e9cb,alpha).fillCircle(p.x+10,y-38,5);}
        g.fillStyle(0xf4e7b7,alpha).fillCircle(p.x+dx*4,y-30+dy*2,1.5);
        if(!this.photoMode&&e.momentum>0){g.lineStyle(2,0xe8a24e,.7).strokeEllipse(p.x,p.y+2,28+e.momentum,13);}
      }
      if(!this.photoMode&&!dead&&(selected||e.hp<e.maxHp)){
        const w=e.kind==='building'?54:30,y=p.y-(e.kind==='building'?95:46);g.fillStyle(0x182426,.9).fillRect(p.x-w/2-1,y-1,w+2,5);g.fillStyle(style.color).fillRect(p.x-w/2,y,w*Math.max(0,e.hp/e.maxHp),3);
      }
    }
    for(let i=0;i<this.state.terrain.length;i++)if(terrainAt(this.state,i%this.state.width+.5,Math.floor(i/this.state.width)+.5,this.viewLevel)==='shallows'&&i%7===0&&this.state.explored[this.viewSide].has(this.viewLevel*this.state.width*this.state.height+i)){const p=project(i%this.state.width+.5,Math.floor(i/this.state.width)+.5);this.art.environment(`reeds:${i}`,'reeds',p.x,p.y);}
    for(const r of remembered)if(levelOf(r)===this.viewLevel&&r.kind==='wood'&&r.amount<=0&&this.state.explored[this.viewSide].has(fogKey(this.state,r))){const p=project(r.x,r.y);this.art.environment(`resource:${r.id}`,'stump',p.x,p.y);}
    this.drawWorldObjects(g);
    this.art.end();
  }
  private drawWorldObjects(g:Phaser.GameObjects.Graphics){
    const world=this.state.world;if(!world)return;const visible=(p:{x:number;y:number;level:number})=>p.level===this.viewLevel&&this.state.visible[this.viewSide].has(fogKey(this.state,p));
    for(const transition of world.transitions)for(const entrance of [transition.from,transition.to])if(visible(entrance)){const p=project(entrance.x,entrance.y);g.fillStyle(0x2a2233,.9).fillEllipse(p.x,p.y-4,36,22);g.lineStyle(3,0xb8d7e0).strokeEllipse(p.x,p.y-4,36,22);g.lineBetween(p.x-12,p.y-5,p.x+12,p.y-5);}
    for(const site of world.sites)if(visible(site)){const p=project(site.x,site.y),color=site.owner===null?0xe6d38a:ownershipStyle(site.owner,this.viewSide,this.appearance.value,this.state.teams).color;if(site.kind==='relic'){g.fillStyle(color).fillTriangle(p.x-12,p.y,p.x,p.y-43,p.x+12,p.y);g.lineStyle(2,0xf1efd8).strokeCircle(p.x,p.y-28,10);}else if(site.kind==='village'){g.fillStyle(0x7b6550).fillRect(p.x-22,p.y-28,44,27);g.fillStyle(color).fillTriangle(p.x-30,p.y-28,p.x,p.y-49,p.x+30,p.y-28);}else{g.fillStyle(0x3a2b26).fillEllipse(p.x,p.y-8,50,34);g.lineStyle(3,0xa99576).strokeEllipse(p.x,p.y-8,50,34);}if(site.progress>0){g.fillStyle(0x182b2a).fillRect(p.x-24,p.y+4,48,5);g.fillStyle(color).fillRect(p.x-24,p.y+4,48*site.progress,5);}}
    for(const creature of world.creatures)if(creature.hp>0&&visible(creature)){const p=project(creature.x,creature.y);g.fillStyle(0x914e42).fillEllipse(p.x,p.y-13,25,24);g.fillStyle(0xd0b78d).fillTriangle(p.x-12,p.y-18,p.x-9,p.y-34,p.x-4,p.y-19);g.fillTriangle(p.x+4,p.y-19,p.x+9,p.y-34,p.x+12,p.y-18);if(!this.photoMode){g.fillStyle(0x182b2a).fillRect(p.x-16,p.y-40,32,4);g.fillStyle(0xd47760).fillRect(p.x-16,p.y-40,32*creature.hp/creature.maxHp,4);}}
    for(const fire of world.fires)if(visible(fire)){const p=project(fire.x,fire.y),sway=Math.sin(this.state.time*9+fire.x)*3;g.fillStyle(0xd45327,.8).fillTriangle(p.x-14,p.y+5,p.x+sway,p.y-34,p.x+14,p.y+5);g.fillStyle(0xf4cf65).fillTriangle(p.x-7,p.y+4,p.x-sway,p.y-22,p.x+7,p.y+4);}
  }
  private drawFog(){const g=this.fog;g.clear();for(let y=0;y<this.state.height;y++)for(let x=0;x<this.state.width;x++){const i=fogKey(this.state,{x,y,level:this.viewLevel});if(this.state.visible[this.viewSide].has(i))continue;const p=project(x+.5,y+.5);this.diamond(g,p.x,p.y,65,33,0x102022,this.state.explored[this.viewSide].has(i)?.48:.98);}}
  private drawOverlay(){
    const g=this.overlay;g.clear();if(this.photoMode){this.game.canvas.style.cursor='default';return;}const p=this.controllerActive&&this.controllerCursor?this.controllerCursor:this.input.activePointer;const world=this.cameras.main.getWorldPoint(p.x,p.y);
    for(const corpse of this.state.corpses){
      if(levelOf(corpse)!==this.viewLevel||!isVisible(this.state,this.viewSide,corpse.x,corpse.y,levelOf(corpse)))continue;
      const c=project(corpse.x,corpse.y);g.lineStyle(2,0xbbb79f,.6).lineBetween(c.x-5,c.y-2,c.x+5,c.y+2);g.lineBetween(c.x-5,c.y+2,c.x+5,c.y-2);
    }
    if(this.blueprintSide===this.viewSide)for(const blueprint of this.blueprints){
      if(blueprint.status!=='planned'||!this.state.explored[this.viewSide].has(Math.floor(blueprint.y)*this.state.width+Math.floor(blueprint.x)))continue;
      const q=project(blueprint.x,blueprint.y),size=buildingFor(this.state,this.viewSide,blueprint.role).size;
      this.diamond(g,q.x,q.y,size*64,size*32,0xa6d9d4,.18);g.lineStyle(2,blueprint.reason?0xe27964:0xa6d9d4,.8).strokeEllipse(q.x,q.y,size*64,size*32);
    }
    if(this.blueprintPlacement){const pos=unproject(world.x,world.y),role=this.blueprintPlacement.role,x=role==='gate'?Math.round(pos.x):Math.floor(pos.x)+.5,y=role==='gate'?Math.round(pos.y):Math.floor(pos.y)+.5,q=project(x,y),size=buildingFor(this.state,this.viewSide,role).size;this.diamond(g,q.x,q.y,size*64,size*32,0xa6d9d4,.4);}
    const appearance=this.appearance.value,teams=(this.state as GameState&{teams?:number[]}).teams;
    for(const unit of this.state.entities){
      if(unit.hp<=0||!this.visible(unit))continue;
      const c=project(unit.x,unit.y);
      // Ownership stays readable when both armies have the same faction artwork.
      const style=ownershipStyle(unit.side,this.viewSide,appearance,teams),building=unit.kind==='building';
      if(appearance.outlines){const w=building?78:32,h=building?36:15;g.lineStyle(4,0x111a20,.95).strokeEllipse(c.x,c.y+2,w,h);g.lineStyle(1.5,style.outline,.95).strokeEllipse(c.x,c.y+2,w,h);}
      const badge=markerPolygon(appearance.patterns?unit.side:1,c.x,c.y+(building?22:12),building?6:4);
      g.fillStyle(style.color,1).lineStyle(appearance.outlines?1.5:1,appearance.outlines?style.outline:0x111a20,1);g.beginPath();badge.forEach((point,i)=>i?g.lineTo(point.x,point.y):g.moveTo(point.x,point.y));g.closePath();g.fillPath();g.strokePath();
      if((unit.shield??0)>0){g.lineStyle(1,0xb59af0,.35+.45*(unit.shield!/unit.maxShield!)).strokeEllipse(c.x,c.y-14,35,39);}
      if((unit.surgeUntil??0)>this.state.time){g.lineStyle(2,0x83d5cf,.7).strokeEllipse(c.x,c.y+2,36,16);}
      if(unit.entrenchedAt!==undefined){
        const ready=this.state.time-unit.entrenchedAt>=3;g.lineStyle(ready?3:1,0xedc675,ready?.85:.4).strokeRect(c.x-16,c.y-8,32,16);
        if(unit.role==='special'&&this.selected.includes(unit.id)){
          const range=unitFor(this.state,unit).range+(ready?3:0);
          g.lineStyle(1,0xedc675,.3).strokeEllipse(c.x,c.y,range*64*Math.SQRT2,range*32*Math.SQRT2);
        }
        if(!ready)g.fillStyle(0xedc675,.8).fillRect(c.x-16,c.y+14,32*Math.min(1,(this.state.time-unit.entrenchedAt)/3),3);
      }
      if(unit.raised)g.lineStyle(1,0x82dec8,.7).strokeEllipse(c.x,c.y,28,13);
    }
    this.combatEffects=this.combatEffects.filter(f=>this.state.time-f.born<.5);
    for(const f of this.combatEffects){const t=Math.min(1,(this.state.time-f.born)/.35),x=f.from.x+(f.to.x-f.from.x)*t,y=f.from.y-24+(f.to.y-f.from.y)*t-Math.sin(t*Math.PI)*(f.heavy?25:5);g.fillStyle(f.color,1-t*.6).fillCircle(x,y,f.heavy?4:2);if(t>=1)g.lineStyle(2,f.color,.5).strokeCircle(f.to.x,f.to.y-20,8);}
    for(const e of this.state.entities){
      if(e.hp<=0||!this.visible(e)||!(this.selected.includes(e.id)||e.hp<e.maxHp))continue;
      const q=project(e.x,e.y),w=e.kind==='building'?54:30,y=(this.art.top(`entity:${e.id}`)??(q.y-(e.kind==='building'?89:40)))-6;
      g.fillStyle(0x182426,.9).fillRect(q.x-w/2-1,y-1,w+2,5);g.fillStyle(ownershipStyle(e.side,this.viewSide,appearance,teams).color).fillRect(q.x-w/2,y,w*Math.max(0,e.hp/e.maxHp),3);
      if(e.kind==='building'&&e.progress<1){g.fillStyle(0x182b2a,.8).fillRect(q.x-27,y+7,54,4);g.fillStyle(0xe4c578).fillRect(q.x-27,y+7,54*e.progress,4);}
    }
    if(this.drag&&Math.hypot(p.x-this.drag.x,p.y-this.drag.y)>this.dragThreshold&&!this.buildRole){g.lineStyle(1,0xe5dca6).strokeRect(this.drag.wx,this.drag.wy,world.x-this.drag.wx,world.y-this.drag.wy);g.fillStyle(0xd6e9a5,.12).fillRect(this.drag.wx,this.drag.wy,world.x-this.drag.wx,world.y-this.drag.wy);}
    if(this.buildRole){const pos=unproject(world.x,world.y);const x=this.buildRole==='gate'?Math.round(pos.x):Math.floor(pos.x)+.5,y=this.buildRole==='gate'?Math.round(pos.y):Math.floor(pos.y)+.5,q=project(x,y);const valid=canPlace(this.state,this.viewSide,this.buildRole,x,y,this.buildDefinitionId,this.viewLevel);const size=buildingFor(this.state,this.viewSide,this.buildRole,this.buildDefinitionId).size;this.diamond(g,q.x,q.y,size*64,size*32,valid?0xa6d99a:0xe27964,.5);}
    for(const building of this.state.entities){
      if(building.side!==this.viewSide||building.hp<=0||!building.rally||!this.selected.includes(building.id))continue;
      const from=project(building.x,building.y),to=project(building.rally.x,building.rally.y);
      g.lineStyle(1,0xe4c578,.55).lineBetween(from.x,from.y,to.x,to.y);
      g.lineStyle(2,0xe4c578,1).strokeEllipse(to.x,to.y,22,11).lineBetween(to.x,to.y,to.x,to.y-32);
      g.fillStyle(0xe4c578,1).fillTriangle(to.x,to.y-32,to.x+18,to.y-26,to.x,to.y-20);
    }
    this.markers=this.markers.filter(m=>this.time.now-m.born<700);for(const m of this.markers){const age=(this.time.now-m.born)/700;g.lineStyle(2,m.attack?0xe38b6b:0xf0dfa3,1-age).strokeEllipse(m.x,m.y,15+age*35,7+age*17);}
    if(this.controllerActive&&this.controllerCursor){g.lineStyle(2,0xffefb6,.95).strokeCircle(world.x,world.y,7/this.cameras.main.zoom).lineBetween(world.x-12/this.cameras.main.zoom,world.y,world.x+12/this.cameras.main.zoom,world.y).lineBetween(world.x,world.y-12/this.cameras.main.zoom,world.x,world.y+12/this.cameras.main.zoom);}
    this.game.canvas.style.cursor=this.buildRole||this.attackMode||this.blueprintPlacement?'crosshair':'default';
  }
}
