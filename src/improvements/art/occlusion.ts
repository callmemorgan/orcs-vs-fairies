import type { ClientImprovement } from '../host';

export interface OcclusionPoint { x:number; y:number; depth:number }
export interface OcclusionBounds { left:number; right:number; top:number; bottom:number; depth:number }
let enabled=true;
export function occlusionEnabled(){return enabled;}
/** Only scenery in front of the selected unit can obscure its body. */
export function obscuresSelection(bounds:OcclusionBounds,points:readonly OcclusionPoint[]){
  return points.some(p=>bounds.depth>p.depth&&p.x>=bounds.left&&p.x<=bounds.right&&p.y>=bounds.top&&p.y<=bounds.bottom);
}
export default {
  id:'feature-071',
  mount(context){
    const label=document.createElement('label'),input=document.createElement('input');
    input.type='checkbox';input.checked=enabled;input.addEventListener('change',()=>{enabled=input.checked;});
    label.append(input,' Fade trees and roofs over selected units');context.menu.append(label);
    return {};
  }
} satisfies ClientImprovement;
