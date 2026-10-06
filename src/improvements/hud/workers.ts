import type { ClientImprovement, PlayerObservation } from '../host';
import type { ResourceKind } from '../../core/types';

export function assignedWorkers(view:PlayerObservation):Record<ResourceKind,number>{
  const counts={wood:0,ore:0,crystal:0};
  for(const worker of view.entities){
    if(worker.side!==view.side||worker.kind!=='unit'||worker.role!=='worker'||!('order' in worker)||worker.order.type!=='gather')continue;
    const {target}=worker.order;
    const kind=view.resources.find(node=>node.id===target)?.kind;
    if(kind)counts[kind]++;
  }
  return counts;
}
export default {
  id:'feature-021',
  mount(context){
    const labels=(['wood','ore','crystal'] as const).map(kind=>{
      const label=document.createElement('small');label.className='hud-worker-count';label.dataset.resource=kind;
      label.style.cssText='display:block;font-size:11px;white-space:nowrap;color:#d5dfcd';
      context.root.querySelector(`#${kind}`)?.parentElement?.append(label);
      return {kind,label};
    });
    return {
      update(){if(!context.state)return;const counts=assignedWorkers(context.state);for(const {kind,label} of labels)label.textContent=`${counts[kind]} workers`;},
      dispose(){for(const {label} of labels)label.remove();}
    };
  }
} satisfies ClientImprovement;
