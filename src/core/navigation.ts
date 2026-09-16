import { FACTIONS } from './content';
import { terrainAt, TERRAIN } from './maps';
import type { GameState, Side, Vec } from './types';

const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const buildingRadius=(s:GameState,e:GameState['entities'][number])=>FACTIONS[s.players[e.side].faction].buildings[e.role as 'hq'].size/2+.27;

export function walkable(s:GameState,x:number,y:number):boolean{
 if(x<.35||y<.35||x>s.width-.35||y>s.height-.35)return false;
 for(let ty=Math.floor(y-.27);ty<=Math.floor(y+.27);ty++)for(let tx=Math.floor(x-.27);tx<=Math.floor(x+.27);tx++)if(!TERRAIN[terrainAt(s,tx+.5,ty+.5)].walkable)return false;
 for(const b of s.entities)if(b.hp>0&&b.kind==='building'&&!b.gateOpen){const r=buildingRadius(s,b);if(Math.abs(b.x-x)<r&&Math.abs(b.y-y)<r)return false;}
 for(const r of s.resources)if(r.amount>0&&Math.hypot(r.x-x,r.y-y)<.7)return false;
 return true;
}

export function segmentWalkable(s:GameState,a:Vec,b:Vec):boolean{
 if(!walkable(s,a.x,a.y)||!walkable(s,b.x,b.y))return false;
 const dx=b.x-a.x,dy=b.y-a.y,lengthSquared=dx*dx+dy*dy;
 for(let y=Math.floor(Math.min(a.y,b.y)-.27);y<=Math.floor(Math.max(a.y,b.y)+.27);y++)for(let x=Math.floor(Math.min(a.x,b.x)-.27);x<=Math.floor(Math.max(a.x,b.x)+.27);x++){
  if(TERRAIN[terrainAt(s,x+.5,y+.5)].walkable)continue;let enter=0,leave=1;
  for(const [origin,delta,center] of [[a.x,dx,x+.5],[a.y,dy,y+.5]]){if(delta===0){if(Math.abs(origin-center)>=.77){enter=1;leave=0;break;}}else{const t1=(center-.77-origin)/delta,t2=(center+.77-origin)/delta;enter=Math.max(enter,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));}}
  if(enter<leave)return false;
 }

 for(const r of s.resources){if(r.amount<=0)continue;const t=lengthSquared?clamp(((r.x-a.x)*dx+(r.y-a.y)*dy)/lengthSquared,0,1):0;if(Math.hypot(a.x+t*dx-r.x,a.y+t*dy-r.y)<.7)return false;}
 for(const obstacle of s.entities){if(obstacle.hp<=0||obstacle.kind!=='building'||obstacle.gateOpen)continue;const r=buildingRadius(s,obstacle);let enter=0,leave=1;
  for(const [origin,delta,center] of [[a.x,dx,obstacle.x],[a.y,dy,obstacle.y]]){if(delta===0){if(Math.abs(origin-center)>=r){enter=1;leave=0;break;}}else{const t1=(center-r-origin)/delta,t2=(center+r-origin)/delta;enter=Math.max(enter,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));}}
  if(enter<leave)return false;
 }
 return true;
}

export function openDestination(s:GameState,to:Vec,from:Vec):Vec|undefined{
 if(walkable(s,to.x,to.y))return to;
 const angle=Math.atan2(from.y-to.y,from.x-to.x);
 for(let r=.25;r<=6;r+=.25){const candidates:Vec[]=[];for(let i=0;i<32;i++){const a=angle+i*Math.PI/16,p={x:to.x+Math.cos(a)*r,y:to.y+Math.sin(a)*r};if(walkable(s,p.x,p.y))candidates.push(p);}if(candidates.length)return candidates.sort((a,b)=>distance(from,a)-distance(from,b))[0];}
 return undefined;
}

interface Grid {terrain:GameState['terrain'];signature:string;width:number;height:number;blocked:Uint8Array;edges:Map<number,boolean>}
const grids=new WeakMap<GameState,Map<number,Grid>>();
function gridFor(s:GameState,CELL:number):Grid{
 const buildings=s.entities.filter(e=>e.hp>0&&e.kind==='building'&&!e.gateOpen);
 const resources=s.resources.filter(r=>r.amount>0);
 const signature=`${s.width},${s.height};${buildings.map(b=>`${b.id},${b.x},${b.y},${buildingRadius(s,b)}`).join(';')}|${resources.map(r=>`${r.id},${r.x},${r.y}`).join(';')}`;
 let caches=grids.get(s);if(!caches){caches=new Map();grids.set(s,caches);}
 const old=caches.get(CELL);if(old?.signature===signature&&old.terrain===s.terrain)return old;
 const width=Math.round(s.width/CELL),height=Math.round(s.height/CELL),blocked=new Uint8Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if((x+.5)*CELL<.35||(y+.5)*CELL<.35||(x+.5)*CELL>s.width-.35||(y+.5)*CELL>s.height-.35)blocked[y*width+x]=1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const px=(x+.5)*CELL,py=(y+.5)*CELL;
  for(let ty=Math.floor(py-.27);ty<=Math.floor(py+.27);ty++)for(let tx=Math.floor(px-.27);tx<=Math.floor(px+.27);tx++)if(!TERRAIN[terrainAt(s,tx+.5,ty+.5)].walkable)blocked[y*width+x]=1;
 }
 // Stamp obstacle bounds instead of testing every cell against every obstacle.
 for(const b of [...buildings,...resources]){
  const r='role' in b?buildingRadius(s,b):.7;
  for(let y=Math.max(0,Math.floor((b.y-r)/CELL));y<Math.min(height,Math.ceil((b.y+r)/CELL));y++)for(let x=Math.max(0,Math.floor((b.x-r)/CELL));x<Math.min(width,Math.ceil((b.x+r)/CELL));x++){
   const dx=Math.abs((x+.5)*CELL-b.x),dy=Math.abs((y+.5)*CELL-b.y);
   if('role' in b?dx<r&&dy<r:Math.hypot(dx,dy)<r)blocked[y*width+x]=1;
  }
 }
 const grid={terrain:s.terrain,signature,width,height,blocked,edges:new Map<number,boolean>()};caches.set(CELL,grid);return grid;
}

// Half-tile A* retains passages wide enough for a unit but missed by tile centers.
// Continuous connectors and edges prevent cutting through corners and deposits.
export function route(s:GameState,from:Vec,to:Vec,reach:number,side?:Side):Vec[]{
 const coarse=routeOnGrid(s,from,to,reach,.5,side);
 return coarse.length?coarse:routeOnGrid(s,from,to,reach,.25,side);
}
// Refine only failed searches: legal one-tile building gaps can fall between coarse centers.
function routeOnGrid(s:GameState,from:Vec,to:Vec,reach:number,CELL:number,side?:Side):Vec[]{
 const grid=gridFor(s,CELL),{width,height,blocked}=grid;
 const point=(k:number):Vec=>({x:(k%width+.5)*CELL,y:(Math.floor(k/width)+.5)*CELL});
 const sx=Math.floor(from.x/CELL),sy=Math.floor(from.y/CELL),start=sy*width+sx;
 const starts:number[]=[];
 if(!blocked[start]&&segmentWalkable(s,from,point(start)))starts.push(start);
 else for(let ring=1;ring<=4&&!starts.length;ring++)for(let y=Math.max(0,sy-ring);y<=Math.min(height-1,sy+ring);y++)for(let x=Math.max(0,sx-ring);x<=Math.min(width-1,sx+ring);x++){const k=y*width+x;if(!blocked[k]&&segmentWalkable(s,from,point(k)))starts.push(k);}
 if(!starts.length)return [];
 const goals=new Set<number>(),rr=Math.max(reach+.2,.4);
 for(let y=Math.max(0,Math.floor((to.y-rr)/CELL));y<Math.min(height,Math.ceil((to.y+rr)/CELL));y++)for(let x=Math.max(0,Math.floor((to.x-rr)/CELL));x<Math.min(width,Math.ceil((to.x+rr)/CELL));x++){const k=y*width+x;if(!blocked[k]&&distance(point(k),to)<=rr)goals.add(k);}
 if(!goals.size)return [];
 const score=new Float64Array(width*height).fill(Infinity),parent=new Int32Array(width*height).fill(-1),closed=new Uint8Array(width*height),open:{key:number;score:number}[]=[];
 const push=(key:number,value:number)=>{let i=open.length;open.push({key,score:value});while(i>0){const p=(i-1)>>1;if(open[p].score<=value)break;open[i]=open[p];i=p;}open[i]={key,score:value};};
 const pop=()=>{const top=open[0].key,last=open.pop()!;if(open.length){let i=0;while(i*2+1<open.length){let child=i*2+1;if(child+1<open.length&&open[child+1].score<open[child].score)child++;if(open[child].score>=last.score)break;open[i]=open[child];i=child;}open[i]=last;}return top;};
 const heuristic=(k:number)=>Math.max(0,distance(point(k),to)-rr)/1.15;
 for(const k of starts){score[k]=distance(from,point(k));push(k,score[k]+heuristic(k));}
 let end=-1;
 while(open.length){const k=pop();if(closed[k])continue;if(goals.has(k)){end=k;break;}closed[k]=1;const x=k%width,y=Math.floor(k/width);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const n=ny*width+nx;
   if(blocked[n]||closed[n]||(dx&&dy&&(blocked[y*width+nx]||blocked[ny*width+x])))continue;
   const edge=Math.min(k,n)*width*height+Math.max(k,n);let clear=grid.edges.get(edge);if(clear===undefined){clear=segmentWalkable(s,point(k),point(n));grid.edges.set(edge,clear);}if(!clear)continue;
   const p=point(n),terrain=terrainAt(s,p.x,p.y),speed=(side!==undefined?FACTIONS[s.players[side].faction].terrainSpeeds?.[terrain]:undefined)??TERRAIN[terrain].speed;const value=score[k]+(dx&&dy?Math.SQRT2:1)*CELL/Math.max(.1,speed);if(value<score[n]){score[n]=value;parent[n]=k;push(n,value+heuristic(n));}
  }
 }
 if(end===-1)return [];
 const result:Vec[]=[];for(let k=end;k!==-1;k=parent[k])if(parent[k]!==-1||distance(from,point(k))>.08)result.push(point(k));
 return result.reverse();
}
