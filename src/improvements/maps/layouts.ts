import { registerMapTransform, type GeneratedMap } from '../../core/maps';
import { registerGameImprovement } from '../../core/improvements';
import type { JsonValue, TerrainKind, Vec } from '../../core/types';

export type MapLayout='plains'|'river'|'mountain';
export const LAYOUT_FEATURE_ID='feature-061';
export const LAYOUT_NAMES:Record<MapLayout,string>={plains:'Open plains',river:'River crossings',mountain:'Mountain passes'};
export function selectedLayout(options:JsonValue):MapLayout{
 const layout=typeof options==='object'&&options!==null&&!Array.isArray(options)?options.layout:undefined;
 if(layout!=='plains'&&layout!=='river'&&layout!=='mountain')throw new Error('Choose plains, river or mountain layout.');
 return layout;
}
/** All painting is rotationally paired; original seeded deposits stay in place. */
export function applyLayout(map:GeneratedMap,layout:MapLayout):void{
 const {width,height,starts}=map,mid=width/2;
 const nearest=(values:number[],v:number)=>values.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a);
 map.terrain=Array(width*height).fill('grass');
 const set=(x:number,y:number,kind:TerrainKind)=>{
  if(x<1||y<1||x>=width-1||y>=height-1)return;
  map.terrain[y*width+x]=kind;map.terrain[(height-1-y)*width+width-1-x]=kind;
 };
 const line=(a:Vec,b:Vec,radius:number,kind:'road'|'bridge')=>{
  const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*3);
  for(let i=0;i<=steps;i++){
   const t=steps?i/steps:0,cx=a.x+(b.x-a.x)*t,cy=a.y+(b.y-a.y)*t;
   for(let y=Math.floor(cy-radius);y<=Math.ceil(cy+radius);y++)for(let x=Math.floor(cx-radius);x<=Math.ceil(cx+radius);x++)if(Math.hypot(x+.5-cx,y+.5-cy)<=radius){const old=map.terrain[y*width+x];set(x,y,old==='water'||old==='bridge'?'bridge':kind);}
  }
 };
 if(layout==='plains'){
  const flank={x:width*.2,y:height*.7};
  line(starts[0],starts[1],1.8,'road');
  line(starts[0],flank,1.3,'road');
  line(flank,{x:width*.8,y:height*.3},1.3,'road');
 }else if(layout==='river'){
  const crossings=[width*.25,mid,width*.75];
  for(let y=mid-2;y<mid+2;y++)for(let x=1;x<width-1;x++)set(x,y,'water');
  for(const x of crossings){
   line({x,y:mid-4},{x,y:mid+4},1.8,'road');
   line(starts[0],{x,y:mid-4},1.4,'road');
  }
  // Deposits embedded in a barrier connect along the barrier to a designed crossing.
  for(const r of map.resources)if(Math.abs(r.y-mid)<3.5)line(r,{x:nearest(crossings,r.x),y:r.y},1.8,'bridge');
 }else{
  const knee={x:mid-6,y:starts[0].y},passes=[height*.3,height*.7];
  for(let x=mid-2;x<mid+2;x++)for(let y=1;y<height-1;y++)set(x,y,'rock');
  line(starts[0],knee,1.3,'road');
  for(const y of passes){
   line({x:mid-4,y},{x:mid+4,y},1.6,'road');
   line(knee,{x:mid-4,y},1.3,'road');
  }
  for(const r of map.resources)if(Math.abs(r.x-mid)<3.5)line(r,{x:r.x,y:nearest(passes,r.y)},1.8,'road');
 }
 for(let x=0;x<width;x++){map.terrain[x]='rock';map.terrain[(height-1)*width+x]='rock';}
 for(let y=0;y<height;y++){map.terrain[y*width]='rock';map.terrain[y*width+width-1]='rock';}
}
registerMapTransform(LAYOUT_FEATURE_ID,(map,options)=>applyLayout(map,selectedLayout(options)));
registerGameImprovement({id:LAYOUT_FEATURE_ID,initialState:options=>({layout:selectedLayout(options)}),observe:(_game,_side,state)=>state});
