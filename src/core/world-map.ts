import { generateMatchMap, MAP_VERSION, seededRandom, TERRAIN } from './maps';
import type { GeneratedMap } from './maps';
import type { GameState, MapSize, Vec } from './types';
import type { Biome, WorldMapData, WorldPoint, WorldState } from './world-types';

export const BIOMES:readonly Biome[]=['temperate','desert','marsh','snow','forest'];
export const levelOf=(point:Vec):number=>point.level??0;
export const sameLevel=(a:Vec,b:Vec):boolean=>levelOf(a)===levelOf(b);
export const fogKey=(s:Pick<GameState,'width'|'height'>,point:Vec):number=>levelOf(point)*s.width*s.height+Math.floor(point.y)*s.width+Math.floor(point.x);
export function elevationAt(s:Pick<GameState,'width'|'height'|'world'>,point:Vec):number {
 if(point.x<0||point.y<0||point.x>=s.width||point.y>=s.height)return 0;
 return s.world?.levels[levelOf(point)]?.elevation[Math.floor(point.y)*s.width+Math.floor(point.x)]??0;
}
/** Every terrain edit clears same-level routes; derived navigation grids check revisions and tiles. */
export function setWorldTerrain(s:GameState,point:Vec,kind:GameState['terrain'][number]):boolean {
 const level=levelOf(point),tile=Math.floor(point.y)*s.width+Math.floor(point.x),terrain=level===0?s.terrain:s.world?.levels[level]?.terrain;
 if(!Object.hasOwn(TERRAIN,kind)||!terrain||point.x<0||point.y<0||point.x>=s.width||point.y>=s.height)return false;if(terrain[tile]===kind)return true;
 terrain[tile]=kind;if(s.world){s.world.levels[level].terrain[tile]=kind;s.world.revision=(s.world.revision??0)+1;for(const creature of s.world.creatures)if(levelOf(creature)===level)creature.path=[];}
 for(const entity of s.entities)if(levelOf(entity)===level)entity.path=[];return true;
}
/** A ridge more than one tile above an observer blocks the line behind it. */
export function terrainLineOfSight(s:GameState,from:Vec,to:Vec):boolean {
 if(!sameLevel(from,to))return false;if(!s.world)return true;
 const source=elevationAt(s,from),target=elevationAt(s,to),length=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.ceil(length*3);
 for(let i=1;i<steps;i++){
  const t=i/steps,p={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,level:levelOf(from)};
  const terrain=s.world.levels[p.level].terrain[Math.floor(p.y)*s.width+Math.floor(p.x)];
  if(terrain==='rock'||(elevationAt(s,p)>Math.max(source,target)+.5))return false;
 }
 return true;
}
export function validateWorldMap(value:unknown):{valid:boolean;issues:string[]} {
 const issues:string[]=[],record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 if(!record(value))return {valid:false,issues:['Map must be an object.']};
 const map=value as unknown as WorldMapData;
 if(!Number.isInteger(map.width)||!Number.isInteger(map.height)||map.width<8||map.height<8||map.width>128||map.height>128)return {valid:false,issues:['Map dimensions must be integers from8 through128.']};
 if(!Number.isSafeInteger(map.seed)||map.seed<0||map.seed>0xffffffff)issues.push('Map seed must be an unsigned32-bit integer.');
 if(!['small','medium','large','huge'].includes(map.size))issues.push('Unknown map size.');
 if(!Array.isArray(map.levels)||map.levels.length<1||map.levels.length>2)return {valid:false,issues:[...issues,'Maps require one or two levels.']};
 const area=map.width*map.height,point=(p:unknown):p is WorldPoint=>record(p)&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isInteger(p.level)&&(p.level as number)>=0&&(p.level as number)<map.levels.length&&(p.x as number)>=.5&&(p.y as number)>=.5&&(p.x as number)<=map.width-.5&&(p.y as number)<=map.height-.5;
 for(let l=0;l<map.levels.length;l++){
  const level=map.levels[l];if(!record(level)||level.id!==l||typeof level.title!=='string'||level.title.length>80)issues.push(`Invalid level${l} title or identifier.`);
  if(!Array.isArray(level?.terrain)||level.terrain.length!==area||level.terrain.some(t=>!Object.hasOwn(TERRAIN,t)))issues.push(`Level${l} terrain must contain one valid tile per map cell.`);
  if(!Array.isArray(level?.elevation)||level.elevation.length!==area||level.elevation.some(e=>!Number.isInteger(e)||e<0||e>3))issues.push(`Level${l} elevation must contain integers0 through3.`);
 }
 if(issues.some(i=>i.includes('terrain')||i.includes('elevation')))return {valid:false,issues};
 if(!Array.isArray(map.starts)||map.starts.length<1||map.starts.length>8||map.starts.some((p,i)=>!point(p)||p.slot!==i))issues.push('Starting slots must be ordered0 through7 with valid coordinates.');
 if(!Array.isArray(map.resources)||map.resources.length>2048||map.resources.some(r=>!point(r)||!['wood','ore','crystal'].includes(r.kind)||!Number.isFinite(r.amount)||!Number.isFinite(r.maxAmount)||r.amount<0||r.amount>r.maxAmount||r.maxAmount>1e9))issues.push('Invalid resource nodes.');
 if(!Array.isArray(map.sites)||map.sites.length>128||map.sites.some(p=>!point(p)||!Number.isSafeInteger(p.id)||p.id<1||!['relic','village','monster'].includes(p.kind))||new Set(map.sites?.map(p=>p.id)).size!==map.sites?.length)issues.push('Invalid or duplicate site definitions.');
 if(!Array.isArray(map.transitions)||map.transitions.length>64||map.transitions.some(t=>!record(t)||!Number.isSafeInteger(t.id)||t.id<1||!point(t.from)||!point(t.to)||t.from.level===t.to.level)||new Set(map.transitions?.map(t=>t.id)).size!==map.transitions?.length)issues.push('Invalid or duplicate level entrances.');
 if(issues.length)return {valid:false,issues};
 const key=(p:WorldPoint)=>p.level*area+Math.floor(p.y)*map.width+Math.floor(p.x),decode=(k:number):WorldPoint=>({level:Math.floor(k/area),x:k%area%map.width+.5,y:Math.floor(k%area/map.width)+.5});
 const free=(p:WorldPoint)=>p.x>=.5&&p.y>=.5&&p.x<map.width&&p.y<map.height&&TERRAIN[map.levels[p.level].terrain[Math.floor(p.y)*map.width+Math.floor(p.x)]].walkable;
 for(const t of map.transitions)if(!free(t.from)||!free(t.to))issues.push(`Entrance${t.id} must connect walkable tiles.`);
 const approaches:WorldPoint[]=[];
 for(const start of map.starts){
  if(start.x<4||start.y<4||start.x>map.width-4||start.y>map.height-4)issues.push(`Start${start.slot} has no room for its opening army.`);
  for(let y=Math.floor(start.y-1.5);y<Math.ceil(start.y+1.5);y++)for(let x=Math.floor(start.x-1.5);x<Math.ceil(start.x+1.5);x++)if(!TERRAIN[map.levels[start.level].terrain[y*map.width+x]??'rock'].buildable)issues.push(`Start${start.slot} stronghold footprint is blocked.`);
  for(const [dx,dy] of [[0,3],[0,-3],[3,0],[-3,0]])approaches.push({x:Math.floor(start.x+dx)+.5,y:Math.floor(start.y+dy)+.5,level:start.level});
 }
 const entrances=new Map<number,number[]>();for(const t of map.transitions){const a=key(t.from),b=key(t.to);entrances.set(a,[...(entrances.get(a)??[]),b]);entrances.set(b,[...(entrances.get(b)??[]),a]);}
 const seen=new Set<number>(),queue:number[]=[],origin=approaches.find(free);if(origin){queue.push(key(origin));seen.add(key(origin));}
 for(let i=0;i<queue.length;i++){
  const current=queue[i],p=decode(current),e=map.levels[p.level].elevation[current%area];
  const neighbors=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({...p,x:p.x+dx,y:p.y+dy})).filter(n=>free(n)&&Math.abs(map.levels[n.level].elevation[key(n)%area]-e)<=1).map(key);
  for(const next of [...neighbors,...(entrances.get(current)??[])])if(!seen.has(next)){seen.add(next);queue.push(next);}
 }
 if(approaches.some(p=>!seen.has(key(p))))issues.push('Starting army approaches are disconnected by terrain or steep elevation.');
 for(const r of map.resources){
  const reachable=[[0,0],[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>seen.has(key({...r,x:Math.floor(r.x)+.5+dx,y:Math.floor(r.y)+.5+dy})));
  if(!reachable)issues.push(`Unreachable${r.kind} on level${r.level} at${r.x},${r.y}.`);
 }
 for(const start of map.starts)for(const kind of ['wood','ore','crystal'])if(!map.resources.some(r=>r.kind===kind&&r.level===start.level&&Math.hypot(r.x-start.x,r.y-start.y)<9))issues.push(`Start${start.slot} lacks nearby${kind}.`);
 if(map.levels.length>1&&!map.transitions.length)issues.push('The cavern has no entrance.');
 for(const site of map.sites)if(!seen.has(key(site)))issues.push(`Site${site.id} is unreachable.`);
 return {valid:issues.length===0,issues:[...new Set(issues)]};
}

export function generateWorldMap(seed:number,size:MapSize='medium',playerCount=2,biome:Biome='forest'):WorldMapData {
 if(!BIOMES.includes(biome))throw new Error('Unknown biome.');
 const base=generateMatchMap(seed,size,playerCount),{width,height}=base,area=width*height,rng=seededRandom(seed^0x913dba12),terrain=[...base.terrain],elevation=Array(area).fill(0);
 const starts=base.starts.map((p,slot)=>({...p,level:0,slot})),resources=base.resources.map(r=>({...r,level:0}));
 const basePad=(x:number,y:number)=>starts.some(p=>Math.hypot(p.x-x,p.y-y)<8.4);
 const kind=biome==='desert'?'sand':biome==='snow'?'snow':biome==='marsh'?'mud':'grass';
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const i=y*width+x;if(terrain[i]!=='grass'||basePad(x+.5,y+.5))continue;
  terrain[i]=kind;
  if(biome==='forest'&&rng()<.24&&!resources.some(r=>Math.hypot(r.x-x-.5,r.y-y-.5)<2))terrain[i]='forest';
  // Wide graded hills leave roads at ground level and expose an attackable plateau.
  if(terrain[i]!=='forest')elevation[i]=Math.max(0,Math.min(2,Math.floor(2.3-Math.hypot(x-width*.35,y-height*.65)/5)));
 }
 // Never turn an approach into a cliff: grading follows all traversable road edges.
 for(let pass=0;pass<3;pass++)for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const i=y*width+x;if(!TERRAIN[terrain[i]].walkable)continue;
  for(const j of [i-1,i+1,i-width,i+width])if(TERRAIN[terrain[j]].walkable)elevation[i]=Math.min(elevation[i],elevation[j]+1);
 }
 const underground=Array<typeof terrain[number]>(area).fill('rock'),caveElevation=Array(area).fill(0);
 const caveDisk=(p:Vec,r=3)=>{for(let y=Math.max(1,Math.floor(p.y-r));y<Math.min(height-1,Math.ceil(p.y+r));y++)for(let x=Math.max(1,Math.floor(p.x-r));x<Math.min(width-1,Math.ceil(p.x+r));x++)if(Math.hypot(x+.5-p.x,y+.5-p.y)<=r)underground[y*width+x]='road';};
 const carve=(a:Vec,b:Vec)=>{const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*2);for(let i=0;i<=steps;i++){const t=i/steps;caveDisk({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},1.8);}};
 const center={x:width/2+.5,y:height/2+.5};caveDisk(center,8);
 const transitions=starts.map((start,index)=>{
  const entrance={x:Math.floor(start.x)+.5,y:Math.floor(start.y+(start.y<height/2?5:-5))+.5,level:0};
  // An entrance clears its tile and immediate approach on the surface.
  for(let y=Math.floor(entrance.y-1);y<=Math.floor(entrance.y+1);y++)for(let x=Math.floor(entrance.x-1);x<=Math.floor(entrance.x+1);x++)terrain[y*width+x]='road';
  caveDisk(entrance,3);carve(entrance,center);return {id:index+1,from:entrance,to:{...entrance,level:1}};
 });
 const sites:WorldMapData['sites']=[{id:1,x:center.x,y:center.y,level:1,kind:'relic'},{id:2,x:center.x-5,y:center.y,level:1,kind:'monster'},{id:3,x:center.x+5,y:center.y,level:1,kind:'village'}];
 for(const [dx,dy,resource,amount] of [[0,-5,'crystal',1800],[-4,4,'ore',3600],[4,4,'wood',3000]] as const)resources.push({x:center.x+dx,y:center.y+dy,level:1,kind:resource,amount,maxAmount:amount});
 const result:WorldMapData={width,height,size:base.size,seed,levels:[{id:0,title:`${biome[0].toUpperCase()}${biome.slice(1)} surface`,terrain,elevation},{id:1,title:'Contested caverns',terrain:underground,elevation:caveElevation}],starts,resources,sites,transitions};
 const validation=validateWorldMap(result);if(!validation.valid)throw new Error(`Invalid${biome} map: ${validation.issues.join('; ')}`);return result;
}
export function generatedMapFromWorld(input:WorldMapData,playerCount:number):GeneratedMap {
 const validation=validateWorldMap(input);if(!validation.valid)throw new Error(validation.issues.join('; '));
 if(input.starts.length!==playerCount)throw new Error('Map starting slots must match the roster.');
 return {size:input.size,seed:input.seed,width:input.width,height:input.height,terrain:[...input.levels[0].terrain],starts:input.starts.map(p=>({x:p.x,y:p.y,level:p.level})),resources:input.resources.map(r=>({...r})),version:MAP_VERSION};
}
export function initializeWorld(s:GameState,input:WorldMapData,biome:Biome='temperate'):WorldState {
 const world:WorldState={version:1,revision:0,biome,levels:input.levels.map(l=>({...l,terrain:[...l.terrain],elevation:[...l.elevation]})),transitions:input.transitions.map(t=>({id:t.id,from:{...t.from},to:{...t.to}})),bridges:[],fires:[],sites:input.sites.map(site=>({...site,id:s.nextId++,owner:null,loyalty:s.players.map(()=>0),progress:0,capturing:null,reward:{wood:180,ore:100,crystal:40},rewarded:[],request:{wood:80,ore:20,crystal:0},supplied:false,creatureIds:[],respawnAt:0})),creatures:[],dayLength:180,seasonLength:240,weatherLength:45,nextEnvironmentAt:0,iceTiles:[],thawWarned:false};
 world.levels[0].terrain=s.terrain;s.world=world;
 for(const level of world.levels){
  const visited=new Set<number>();for(let tile=0;tile<level.terrain.length;tile++){
   if(level.terrain[tile]!=='bridge'||visited.has(tile))continue;const queue=[tile];visited.add(tile);
   for(let i=0;i<queue.length;i++){const p=queue[i],x=p%s.width,y=Math.floor(p/s.width);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*s.width+nx;if(nx<0||ny<0||nx>=s.width||ny>=s.height||level.terrain[j]!=='bridge'||visited.has(j))continue;visited.add(j);queue.push(j);}}
   const center=queue[Math.floor(queue.length/2)];world.bridges.push({id:s.nextId++,x:center%s.width+.5,y:Math.floor(center/s.width)+.5,level:level.id,hp:Math.max(160,queue.length*25),maxHp:Math.max(160,queue.length*25),tiles:queue,rebuilding:0,repairSide:null});
  }
 }
 return world;
}
