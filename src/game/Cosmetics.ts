import { FACTIONS } from '../core/content';
import type { FactionId, Vec } from '../core/types';
import { COSMETICS } from '../online/cosmetics';
import type { Cosmetic, CosmeticEquipment } from '../online/cosmetics';

export interface CosmeticLoadout {banner?:Cosmetic;decoration?:Cosmetic;portrait?:Cosmetic}
export function resolveCosmeticLoadout(factionId:FactionId,equipment:CosmeticEquipment):CosmeticLoadout{
  return Object.fromEntries((['banner','decoration','portrait'] as const).flatMap(slot=>{const item=COSMETICS.find(item=>item.id===equipment[slot]&&item.factionId===factionId&&item.slot===slot);return item?[[slot,item]]:[];}));
}
const emblems:Record<FactionId,string>={orcs:'<path d="M29 30h38v28L48 73 29 58z"/><path d="M38 39h20v8H38z" fill="#101c20"/>',fairies:'<path d="M48 24c-27 6-28 31 0 49 28-18 27-43 0-49z"/><path d="M48 34v28M35 42l13 11 13-11" stroke="#101c20" fill="none" stroke-width="4"/>',dwarves:'<path d="M31 28h34v12H54v30H42V40H31z"/>',undead:'<path d="M30 29h36v30H56v13H40V59H30z"/><path d="M35 39h10v10H35zm17 0h10v10H52z" fill="#101c20"/>',tideborn:'<path d="M27 39c14-16 29-16 42 0-7 24-14 31-21 34-8-3-16-10-21-34z"/><path d="M32 49q16-13 32 0M36 59q12-10 24 0" fill="none" stroke="#101c20" stroke-width="4"/>',automata:'<path d="m48 24 23 14v27L48 78 25 65V38z"/><path d="m48 37 11 7v14l-11 7-11-7V44z" fill="#101c20"/>'};
export function cosmeticSvg(item:Cosmetic):string{
  const color='#'+FACTIONS[item.factionId].color.toString(16).padStart(6,'0'),accent=FACTIONS[item.factionId].accent;
  const backdrop=item.slot==='banner'?`<path d="M18 10h60v65L48 90 18 75z" fill="${color}" stroke="${accent}" stroke-width="3"/>`:item.slot==='decoration'?`<circle cx="48" cy="48" r="39" fill="#162a27" stroke="${accent}" stroke-width="5"/><path d="m13 72 5 15 14-9m51-6-5 15-14-9" stroke="${accent}" fill="none" stroke-width="5"/>`:`<rect x="8" y="8" width="80" height="80" rx="14" fill="#172628" stroke="${accent}" stroke-width="3"/><path d="M22 82q2-29 26-29t26 29" fill="${color}"/><circle cx="48" cy="39" r="20" fill="${accent}"/><path d="M28 38V22l20-9 20 9v16l-8-10H36z" fill="${color}"/><path d="M37 40h5m12 0h5m-17 12h12" stroke="#101c20" stroke-width="3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><title>${item.name}</title>${backdrop}${item.slot==='portrait'?'':`<g fill="${accent}">${emblems[item.factionId]}</g>`}</svg>`;
}
export const cosmeticImage=(item:Cosmetic)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(cosmeticSvg(item));

/** Phaser Graphics implements this interface. The caller must already enforce building visibility. */
export interface CosmeticGraphics {
  fillStyle(color:number,alpha?:number):unknown;lineStyle(width:number,color:number,alpha?:number):unknown;
  fillRect(x:number,y:number,width:number,height:number):unknown;strokeRect(x:number,y:number,width:number,height:number):unknown;
  lineBetween(x1:number,y1:number,x2:number,y2:number):unknown;fillTriangle(x1:number,y1:number,x2:number,y2:number,x3:number,y3:number):unknown;
  fillCircle(x:number,y:number,radius:number):unknown;strokeCircle(x:number,y:number,radius:number):unknown;
}
function drawEmblem(g:CosmeticGraphics,factionId:FactionId,x:number,y:number,r:number,color:number){
  g.fillStyle(color,1);
  if(factionId==='orcs'){g.fillRect(x-r,y-r,2*r,1.3*r);g.fillTriangle(x-r,y+.3*r,x+r,y+.3*r,x,y+r);}
  else if(factionId==='fairies'){g.fillTriangle(x,y-r,x+r,y,x,y+r);g.fillTriangle(x,y-r,x-r,y,x,y+r);g.lineStyle(1,0x132322,1);g.lineBetween(x,y-r*.6,x,y+r*.6);}
  else if(factionId==='dwarves'){g.fillRect(x-r,y-r,2*r,r*.7);g.fillRect(x-r*.25,y-r*.3,r*.5,r*1.5);}
  else if(factionId==='undead'){g.fillRect(x-r,y-r,2*r,1.5*r);g.fillRect(x-r*.5,y+.5*r,r,r*.5);g.fillStyle(0x132322,1);g.fillRect(x-r*.7,y-r*.4,r*.45,r*.45);g.fillRect(x+r*.25,y-r*.4,r*.45,r*.45);}
  else if(factionId==='tideborn'){g.fillCircle(x,y-r*.2,r*.9);g.fillTriangle(x-r*.8,y,x+r*.8,y,x,y+r);g.lineStyle(1,0x132322,1);g.lineBetween(x-r*.5,y,x+r*.5,y);}
  else{g.fillTriangle(x,y-r,x+r,y-r*.4,x+r,y+r*.4);g.fillTriangle(x,y-r,x-r,y-r*.4,x-r,y+r*.4);g.fillTriangle(x-r,y+r*.4,x+r,y+r*.4,x,y+r);g.fillRect(x-r,y-r*.4,2*r,r*.8);g.fillStyle(0x132322,1);g.fillCircle(x,y,r*.4);}
}
/** Equipment lives in an account profile, never in GameState or replay checksums. */
export function drawCosmeticBuilding(g:CosmeticGraphics,loadout:CosmeticLoadout,position:Vec,roofY:number){
  if(loadout.banner){const faction=FACTIONS[loadout.banner.factionId],accent=parseInt(faction.accent.slice(1),16),x=position.x+29,y=roofY+18;
    g.lineStyle(3,0x111a20,1);g.lineBetween(x,y-25,x,position.y+4);g.lineStyle(1,accent,1);g.lineBetween(x,y-25,x,position.y+4);
    g.fillStyle(faction.color,1);g.fillRect(x+1,y-24,18,12);g.fillTriangle(x+19,y-24,x+25,y-18,x+19,y-12);g.lineStyle(1,accent,1);g.strokeRect(x+1,y-24,18,12);drawEmblem(g,loadout.banner.factionId,x+10,y-18,4,accent);
  }
  if(loadout.decoration){const accent=parseInt(FACTIONS[loadout.decoration.factionId].accent.slice(1),16),x=position.x,y=roofY+28;
    g.fillStyle(0x14201c,.95);g.fillCircle(x,y,10);g.lineStyle(2,accent,1);g.strokeCircle(x,y,9);drawEmblem(g,loadout.decoration.factionId,x,y,6,accent);g.lineStyle(2,accent,1);g.lineBetween(x-15,y-1,x-10,y-1);g.lineBetween(x+10,y-1,x+15,y-1);
  }
}
