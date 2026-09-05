import Phaser from 'phaser';
import type { Entity, GameState, BuildingRole, UnitRole } from '../core/types';
import { FACTIONS } from '../core/content';

interface Animation {frames:number;fps:number;loop:boolean;directions:Record<string,string[]>}
interface Asset {kind:'unit'|'building'|'environment';width:number;height:number;anchor:[number,number];visualTop?:number;pages?:string[];animations?:Record<string,Animation>;image?:string}
interface Manifest {schemaVersion:number;assets:Record<string,Asset>;atlases:{key:string;image:string;data:string}[]}
/** Presentation only: simulation roles resolve through faction content IDs. */
export default class ArtRuntime {
  manifest:Manifest|null=null;
  private sprites=new Map<string,Phaser.GameObjects.Image>();
  private seen=new Set<string>();
  private frames=new Map<string,string>();
  private terrain:Phaser.GameObjects.RenderTexture|null=null;
  private complete=false;
  public renderedUnits=0;
  constructor(private scene:Phaser.Scene,public enabled=true){}
  preload(){
    if(!this.enabled)return;
    this.scene.load.once('filecomplete-json-rts-manifest',(_key:string,_type:string,data:Manifest)=>{
      if(data.schemaVersion!==1)return;
      this.manifest=data;
      for(const atlas of data.atlases)this.scene.load.atlas(atlas.key,atlas.image,atlas.data);
      for(const [id,asset] of Object.entries(data.assets))if(asset.kind==='environment'&&asset.image)this.scene.load.image(`env:${id}`,asset.image);
    });
    this.scene.load.json('rts-manifest','/assets/manifest.json');
  }
  ready(){
    if(!this.manifest)return;
    let unique=true;
    for(const atlas of this.manifest.atlases){if(!this.scene.textures.exists(atlas.key))continue;for(const name of this.scene.textures.get(atlas.key).getFrameNames()){if(this.frames.has(name))unique=false;this.frames.set(name,atlas.key);}}
    const factionIds=Object.values(FACTIONS).flatMap(f=>[...Object.values(f.units),...Object.values(f.buildings)].map(a=>a.id));
    const environmentIds=['tile-grass-0','tile-grass-1','tile-grass-2','tile-grass-3','tile-dirt-0','tile-dirt-1','tile-dirt-2','tile-stone','tree-pine','tree-oak','ore','stump','ruin-pillar','ruin-ring','flowers'];
    this.complete=unique&&factionIds.every(id=>!!this.manifest!.assets[id])&&environmentIds.every(id=>this.hasEnvironment(id))&&this.manifest.atlases.every(a=>this.scene.textures.exists(a.key))&&Object.entries(this.manifest.assets).every(([id,a])=>a.kind==='environment'?this.hasEnvironment(id):!!a.animations&&Object.values(a.animations).every(animation=>Object.values(animation.directions).every(names=>names.length===animation.frames&&names.every(name=>a.pages?.includes(this.frames.get(name)??'')))));
  }
  get loaded(){return this.complete;}
  get assetCount(){return this.manifest?Object.keys(this.manifest.assets).length:0;}
  hasEnvironment(id:string){return this.manifest?.assets[id]?.kind==='environment'&&this.scene.textures.exists(`env:${id}`);}
  begin(){this.seen.clear();this.renderedUnits=0;}
  end(){for(const [key,sprite] of this.sprites)if(!this.seen.has(key)){sprite.destroy();this.sprites.delete(key);}}
  reset(){for(const sprite of this.sprites.values())sprite.destroy();this.sprites.clear();}
  top(key:string):number|null{const sprite=this.sprites.get(key);return sprite&&sprite.getData('visualTop')!==undefined?sprite.y-sprite.displayOriginY+sprite.getData('visualTop'):null;}
  /** Null means this object is still using placeholder art. Sample only on clicks. */
  contains(key:string,x:number,y:number):boolean|null{
    const sprite=this.sprites.get(key);if(!sprite)return null;
    const px=Math.floor(x-sprite.x+sprite.displayOriginX);
    const py=Math.floor(y-sprite.y+sprite.displayOriginY);
    if(px<0||py<0||px>=sprite.width||py>=sprite.height)return false;
    return (this.scene.textures.getPixelAlpha(px,py,sprite.texture.key,sprite.frame.name)??0)>32;
  }
  private place(key:string,asset:Asset,texture:string,frame:string|undefined,x:number,y:number,depth:number,alpha=1){
    let sprite=this.sprites.get(key);
    if(!sprite){sprite=this.scene.add.image(x,y,texture,frame);this.sprites.set(key,sprite);}
    else if(sprite.texture.key!==texture||sprite.frame.name!==(frame??sprite.texture.firstFrame))sprite.setTexture(texture,frame);
    const originX=asset.anchor[0]/asset.width,originY=asset.anchor[1]/asset.height;
    if(sprite.originX!==originX||sprite.originY!==originY)sprite.setOrigin(originX,originY);
    if(sprite.x!==x||sprite.y!==y)sprite.setPosition(x,y);
    // Phaser queues a scene-wide depth sort even when the value is unchanged.
    if(sprite.depth!==depth)sprite.setDepth(depth);
    if(sprite.alpha!==alpha)sprite.setAlpha(alpha);
    if(asset.visualTop!==undefined&&sprite.getData('visualTop')!==asset.visualTop)sprite.setData('visualTop',asset.visualTop);
    this.seen.add(key);return true;
  }
  environment(key:string,id:string,x:number,y:number){
    const asset=this.manifest?.assets[id];if(!asset||!this.hasEnvironment(id))return false;
    return this.place(key,asset,`env:${id}`,undefined,x,y,y);
  }
  entity(e:Entity,state:GameState,x:number,y:number){
    const faction=FACTIONS[state.players[e.side].faction];
    const id=e.kind==='unit'?faction.units[e.role as UnitRole].id:faction.buildings[e.role as BuildingRole].id;
    const asset=this.manifest?.assets[id];if(!asset?.animations)return false;
    let name=e.hp<=0?'death':e.kind==='building'?(e.progress<1?'construction':'idle'):e.animation;
    // The simulation's short attack marker must not truncate a longer rendered recovery.
    const attack=asset.animations.attack;
    if(e.kind==='unit'&&name==='idle'&&e.cooldown>0&&attack&&e.animTime<attack.frames/attack.fps)name='attack';
    const animation=asset.animations[name]??asset.animations.idle;if(!animation)return false;
    const direction=String(e.kind==='building'?0:((Math.round(e.facing)%8)+8)%8);
    const frames=animation.directions[direction]??animation.directions['0'];if(!frames?.length)return false;
    let index=0;
    if(name==='construction')index=Math.min(frames.length-1,Math.floor(e.progress*frames.length));
    else if(name==='death')index=Math.min(frames.length-1,Math.floor(e.animTime/1.2*frames.length));
    else {const tick=Math.floor(e.animTime*Math.max(1,animation.fps));const working=name==='attack'&&e.role==='worker'&&['gather','build','repair'].includes(e.order.type);index=animation.loop||working?tick%frames.length:Math.min(tick,frames.length-1);}
    const frame=frames[index],texture=this.frames.get(frame);if(!texture)return false;
    if(e.kind==='unit'&&e.hp>0)this.renderedUnits++;
    return this.place(`entity:${e.id}`,asset,texture,frame,x,y,y,e.illusion?.55:1);
  }
  ground(state:GameState,project:(x:number,y:number)=>{x:number;y:number}){
    this.terrain?.destroy();this.terrain=null;
    if(!this.hasEnvironment('tile-grass-0'))return;
    const rt=this.scene.add.renderTexture(0,0,3240,1700).setOrigin(0,0).setDepth(-100);this.terrain=rt;

    for(let y=0;y<state.height;y++)for(let x=0;x<state.width;x++){
      const n=((x*73856093)^(y*19349663)^(state.seed||7))>>>0;
      const path=Math.abs(x-y)<2||Math.abs(x+y-47)<1.5&&Math.abs(x-y)<14;
      let id=Math.hypot(x-23.5,y-23.5)<3?'tile-stone':path?`tile-dirt-${n%3}`:`tile-grass-${n%4}`;
      if(!this.hasEnvironment(id))id='tile-grass-0';
      const asset=this.manifest!.assets[id],p=project(x+.5,y+.5);
      rt.stamp(`env:${id}`,undefined,p.x-asset.anchor[0],p.y-asset.anchor[1],{originX:0,originY:0});
    }
    rt.render();
  }
}
