import type { ClientImprovement } from '../host';
import type { IncomeObservation } from './income-rule';
export default {
 id:'feature-022',
 mount(context){
  const labels=(['wood','ore','crystal'] as const).map(kind=>{
   const label=document.createElement('span');label.className='hud-income';label.dataset.income=kind;label.title='Amount deposited during the last 60 seconds. Spending and refunds are excluded.';
   label.style.cssText='font-size:11px;margin-left:5px;white-space:nowrap;color:#b9d49e';
   context.root.querySelector(`#${kind}`)?.after(label);return {kind,label};
  });
  return {
   readOptions:()=>true,
   update(){if(!context.state)return;const observed=context.state.improvements?.['feature-022'] as IncomeObservation|undefined;for(const {kind,label} of labels)label.textContent=`+${Math.floor(observed?.income[kind]??0)}/min`;},
   dispose(){for(const {label} of labels)label.remove();}
  };
 }
} satisfies ClientImprovement;
