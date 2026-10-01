import { MATCH_START_DIRECTIONS, length2D } from './geometry';
import type { MapSize, ResourceKind, ResourceNode, TerrainKind, Vec } from './types';

export const MAP_SIZES:Record<MapSize,number>={small:36,medium:48,large:64,huge:88};
export const MAP_VERSION=2;
export const TERRAIN:Record<TerrainKind,{name:string;walkable:boolean;buildable:boolean;speed:number}>={
 grass:{name:'Meadow',walkable:true,buildable:true,speed:1},
 road:{name:'Road',walkable:true,buildable:true,speed:1.15},
 mud:{name:'Marsh',walkable:true,buildable:false,speed:.72},
 shallows:{name:'Shallows',walkable:true,buildable:false,speed:.65},
 water:{name:'Deep water',walkable:false,buildable:false,speed:0},
 rock:{name:'Cliffs',walkable:false,buildable:false,speed:0},
 bridge:{name:'Bridge',walkable:true,buildable:false,speed:1},
};
export interface GeneratedMap {size:MapSize;seed:number;width:number;height:number;terrain:TerrainKind[];starts:Vec[];resources:Omit<ResourceNode,'id'>[];version:number}
export interface MapValidation {valid:boolean;issues:string[];reachableResources:number;totalResources:number;reachableTiles:number;startsConnected:boolean}
export function seededRandom(seed:number):()=>number{
 let value=seed>>>0;
 return ()=>{value=(value+0x6d2b79f5)>>>0;let t=value;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
export function terrainAt(map:Pick<GeneratedMap,'width'|'height'|'terrain'>,x:number,y:number):TerrainKind{
 if(x<0||y<0||x>=map.width||y>=map.height)return 'rock';
 return map.terrain[Math.floor(y)*map.width+Math.floor(x)]??'grass';
}

export function generateMap(seed:number,size:MapSize='medium'):GeneratedMap{
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Map seed must be an integer from 0 to 4294967295.');
 if(!(size in MAP_SIZES))throw new Error('Map size must be small, medium, large or huge.');
 const width=MAP_SIZES[size],height=width,rng=seededRandom(seed),terrain:TerrainKind[]=Array(width*height).fill('grass');
 const base=size==='small'?7.5:8.5,starts:[Vec,Vec]=[{x:base,y:base},{x:width-base,y:height-base}];
 const map:GeneratedMap={size,seed,width,height,terrain,starts,resources:[],version:MAP_VERSION};
 const mirror=(p:Vec):Vec=>({x:width-p.x,y:height-p.y});
 const set=(x:number,y:number,kind:TerrainKind)=>{if(x<0||y<0||x>=width||y>=height)return;terrain[y*width+x]=kind;terrain[(height-1-y)*width+(width-1-x)]=kind;};
 const disk=(cx:number,cy:number,rx:number,ry:number,kind:TerrainKind)=>{
  for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(height,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(width,Math.ceil(cx+rx));x++)if(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1)set(x,y,kind);
 };
 // Paired terrain patches vary by seed; the layout remains rotationally symmetric.
 for(let i=0;i<Math.round(width*.42);i++){
  const x=3+rng()*(width-6),y=3+rng()*(height-6),roll=rng();
  disk(x,y,1.5+rng()*3.5,1.5+rng()*3.5,roll<.42?'water':roll<.7?'mud':'rock');
 }
 const before=[...terrain];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(before[y*width+x]==='water'&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>x+dx<0||y+dy<0||x+dx>=width||y+dy>=height||before[(y+dy)*width+x+dx]!=='water'))set(x,y,'shallows');
 const carve=(a:Vec,b:Vec,radius=1.65)=>{
  const length=length2D(b.x-a.x,b.y-a.y),steps=Math.ceil(length*3);
  for(let i=0;i<=steps;i++){
   const t=steps?i/steps:0,cx=a.x+(b.x-a.x)*t,cy=a.y+(b.y-a.y)*t;
   for(let y=Math.max(0,Math.floor(cy-radius));y<Math.min(height,Math.ceil(cy+radius));y++)for(let x=Math.max(0,Math.floor(cx-radius));x<Math.min(width,Math.ceil(cx+radius));x++)if(length2D(x+.5-cx,y+.5-cy)<=radius){const old=terrain[y*width+x];set(x,y,old==='water'||old==='shallows'||old==='bridge'?'bridge':'road');}
  }
 };
 const center={x:width/2,y:height/2},bend={x:width*(.32+rng()*.08),y:height*(.32+rng()*.08)};
 carve(starts[0],bend);carve(bend,center);
 const flank={x:width*(.19+rng()*.08),y:height*(.58+rng()*.09)};
 carve(starts[0],flank,1.2);carve(flank,mirror(flank),1.2);
 // A broad clear base pad keeps the opening independent of terrain luck.
 disk(starts[0].x,starts[0].y,8.1,8.1,'grass');
 const addPair=(p:Vec,kind:ResourceKind,amount:number)=>{
  const q=mirror(p);
  if(length2D(p.x-q.x,p.y-q.y)<2.2)return false;
  if(map.resources.some(r=>length2D(r.x-p.x,r.y-p.y)<2.05||length2D(r.x-q.x,r.y-q.y)<2.05))return false;
  for(const point of [p,q])map.resources.push({...point,kind,amount,maxAmount:amount});
  disk(p.x,p.y,1.75,1.75,'grass');return true;
 };
 // Each side has the same modest crystal reserve; richer deposits are contested.
 for(const [dx,dy,kind,amount] of [[-4,4,'wood',2600],[-2,6,'wood',2600],[-5,1,'wood',2600],[5,-3,'ore',2800],[6,0,'ore',2800],[5,4,'crystal',180]] as const)addPair({x:base+dx,y:base+dy},kind,amount);
 const clusters=size==='small'?2:size==='medium'?3:size==='large'?5:8;
 for(let i=0;i<clusters;i++){
  const t=.42+(i/Math.max(1,clusters-1))*.45;
  const p={x:Math.floor(base+(center.x-base)*t+(rng()-.5)*10)+.5,y:Math.floor(base+(center.y-base)*t+(rng()-.5)*10)+.5};
  for(const [dx,dy,kind,amount] of [[-2,0,'wood',3000],[0,2,'ore',2200],[2,0,'crystal',400]] as const){
   const q={x:Math.max(2.5,Math.min(width-2.5,p.x+dx)),y:Math.max(2.5,Math.min(height-2.5,p.y+dy))};
   if(starts.some(a=>length2D(a.x-q.x,a.y-q.y)<7))continue;
   if(addPair(q,kind,amount)){
    // Link each deposit to the road network with a navigable branch.
    let nearest:Vec|undefined,best=Infinity;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(terrain[y*width+x]==='road'||terrain[y*width+x]==='bridge'){const d=length2D(q.x-x-.5,q.y-y-.5);if(d<best){best=d;nearest={x:x+.5,y:y+.5};}}
    if(nearest)carve(q,nearest,1.1);
   }
  }
 }
 // Rich flank camps give larger maps an economic reason to explore away from the front.
 // A clear center leaves room for an expansion HQ; deposits sit around its edge.
 if(size==='large'||size==='huge'){
  const camps=[{x:Math.floor(width*.23)+.5,y:Math.floor(width*.58)+.5}];
  if(size==='huge')camps.push({x:Math.floor(width*.18)+.5,y:Math.floor(width*.37)+.5});
  for(const camp of camps){
   disk(camp.x,camp.y,6,6,'grass');carve(camp,flank,1.3);
   for(const [dx,dy,kind,amount] of [[-4,-2,'wood',4000],[4,-2,'ore',3500],[0,4,'crystal',750]] as const)addPair({x:camp.x+dx,y:camp.y+dy},kind,amount);
  }
 }
 // Keep the edge impassable and every base pad buildable after branch carving.
 for(let i=0;i<width;i++){set(i,0,'rock');set(0,i,'rock');}
 const validation=validateMap(map);
 if(!validation.valid)throw new Error(`Invalid generated map ${size}/${seed}: ${validation.issues.join('; ')}`);
 return map;
}

/** Keep legacy duel maps intact; larger matches get equal reserves and connected base pads. */
export function generateMatchMap(seed:number,size:MapSize='medium',playerCount=2):GeneratedMap{
 if(!Number.isInteger(playerCount)||playerCount<1||playerCount>8)throw new Error('Player count must be an integer from 1 to 8.');
 if(!(size in MAP_SIZES))throw new Error('Map size must be small, medium, large or huge.');
 const actualSize=playerCount>4?'huge':playerCount>2&&MAP_SIZES[size]<MAP_SIZES.large?'large':size;
 const map=generateMap(seed,actualSize);
 if(playerCount===2)return map;
 if(playerCount===1)return {...map,starts:[map.starts[0]]};
 const {width,height,terrain}=map,center={x:width/2,y:height/2},radius=width/2-10.5;
 // Even spacing leaves room for each entire opening army, its HQ and its six deposits.
 map.starts=MATCH_START_DIRECTIONS[playerCount].map(([dx,dy])=>({x:Math.floor(center.x+dx*radius)+.5,y:Math.floor(center.y+dy*radius)+.5}));
 // Original deposits belong to the duel layout. Replacing them avoids unequal reserves
 // and deposits colliding with any of the new HQs or opening workers.
 map.resources=[];
 const paintDisk=(p:Vec,r:number,kind:TerrainKind)=>{
  for(let y=Math.max(1,Math.floor(p.y-r));y<Math.min(height-1,Math.ceil(p.y+r));y++)for(let x=Math.max(1,Math.floor(p.x-r));x<Math.min(width-1,Math.ceil(p.x+r));x++)if(length2D(x+.5-p.x,y+.5-p.y)<=r)terrain[y*width+x]=kind;
 };
 const carve=(a:Vec,b:Vec,r=1.8)=>{
  const steps=Math.ceil(length2D(b.x-a.x,b.y-a.y)*3);
  for(let i=0;i<=steps;i++){
   const t=steps?i/steps:0,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
   for(let y=Math.max(1,Math.floor(p.y-r));y<Math.min(height-1,Math.ceil(p.y+r));y++)for(let x=Math.max(1,Math.floor(p.x-r));x<Math.min(width-1,Math.ceil(p.x+r));x++)if(length2D(x+.5-p.x,y+.5-p.y)<=r){const old=terrain[y*width+x];terrain[y*width+x]=old==='water'||old==='shallows'||old==='bridge'?'bridge':'road';}
  }
 };
 // The outer connections permit flanking and prevent all traffic sharing one junction.
 for(let slot=0;slot<playerCount;slot++){carve(map.starts[slot],center);carve(map.starts[slot],map.starts[(slot+1)%playerCount]);}
 paintDisk(center,7,'grass');
 for(const start of map.starts)paintDisk(start,8.1,'grass');
 const addResource=(point:Vec,kind:ResourceKind,amount:number)=>{
  if(map.resources.some(r=>length2D(point.x-r.x,point.y-r.y)<2.05))throw new Error('Multiplayer resource clusters overlap.');
  map.resources.push({...point,kind,amount,maxAmount:amount});paintDisk(point,1.75,'grass');
 };
 for(const start of map.starts){
  // Match the opening formation's orientation so gathering distance is equal as well
  // as reserve amounts, including bases selected through a different starting slot.
  const dir=start.y<height/2?1:-1;
  for(const [dx,dy,kind,amount] of [[-4,4,'wood',2600],[-2,6,'wood',2600],[-5,1,'wood',2600],[5,-3,'ore',2800],[6,0,'ore',2800],[5,4,'crystal',180]] as const)addResource({x:start.x+dx*dir,y:start.y+dy*dir},kind,amount);
 }
 // Each base faces one equivalent rich camp toward the center. Its deposits are beyond
 // the private reserve radius and all connect to the common road network.
 for(const start of map.starts){
  const dx=start.x-center.x,dy=start.y-center.y,length=length2D(dx,dy),outward={x:dx/length,y:dy/length},tangent={x:-outward.y,y:outward.x};
  const camp={x:center.x+outward.x*radius*.42,y:center.y+outward.y*radius*.42};
  carve(camp,center,1.5);paintDisk(camp,4.5,'grass');
  for(const [along,across,kind,amount] of [[0,-2.5,'wood',4000],[0,2.5,'ore',3500],[2.5,0,'crystal',750]] as const){
   const point={x:camp.x+outward.x*along+tangent.x*across,y:camp.y+outward.y*along+tangent.y*across};
   carve(point,camp,1.3);addResource(point,kind,amount);
  }
 }
 const validation=validateMap(map);
 if(!validation.valid)throw new Error(`Invalid generated match map ${actualSize}/${seed}/${playerCount}: ${validation.issues.join('; ')}`);
 return map;
}

export function validateMap(map:GeneratedMap):MapValidation{
 const {width,height,starts,resources,terrain}=map,issues:string[]=[];
 if(terrain.length!==width*height)issues.push('Terrain dimensions do not match.');
 if(!starts.length||starts.length>8)issues.push('Starting positions must number 1 through 8.');
 if(starts.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<2.5||p.y<2.5||p.x>width-2.5||p.y>height-2.5))issues.push('Starting positions lie outside the playable map.');
 const free=(x:number,y:number)=>x>=0&&y>=0&&x<width&&y<height&&TERRAIN[terrain[y*width+x]??'rock'].walkable&&!resources.some(r=>r.amount>0&&length2D(r.x-x-.5,r.y-y-.5)<.7)&&!starts.some(p=>Math.abs(p.x-x-.5)<1.77&&Math.abs(p.y-y-.5)<1.77);
 // Preserve the duel's two reference points; other matches require every HQ approach.
 const approaches=starts.length===2?[{x:Math.floor(starts[0].x),y:Math.floor(starts[0].y+3)},{x:Math.floor(starts[1].x),y:Math.floor(starts[1].y-3)}]:starts.flatMap(p=>[[0,3],[0,-3],[3,0],[-3,0]].map(([dx,dy])=>({x:Math.floor(p.x+dx),y:Math.floor(p.y+dy)})));
 const origin=approaches[0];
 const seen=new Set<number>(),queue:number[]=[];
 if(origin&&free(origin.x,origin.y)){seen.add(origin.y*width+origin.x);queue.push(origin.y*width+origin.x);}
 for(let i=0;i<queue.length;i++){const key=queue[i],x=key%width,y=Math.floor(key/width);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=ny*width+nx;if(!seen.has(k)&&free(nx,ny)){seen.add(k);queue.push(k);}}}
 const startsConnected=approaches.length>0&&approaches.every(p=>seen.has(p.y*width+p.x));if(!startsConnected)issues.push('Starting armies are disconnected.');
 let reachableResources=0;
 for(const r of resources){let reached=false;for(let y=Math.floor(r.y)-1;y<=Math.floor(r.y)+1;y++)for(let x=Math.floor(r.x)-1;x<=Math.floor(r.x)+1;x++)if(seen.has(y*width+x)&&length2D(x+.5-r.x,y+.5-r.y)<=1.25)reached=true;if(reached)reachableResources++;else issues.push(`Unreachable ${r.kind} at ${r.x},${r.y}.`);}
 for(const start of starts)for(const kind of ['wood','ore','crystal'] as const)if(!resources.some(r=>r.kind===kind&&length2D(r.x-start.x,r.y-start.y)<9))issues.push(`Missing starting ${kind}.`);
 if(starts.length===2){
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(terrain[y*width+x]!==terrain[(height-1-y)*width+width-1-x]){issues.push('Terrain is not symmetric.');break;}
  for(const r of resources)if(!resources.some(q=>q.kind===r.kind&&q.amount===r.amount&&q.x===width-r.x&&q.y===height-r.y))issues.push('Resource pair is not symmetric.');
 }
 return {valid:issues.length===0,issues,reachableResources,totalResources:resources.length,reachableTiles:seen.size,startsConnected};
}
