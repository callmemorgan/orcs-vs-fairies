import type Phaser from 'phaser';
import type { Entity,Vec } from '../../core/types';
import { getBattlefieldAppearance } from '../../game/BattlefieldAppearance';
import type { ClientImprovement } from '../host';

export function drawTeamMarking(g:Phaser.GameObjects.Graphics,e:Entity,p:Vec,top:number){
  const color=getBattlefieldAppearance().teamColors[e.side],building=e.kind==='building',w=building?74:32,h=building?32:14;
  g.lineStyle(2,0x10212a,1).strokeEllipse(p.x,p.y+2,w+4,h+4);
  g.lineStyle(2,color,.95).strokeEllipse(p.x,p.y+2,w,h);
  let cx=p.x,cy=p.y+11;
  if(building){
    const x=p.x+32,y=top+12;
    g.lineStyle(2,0x17242b,1).lineBetween(x,y-4,x,y+25);
    g.fillStyle(color,1).fillRect(x,y,23,16);
    g.lineStyle(2,0x10212a,1).strokeRect(x,y,23,16);
    cx=x+11;cy=y+8;
  }
  g.fillStyle(building?0x10212a:color,1).lineStyle(2,0x10212a,1).beginPath();
  if(e.side===0)g.arc(cx,cy,5,0,Math.PI*2);
  else g.moveTo(cx,cy-6).lineTo(cx+6,cy).lineTo(cx,cy+6).lineTo(cx-6,cy).closePath();
  g.fillPath().strokePath();
}
export default {
  id:'feature-073',
  mount(context){const note=document.createElement('p');note.textContent='Team markings: your army uses cyan circles; the opponent uses orange diamonds.';context.menu.append(note);return {};}
} satisfies ClientImprovement;
