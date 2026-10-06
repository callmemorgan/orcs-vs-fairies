import type { ClientImprovement } from '../host';
import { CONTROL_ACTIONS, controls, bindingFromKeyboard, controlLabel, type ControlAction } from './bindings';
import './style.css';
export default {
  id:'feature-011',
  mount(context){
    const dialog=document.createElement('dialog');dialog.className='controls-dialog';dialog.setAttribute('aria-label','Control settings');
    const title=document.createElement('h2');title.textContent='Control settings';dialog.append(title);
    const hint=document.createElement('p');hint.textContent='Choose a binding, then press a key. Camera and attack move use separate bindings.';dialog.append(hint);
    const status=document.createElement('p');status.setAttribute('role','status');
    const bindings=document.createElement('div');bindings.className='control-bindings';dialog.append(bindings,status);
    let recording:ControlAction|null=null;
    const render=()=>{context.root.querySelectorAll<HTMLElement>('[data-control]').forEach(el=>{el.textContent=controlLabel(el.dataset.control as ControlAction);});bindings.replaceChildren();for(const action of CONTROL_ACTIONS){const label=document.createElement('label');label.textContent=action.label;const button=document.createElement('button');button.type='button';button.dataset.action=action.id;button.textContent=controlLabel(action.id);button.setAttribute('aria-label',`Change ${action.label} binding`);button.onclick=()=>{recording=action.id;status.textContent=`Press a key for ${action.label}.`;};label.append(button);bindings.append(label);}};
    const reset=document.createElement('button');reset.textContent='Reset bindings';reset.onclick=()=>{controls.resetDefaults();recording=null;render();status.textContent='Default bindings restored.';};
    const close=document.createElement('button');close.textContent='Close controls';close.onclick=()=>{recording=null;dialog.close();};dialog.append(reset,close);context.root.append(dialog);
    render();
    const open=()=>{recording=null;render();status.textContent=controls.persistenceError??'';dialog.showModal();};
    const buttons=[context.menu,context.hud].map(container=>{const button=document.createElement('button');button.className='controls-settings-button';button.textContent='Controls';button.onclick=open;container.append(button);return button;});
    const key=(event:KeyboardEvent)=>{if(!dialog.open||!recording)return;event.preventDefault();event.stopImmediatePropagation();const binding=bindingFromKeyboard(event);if(!binding)return;const result=controls.setBinding(recording,binding);status.textContent=result.error??controls.persistenceError??'Binding saved.';if(result.ok){recording=null;render();}};
    dialog.addEventListener('keydown',key);dialog.addEventListener('cancel',()=>{recording=null;});
    return {dispose(){dialog.remove();buttons.forEach(button=>button.remove());}};
  }
} satisfies ClientImprovement;
