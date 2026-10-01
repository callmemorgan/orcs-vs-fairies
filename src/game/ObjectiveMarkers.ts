import Phaser from 'phaser';
import type { MatchRules } from '../core/match-rules';
interface MarkerObjectives {
 hill:{x:number;y:number;ownerTeam:number|null;captureTeam:number|null;captureTicks:number;holdTicks:number;contested:boolean};
 relics:Array<{id:number;x:number|null;y:number|null;carrierId:number|null;heldTeam:number|null}>;
}
/** Receives the permitted objective view, including masked enemy-carrier coordinates. */
export class ObjectiveMarkers {
 private readonly graphics:Phaser.GameObjects.Graphics;
 private readonly labels:Phaser.GameObjects.Text[]=[];
 constructor(private readonly scene:Phaser.Scene,private readonly project:(x:number,y:number)=>{x:number;y:number},private readonly depth=100002){this.graphics=scene.add.graphics().setDepth(depth);}
 update(rules:MatchRules|undefined,objectives:MarkerObjectives|undefined,colorForTeam:(team:number)=>number=team=>[0xefb86b,0x8fbded,0xf08c7c,0xb9a0ef,0x9dcc82,0xe99cc4,0x82d7d3,0xe0d78a][team%8]):void {
  this.graphics.clear();this.labels.forEach(label=>label.setVisible(false));if(!rules||!objectives)return;let index=0;
  const label=(x:number,y:number,text:string)=>{const node=this.labels[index]??this.scene.add.text(0,0,'',{fontSize:'14px',fontFamily:'sans-serif',color:'#fff',backgroundColor:'#172329dd',padding:{x:5,y:3}}).setOrigin(.5).setDepth(this.depth+1);this.labels[index++]=node;node.setPosition(x,y).setText(text).setVisible(true);};
  if(rules.mode==='hill'){
   const hill=objectives.hill,{x,y}=this.project(hill.x,hill.y),color=hill.contested?0xffffff:hill.ownerTeam===null?0xe2c35c:colorForTeam(hill.ownerTeam);
   const points=Array.from({length:64},(_,i)=>this.project(hill.x+Math.cos(i*Math.PI/32)*rules.hill.radius,hill.y+Math.sin(i*Math.PI/32)*rules.hill.radius));
   this.graphics.lineStyle(3,color,.9).fillStyle(color,.06).beginPath().moveTo(points[0].x,points[0].y);for(const point of points.slice(1))this.graphics.lineTo(point.x,point.y);this.graphics.closePath().fillPath().strokePath();
   this.graphics.lineStyle(2,color,.7).beginPath().moveTo(x-12,y).lineTo(x+12,y).moveTo(x,y-12).lineTo(x,y+12).strokePath();
   label(x,Math.min(...points.map(point=>point.y))-14,`Hill · ${hill.contested?'contested':hill.ownerTeam===null?'unclaimed':`Team ${hill.ownerTeam+1}`} · ${Math.floor(hill.holdTicks/20)}/${Math.ceil(rules.hill.holdTicks/20)}s`);
  }
  if(rules.mode==='relic')for(const relic of objectives.relics){if(relic.x===null||relic.y===null)continue;const {x,y}=this.project(relic.x,relic.y),color=relic.heldTeam===null?0xf3dc75:colorForTeam(relic.heldTeam),size=9;
   this.graphics.fillStyle(color,.95).lineStyle(2,0x292014,1).beginPath().moveTo(x,y-size).lineTo(x+size,y).lineTo(x,y+size).lineTo(x-size,y).closePath().fillPath().strokePath();
   label(x,y-23,`Relic ${relic.id}${relic.carrierId!==null?' · carried':relic.heldTeam===null?'':` · Team ${relic.heldTeam+1}`}`);
  }
 }
 destroy():void {this.graphics.destroy();this.labels.forEach(label=>label.destroy());this.labels.length=0;}
}
