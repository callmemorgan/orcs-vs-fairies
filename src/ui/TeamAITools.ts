import { AllyDirectives } from './AllyDirectives';
import type { AllyDirectivesView } from './AllyDirectives';
import type { Command } from '../core/types';

export function mountTeamAITools(root:HTMLElement,options:{toolbar:HTMLElement;command:(command:Command)=>boolean;notice:(text:string)=>void;onVisibility:(open:boolean)=>void}){
 const button=document.createElement('button');button.type='button';button.textContent='Ally requests';button.dataset.teamAiTool='requests';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');options.toolbar.append(button);
 const overlay=document.createElement('div');overlay.className='team-ai-overlay';overlay.hidden=true;
 const dialog=document.createElement('section');dialog.className='team-ai-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Ally requests');dialog.tabIndex=-1;
 const closeButton=document.createElement('button');closeButton.type='button';closeButton.textContent='Close';closeButton.setAttribute('aria-label','Close ally requests');dialog.append(closeButton);overlay.append(dialog);root.append(overlay);
 const requests=new AllyDirectives(dialog,options.command,options.notice);let opened=false,blocked=true,previousFocus:HTMLElement|null=null;
 function close(){if(!opened)return;opened=false;overlay.hidden=true;button.setAttribute('aria-expanded','false');options.onVisibility(false);previousFocus?.focus();previousFocus=null;}
 button.addEventListener('click',()=>{if(blocked||opened)return;previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;opened=true;overlay.hidden=false;button.setAttribute('aria-expanded','true');options.onVisibility(true);closeButton.focus();});
 closeButton.addEventListener('click',close);
 overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='Tab'){
  const inputs=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')).filter(e=>!e.closest('[hidden]'));
  const first=inputs[0],last=inputs.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }},true);
 for(const type of ['keydown','keyup','pointerdown','pointerup','mousedown','mouseup','click','contextmenu','wheel'])overlay.addEventListener(type,event=>event.stopPropagation());
 return {update(view:AllyDirectivesView,context:{blocked:boolean}){blocked=context.blocked;button.disabled=blocked||!view.allies.length;if(blocked||!view.allies.length)close();requests.update(view);},close,destroy(){close();requests.destroy();button.remove();overlay.remove();}};
}
