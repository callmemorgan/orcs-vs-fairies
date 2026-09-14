import Phaser from 'phaser';
import ArtRuntime from './ArtRuntime';
import GameAudio from './GameAudio';
import type { GameState, BuildingRole, Entity, UnitRole } from '../core/types';
import { canPlace, isVisible, issueCommand, stepGame } from '../core/simulation';
import { PlayerView } from '../core/observation';
import { FACTIONS } from '../core/content';
import { captureDigitHotkeys } from '../ui/availability';

const TILE_W = 64, TILE_H = 32, OX = 1600, OY = 80;
const CAMERA_TAP:Record<string,readonly [number,number]> = {
  ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],
  KeyW:[0,-1],KeyS:[0,1],KeyD:[1,0],
};
export function project(x:number,y:number) { return {x:OX+(x-y)*TILE_W/2,y:OY+(x+y)*TILE_H/2}; }
export function unproject(x:number,y:number) { return {x:((x-OX)/32+(y-OY)/16)/2,y:((y-OY)/16-(x-OX)/32)/2}; }
interface Options {pixelDensity?:number;state:GameState;onSelection:(ids:number[])=>void;onNotice:(text:string)=>void;onReady?:()=>void;viewBounds?:()=>{top:number;bottom:number}}
export default class GameScene extends Phaser.Scene {
  public state:GameState;
  public selected:number[]=[];
  public buildRole:BuildingRole|null=null;
  public paused=false;
  private options:Options;
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
  private keys:Record<string,Phaser.Input.Keyboard.Key>={};
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
  constructor(options:Options) {super({key:'world'});this.options=options;this.state=options.state;}
  private get pixelDensity(){return this.options.pixelDensity??1;}
  preload(){this.art=new ArtRuntime(this,new URLSearchParams(location.search).get('art')!=='placeholder');this.art.preload(this.state.players.map(p=>p.faction));}
  create() {
    this.audio=new GameAudio();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.audio?.dispose());
    this.art.ready();
    if(this.art.enabled&&!this.art.loaded)this.options.onNotice('Artwork could not load. Check that the local server is running, then restart the match.');
    this.cameras.main.setBackgroundColor('#131f22');
    this.ground=this.add.graphics().setDepth(-101);this.actors=this.add.graphics().setDepth(0);this.fog=this.add.graphics().setDepth(100000);this.overlay=this.add.graphics().setDepth(100001);
    this.drawGround();
    this.cameras.main.setBounds(OX-this.state.height*32-64,-80,(this.state.width+this.state.height)*32+128,(this.state.width+this.state.height)*16+320).setZoom(this.pixelDensity);
    this.centerOn(this.state.starts[0].x,this.state.starts[0].y);
    this.input.mouse?.disableContextMenu();
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT') as Record<string,Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown',(e:KeyboardEvent)=>this.key(e));
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
      if(p.middleButtonDown()){this.drag=null;this.pan={x:p.x,y:p.y};return;}
      if(this.paused||(this.state.winner!==null||this.state.draw))return;
      if(p.rightButtonDown()){this.order(p);return;}
      const world=this.cameras.main.getWorldPoint(p.x,p.y);this.drag={x:p.x,y:p.y,wx:world.x,wy:world.y};
    });
    this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{
      if(!this.pan)return;
      if(!p.middleButtonDown()){this.pan=null;return;}
      const c=this.cameras.main;c.scrollX-=(p.x-this.pan.x)/c.zoom;c.scrollY-=(p.y-this.pan.y)/c.zoom;this.pan={x:p.x,y:p.y};
    });
    this.input.on('pointerup',(p:Phaser.Input.Pointer)=>{
      if(p.button===1){this.pan=null;return;}
      if(p.button!==0||!this.drag)return;
      const drag=this.drag;this.drag=null;const world=this.cameras.main.getWorldPoint(p.x,p.y);
      if(this.paused||(this.state.winner!==null||this.state.draw))return;
      const pos=unproject(world.x,world.y);
      if(this.buildRole){
        const role=this.buildRole;
        if(issueCommand(this.state,0,{type:'build',ids:this.selected,role,x:Math.floor(pos.x)+.5,y:Math.floor(pos.y)+.5})) {this.setBuildRole(null);this.options.onNotice('Construction ordered.');this.audio?.play('order');}
        else this.options.onNotice('Cannot build here. Select a worker and check resources and space.');
        return;
      }
      if(this.attackMode){this.attackMode=false;this.order(p,true);return;}
      let ids:number[]=[];
      if(Math.hypot(p.x-drag.x,p.y-drag.y)>6*this.pixelDensity){
        const x1=Math.min(drag.wx,world.x),x2=Math.max(drag.wx,world.x),y1=Math.min(drag.wy,world.y),y2=Math.max(drag.wy,world.y);
        ids=this.state.entities.filter(e=>{const q=project(e.x,e.y);return e.side===0&&e.kind==='unit'&&e.hp>0&&q.x>=x1&&q.x<=x2&&q.y>=y1&&q.y<=y2;}).map(e=>e.id);
      } else {const hit=this.hit(world.x,world.y);if(hit?.side===0)ids=[hit.id];}
      if(this.keys.SHIFT.isDown||this.input.activePointer.event.shiftKey)ids=[...new Set([...this.selected,...ids])];
      this.select(ids);
    });
    const clearPointerDrag=()=>{this.pan=null;this.drag=null;};
    this.input.on('pointerupoutside',clearPointerDrag);
    window.addEventListener('blur',clearPointerDrag);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>window.removeEventListener('blur',clearPointerDrag));
    this.input.on('wheel',(_p:Phaser.Input.Pointer,_o:unknown,_dx:number,dy:number)=>{
      this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom-dy*.001*this.pixelDensity,0.55*this.pixelDensity,1.8*this.pixelDensity));
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.input.keyboard?.removeAllListeners('keydown'));
    this.drawFog();
    this.options.onReady?.();
  }
  public controlGroups(){return Object.fromEntries(Object.entries(this.groups).map(([key,ids])=>[key,ids.filter(id=>this.state.entities.some(e=>e.id===id&&e.hp>0))]));}
  public recallGroup(key:string){const ids=this.controlGroups()[key];if(ids)this.select(ids);}
  public selectEntities(ids:number[]){this.select(ids.filter(id=>this.state.entities.some(e=>e.id===id&&e.hp>0&&this.visible(e))));}
  public beginAttackMove(){if(this.paused||this.state.winner!==null||this.state.draw||!this.selected.length)return;this.attackMode=true;this.buildRole=null;this.options.onNotice('Attack move: click a destination.');}
  public setBuildRole(role:BuildingRole|null){this.buildRole=role;this.attackMode=false;}
  public centerOn(x:number,y:number){const q=project(x,y),camera=this.cameras.main;camera.centerOn(q.x,q.y);const bounds=this.options.viewBounds?.();if(bounds)camera.scrollY+=(camera.height/2-(bounds.top+bounds.bottom)/2)/camera.zoom;}
  public restart(state:GameState){this.audio?.reset();this.resultSoundPlayed=false;this.art.reset();this.state=state;this.playerView=new PlayerView(0);this.paused=false;this.accumulated=0;this.attackedNoticeAt.clear();this.buildingAlertAt=-Infinity;this.workerAlertAt=-Infinity;this.groups={};this.markers=[];this.combatEffects=[];this.setBuildRole(null);this.select([]);this.drawGround();this.drawFog();this.centerOn(this.state.starts[0].x,this.state.starts[0].y);}
  public holdPosition(){if(this.paused||(this.state.winner!==null||this.state.draw)||!issueCommand(this.state,0,{type:'hold',ids:this.selected}))return false;this.attackMode=false;this.setBuildRole(null);this.audio?.play('order');this.options.onNotice('Holding position: attack in range without pursuing.');return true;}
  private select(ids:number[],audible=true){const changed=ids.length!==this.selected.length||ids.some((id,index)=>id!==this.selected[index]);this.selected=ids;this.options.onSelection(ids);if(audible&&changed&&ids.length)this.audio?.play('selection');}
  private key(e:KeyboardEvent){
    if((e.target as HTMLElement)?.closest('input,textarea,select'))return;
    if(e.code==='Escape'){this.setBuildRole(null);this.attackMode=false;this.drag=null;return;}
    const playable=captureDigitHotkeys(this.paused,this.state.winner!==null||this.state.draw);
    if(e.code==='F2'){
      if(!playable)return;
      e.preventDefault();
      this.select(this.state.entities.filter(unit=>unit.side===0&&unit.kind==='unit'&&unit.role!=='worker'&&unit.hp>0).map(unit=>unit.id));
      return;
    }
    // A complete tap can arrive between updates, so held-key polling alone loses it.
    const direction=CAMERA_TAP[e.code]??(e.code==='KeyA'&&!this.selected.length?[-1,0]:undefined);
    if(direction&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      e.preventDefault();
      if(!e.repeat){const c=this.cameras.main,step=48*this.pixelDensity/c.zoom;c.scrollX+=direction[0]*step;c.scrollY+=direction[1]*step;}
      return;
    }
    if(!playable)return;
    if(e.code==='KeyA'&&!e.ctrlKey&&!e.metaKey&&this.selected.length){this.attackMode=true;this.buildRole=null;this.options.onNotice('Attack move: click a destination.');}
    if(e.code==='Space'){e.preventDefault();const hq=this.state.entities.find(v=>v.side===0&&v.role==='hq');if(hq)this.centerOn(hq.x,hq.y);}
    if(e.code==='KeyH'&&!e.ctrlKey&&!e.metaKey&&!e.altKey)this.holdPosition();
    if(e.code==='KeyX'&&issueCommand(this.state,0,{type:'stop',ids:this.selected}))this.audio?.play('order');
    if((e.code==='KeyQ'||e.code==='KeyF')&&issueCommand(this.state,0,{type:'ability',ids:this.selected}))this.audio?.play('order');
    if(/^Digit[0-9]$/.test(e.code)){
      e.preventDefault();const n=e.code.slice(-1);
      if(e.ctrlKey||e.metaKey){this.groups[n]=[...this.selected];this.options.onNotice(`Group ${n} assigned.`);}
      else if(this.groups[n])this.select(this.groups[n].filter(id=>this.state.entities.some(v=>v.id===id&&v.hp>0)));
    }
  }
  private visible(e:Entity){return e.side===0||this.state.visible[0].has(Math.floor(e.y)*this.state.width+Math.floor(e.x));}
  private hit(x:number,y:number){return [...this.state.entities].sort((a,b)=>(b.x+b.y)-(a.x+a.y)||b.id-a.id).find(e=>{if(e.hp<=0||!this.visible(e))return false;const rendered=this.art.contains(`entity:${e.id}`,x,y);if(rendered!==null)return rendered;const q=project(e.x,e.y);const r=e.kind==='building'?35:14;return Math.abs(x-q.x)<r&&y>q.y-(e.kind==='building'?65:35)&&y<q.y+12;});}
  private order(p:Phaser.Input.Pointer,attack=false){
    if(this.buildRole){this.setBuildRole(null);return;}
    const world=this.cameras.main.getWorldPoint(p.x,p.y);const pos=unproject(world.x,world.y);const hit=this.hit(world.x,world.y);
    let ok=false;
    const producers=this.state.entities.filter(e=>this.selected.includes(e.id)&&e.side===0&&e.kind==='building'&&(e.role==='hq'||e.role==='barracks'));
    if(producers.length&&!attack){
      ok=issueCommand(this.state,0,{type:'setRally',ids:producers.map(e=>e.id),x:pos.x,y:pos.y});
      this.options.onNotice(ok?'Rally point set. New units will move here.':'Choose open ground for the rally point.');
      if(!this.state.entities.some(e=>this.selected.includes(e.id)&&e.side===0&&e.kind==='unit')){if(ok)this.audio?.play('order');return;}
    }
    if(hit&&hit.side===1)ok=issueCommand(this.state,0,{type:'attack',ids:this.selected,target:hit.id});
    else if(hit&&hit.side===0&&hit.kind==='building'&&hit.hp<hit.maxHp)ok=issueCommand(this.state,0,{type:'repair',ids:this.selected,target:hit.id});
    else {
      const resource=[...this.state.resources].sort((a,b)=>(b.x+b.y)-(a.x+a.y)).find(r=>{if(r.amount<=0||!this.state.visible[0].has(Math.floor(r.y)*this.state.width+Math.floor(r.x)))return false;const rendered=this.art.contains(`resource:${r.id}`,world.x,world.y);if(rendered!==null)return rendered;const q=project(r.x,r.y);return Math.abs(q.x-world.x)<24&&Math.abs(q.y-15-world.y)<30;});
      if(resource&&!attack)ok=issueCommand(this.state,0,{type:'gather',ids:this.selected,target:resource.id});
      else ok=issueCommand(this.state,0,{type:attack?'attackMove':'move',ids:this.selected,x:Phaser.Math.Clamp(pos.x,.5,this.state.width-.5),y:Phaser.Math.Clamp(pos.y,.5,this.state.height-.5)});
    }
    if(ok){this.markers.push({...project(pos.x,pos.y),born:this.time.now,attack});this.audio?.play('order');}
  }
  update(_time:number,delta:number){
    if(!this.actors)return;
    if(!this.paused&&(this.state.winner===null&&!this.state.draw)){
      this.accumulated+=Math.min(delta/1000,.15);
      while(this.accumulated>=.05){stepGame(this.state,.05);this.accumulated-=.05;this.processEvents();}
    }
    const living=this.selected.filter(id=>this.state.entities.some(e=>e.id===id&&e.hp>0&&this.visible(e)));if(living.length!==this.selected.length)this.select(living,false);
    const k=this.keys,c=this.cameras.main,s=Math.min(delta,40)*.75*this.pixelDensity/c.zoom;
    if(k.LEFT.isDown||(k.A.isDown&&!this.selected.length))c.scrollX-=s;
    if(k.RIGHT.isDown||k.D.isDown)c.scrollX+=s;
    if(k.UP.isDown||k.W.isDown)c.scrollY-=s;
    if(k.DOWN.isDown||k.S.isDown)c.scrollY+=s;
    this.drawActors();this.drawOverlay();
    this.fogClock+=delta;if(this.fogClock>150){this.fogClock=0;this.drawFog();}
  }
  private processEvents(){
    const state=this.state, faction=FACTIONS[state.players[0].faction];
    let buildingAlert:Entity|undefined,workerAlert:Entity|undefined;
    for(const event of state.events){
      if(event.type==='attack'&&isVisible(state,0,event.x,event.y)){
        const source=state.entities.find(e=>e.id===event.source),target=state.entities.find(e=>e.id===event.target);
        if(source&&target&&this.visible(target)){
          const def=source.kind==='unit'?FACTIONS[state.players[source.side].faction].units[source.role as UnitRole]:undefined;
          if(source.kind==='building'||(def?.range??0)>3)this.combatEffects.push({from:project(source.x,source.y),to:project(target.x,target.y),born:state.time,color:FACTIONS[state.players[source.side].faction].color,heavy:!!def?.buildingDamageMultiplier});
        }
      }
      if(event.type==='attack'&&state.visible[0].has(Math.floor(event.y)*state.width+Math.floor(event.x)))this.audio?.play('attack');
      if(event.type==='attack'){
        const target=state.entities.find(e=>e.id===event.target);
        // An own target is known even if its attacker is outside vision. Never reveal the attacker.
        if(!target||target.side!==0)continue;
        if(target.kind==='building'&&state.time-(this.attackedNoticeAt.get(target.id)??-Infinity)>=12)buildingAlert??=target;
        else if(target.kind==='unit'&&target.role==='worker')workerAlert??=target;
      }else if(event.side===0){
        if(event.type==='message'&&event.text)this.options.onNotice(event.text);
        if(event.type==='build'&&event.text==='Construction complete'){
          this.audio?.play('build');
          const entity=state.entities.find(e=>e.side===0&&e.kind==='building'&&Math.hypot(e.x-event.x,e.y-event.y)<.1);
          this.options.onNotice(entity?`${faction.buildings[entity.role as BuildingRole].name} complete.`:'Construction complete.');
        }
        if(event.type==='train'){
          this.audio?.play('train');
          const entity=state.entities.find(e=>e.side===0&&e.kind==='unit'&&Math.hypot(e.x-event.x,e.y-event.y)<.1);
          this.options.onNotice(entity?`${faction.units[entity.role as UnitRole].name} ready.`:'Unit recruited.');
        }
        if(event.type==='research'&&event.text?.endsWith('complete')){this.audio?.play('train');this.options.onNotice(`${event.text}.`);}
      }
    }
    if((state.winner!==null||state.draw)&&!this.resultSoundPlayed){this.resultSoundPlayed=true;this.audio?.play(state.winner===0?'victory':'defeat');}
    if(buildingAlert){
      this.attackedNoticeAt.set(buildingAlert.id,state.time);this.buildingAlertAt=state.time;
      this.options.onNotice(`${faction.buildings[buildingAlert.role as BuildingRole].name} under attack!`);
    }else if(workerAlert&&state.time-this.buildingAlertAt>=12&&state.time-this.workerAlertAt>=12){
      this.workerAlertAt=state.time;this.options.onNotice('Workers under attack!');
    }
  }
  private diamond(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,color:number,alpha=1){g.fillStyle(color,alpha);g.beginPath();g.moveTo(x,y-h/2);g.lineTo(x+w/2,y);g.lineTo(x,y+h/2);g.lineTo(x-w/2,y);g.closePath();g.fillPath();}
  private drawGround(){
    this.art.ground(this.state,project);
    const g=this.ground;g.clear();
    for(let y=0;y<this.state.height;y++)for(let x=0;x<this.state.width;x++){
      const p=project(x+.5,y+.5);const n=((x*73856093)^(y*19349663)^(this.state.seed||7))>>>0;
      const terrain=this.state.terrain[y*this.state.width+x];
      const colors={grass:0x536b48,road:0x85805a,mud:0x74634d,shallows:0x5b9b98,water:0x387986,rock:0x697980,bridge:0x95734e};
      this.diamond(g,p.x,p.y,65,33,colors[terrain]);
      if(terrain==='grass'&&n%4===0){g.lineStyle(1,0x91a262,.35);g.lineBetween(p.x-8,p.y+3,p.x-6,p.y-1);}

    }
  }
  private drawActors(){
    const g=this.actors;g.clear();this.art.begin();
    const remembered=this.playerView.resourcesFor(this.state);
    const objects=[...remembered.filter(r=>r.amount>0).map(r=>({sort:r.x+r.y,r})),...this.state.entities.filter(e=>this.visible(e)).map(e=>({sort:e.x+e.y,e}))].sort((a,b)=>a.sort-b.sort);
    for(const obj of objects){
      if('r' in obj){const r=obj.r,p=project(r.x,r.y);if(!this.state.explored[0].has(Math.floor(r.y)*this.state.width+Math.floor(r.x)))continue;
        const environment=r.kind==='crystal'?'crystal':r.kind==='ore'?'ore':r.id%3===0?'tree-oak':'tree-pine';
        if(this.art.environment(`resource:${r.id}`,environment,p.x,p.y))continue;
        g.fillStyle(0x142a22,.3).fillEllipse(p.x+4,p.y+4,41,17);
        if(r.kind==='wood'){g.fillStyle(0x634d34).fillRect(p.x-3,p.y-25,6,28);g.fillStyle(0x274b3b).fillTriangle(p.x-22,p.y-17,p.x,p.y-67,p.x+22,p.y-17);g.fillStyle(0x3d6950).fillTriangle(p.x-18,p.y-28,p.x-2,p.y-68,p.x+12,p.y-28);g.fillStyle(0x71915b).fillTriangle(p.x-13,p.y-44,p.x-2,p.y-68,p.x+7,p.y-44);}
        else{g.fillStyle(0x53616a).fillTriangle(p.x-19,p.y+1,p.x-9,p.y-22,p.x+13,p.y-2);g.fillStyle(0x92adad).fillTriangle(p.x-9,p.y-22,p.x+3,p.y-25,p.x+13,p.y-2);g.fillStyle(0xb8cfba).fillTriangle(p.x+2,p.y-4,p.x+8,p.y-18,p.x+21,p.y+1);}continue;
      }
      const e=obj.e,p=project(e.x,e.y);const faction=this.state.players[e.side].faction;const orc=faction==='orcs';const color=FACTIONS[faction].color;const selected=this.selected.includes(e.id);const dead=e.hp<=0;const alpha=dead?.35:e.illusion&&e.side===this.playerView.side?.5:1;
      g.fillStyle(0x14201c,.38).fillEllipse(p.x+4,p.y+4,e.kind==='building'?70:27,e.kind==='building'?30:12);
      if(selected){g.lineStyle(2,e.side===0?0xe5d98e:0xec7269,1).strokeEllipse(p.x,p.y+2,e.kind==='building'?82:35,e.kind==='building'?39:17);}
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
        if(e.progress<1){g.fillStyle(0x182b2a,.6).fillRect(p.x-34,y-12,68,6);g.fillStyle(0xe4c578).fillRect(p.x-34,y-12,68*e.progress,6);}
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
        if(e.momentum>0){g.lineStyle(2,0xe8a24e,.7).strokeEllipse(p.x,p.y+2,28+e.momentum,13);}
      }
      if(!dead&&(selected||e.hp<e.maxHp)){
        const w=e.kind==='building'?54:30,y=p.y-(e.kind==='building'?95:46);g.fillStyle(0x182426,.9).fillRect(p.x-w/2-1,y-1,w+2,5);g.fillStyle(e.side===0?0xa8cc85:0xd87560).fillRect(p.x-w/2,y,w*Math.max(0,e.hp/e.maxHp),3);
      }
    }
    for(let i=0;i<this.state.terrain.length;i++)if(this.state.terrain[i]==='shallows'&&i%7===0&&this.state.explored[0].has(i)){const p=project(i%this.state.width+.5,Math.floor(i/this.state.width)+.5);this.art.environment(`reeds:${i}`,'reeds',p.x,p.y);}
    for(const r of remembered)if(r.kind==='wood'&&r.amount<=0&&this.state.explored[0].has(Math.floor(r.y)*this.state.width+Math.floor(r.x))){const p=project(r.x,r.y);this.art.environment(`resource:${r.id}`,'stump',p.x,p.y);}
    this.art.end();
  }
  private drawFog(){const g=this.fog;g.clear();for(let y=0;y<this.state.height;y++)for(let x=0;x<this.state.width;x++){const i=y*this.state.width+x;if(this.state.visible[0].has(i))continue;const p=project(x+.5,y+.5);this.diamond(g,p.x,p.y,65,33,0x102022,this.state.explored[0].has(i)?.48:.98);}}
  private drawOverlay(){
    const g=this.overlay;g.clear();const p=this.input.activePointer;const world=this.cameras.main.getWorldPoint(p.x,p.y);
    for(const corpse of this.state.corpses){
      if(!isVisible(this.state,0,corpse.x,corpse.y))continue;
      const c=project(corpse.x,corpse.y);g.lineStyle(2,0xbbb79f,.6).lineBetween(c.x-5,c.y-2,c.x+5,c.y+2);g.lineBetween(c.x-5,c.y+2,c.x+5,c.y-2);
    }
    for(const unit of this.state.entities){
      if(unit.hp<=0||!this.visible(unit))continue;
      const c=project(unit.x,unit.y);
      // Ownership stays readable when both armies have the same faction artwork.
      g.fillStyle(unit.side===0?0xb9e493:0xf08572,.95).fillTriangle(c.x-3,c.y+6,c.x+3,c.y+6,c.x,c.y+11);
      if((unit.shield??0)>0){g.lineStyle(1,0xb59af0,.35+.45*(unit.shield!/unit.maxShield!)).strokeEllipse(c.x,c.y-14,35,39);}
      if((unit.surgeUntil??0)>this.state.time){g.lineStyle(2,0x83d5cf,.7).strokeEllipse(c.x,c.y+2,36,16);}
      if(unit.entrenchedAt!==undefined){
        const ready=this.state.time-unit.entrenchedAt>=3;g.lineStyle(ready?3:1,0xedc675,ready?.85:.4).strokeRect(c.x-16,c.y-8,32,16);
        if(unit.role==='special'&&this.selected.includes(unit.id)){
          const range=FACTIONS[this.state.players[unit.side].faction].units.special.range+(ready?3:0);
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
      g.fillStyle(0x182426,.9).fillRect(q.x-w/2-1,y-1,w+2,5);g.fillStyle(e.side===0?0xa8cc85:0xd87560).fillRect(q.x-w/2,y,w*Math.max(0,e.hp/e.maxHp),3);
      if(e.kind==='building'&&e.progress<1){g.fillStyle(0x182b2a,.8).fillRect(q.x-27,y+7,54,4);g.fillStyle(0xe4c578).fillRect(q.x-27,y+7,54*e.progress,4);}
    }
    if(this.drag&&Math.hypot(p.x-this.drag.x,p.y-this.drag.y)>6&&!this.buildRole){g.lineStyle(1,0xe5dca6).strokeRect(this.drag.wx,this.drag.wy,world.x-this.drag.wx,world.y-this.drag.wy);g.fillStyle(0xd6e9a5,.12).fillRect(this.drag.wx,this.drag.wy,world.x-this.drag.wx,world.y-this.drag.wy);}
    if(this.buildRole){const pos=unproject(world.x,world.y);const x=Math.floor(pos.x)+.5,y=Math.floor(pos.y)+.5,q=project(x,y);const valid=canPlace(this.state,0,this.buildRole,x,y);const size=FACTIONS[this.state.players[0].faction].buildings[this.buildRole].size;this.diamond(g,q.x,q.y,size*64,size*32,valid?0xa6d99a:0xe27964,.5);}
    for(const building of this.state.entities){
      if(building.side!==0||building.hp<=0||!building.rally||!this.selected.includes(building.id))continue;
      const from=project(building.x,building.y),to=project(building.rally.x,building.rally.y);
      g.lineStyle(1,0xe4c578,.55).lineBetween(from.x,from.y,to.x,to.y);
      g.lineStyle(2,0xe4c578,1).strokeEllipse(to.x,to.y,22,11).lineBetween(to.x,to.y,to.x,to.y-32);
      g.fillStyle(0xe4c578,1).fillTriangle(to.x,to.y-32,to.x+18,to.y-26,to.x,to.y-20);
    }
    this.markers=this.markers.filter(m=>this.time.now-m.born<700);for(const m of this.markers){const age=(this.time.now-m.born)/700;g.lineStyle(2,m.attack?0xe38b6b:0xf0dfa3,1-age).strokeEllipse(m.x,m.y,15+age*35,7+age*17);}
    this.game.canvas.style.cursor=this.buildRole||this.attackMode?'crosshair':'default';
  }
}
