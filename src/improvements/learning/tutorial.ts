import type { ClientImprovement } from '../host';
import { TUTORIAL, tutorialStage, type TutorialProgress } from './tutorial-rule';
import './learning.css';
const tutorial:ClientImprovement={id:TUTORIAL,mount(context){
 context.menu.innerHTML='<div class="learning-settings"><label for="learning-mode">Play mode</label><select id="learning-mode"><option value="skirmish">Skirmish</option><option value="tutorial">First battle tutorial</option></select></div>';
 context.hud.innerHTML='<section class="learning-card" hidden aria-label="Tutorial"><strong class="learning-title"></strong><p class="learning-instruction" role="status"></p><button class="small-button learning-focus">Show me</button><button class="small-button learning-battle" hidden>Start practice fight</button></section>';
 const mode=context.menu.querySelector<HTMLSelectElement>('select')!,card=context.hud.querySelector<HTMLElement>('section')!,title=card.querySelector<HTMLElement>('.learning-title')!,instruction=card.querySelector<HTMLElement>('.learning-instruction')!,focus=card.querySelector<HTMLButtonElement>('.learning-focus')!,battle=card.querySelector<HTMLButtonElement>('.learning-battle')!;
 const state=()=>context.state?.improvements?.[TUTORIAL] as TutorialProgress|undefined;
 const texts=[['Gather resources','Select a worker, then right-click a tree or ore deposit. Wait for a full load to reach your stronghold.'],['Build your barracks','Select a worker and choose your barracks in Build. Click clear ground nearby and let construction finish.'],['Recruit a soldier','Select your completed barracks. Open Recruit and train a melee soldier. Resources and population are spent normally.'],['Win your first battle','Start the practice fight. Select your soldiers, then right-click the enemy or use A to attack-move toward it.'],['Tutorial complete','You gathered resources, built a barracks, recruited a soldier and won a fight. Use Restart to choose a skirmish or repeat the tutorial.']];
 focus.onclick=()=>{
  const view=context.state;if(!view)return;const s=state(),step=s?tutorialStage(s):0;
  const entities=view.entities.filter(e=>e.side===0&&(step<2?e.role==='worker':step===2?e.role==='barracks':e.kind==='unit'&&e.role!=='worker'));
  context.select(entities.map(e=>e.id));
  const target=step===3&&s?.battleStarted?view.entities.find(e=>e.id===s.target):entities[0];
  if(target)context.center(target.x,target.y);
  context.notice(texts[step][1]);
 };
 battle.onclick=()=>{if(context.command({type:'improvement',improvement:TUTORIAL,action:'battle',ids:[]}))context.notice('The practice enemy is nearby. Select your soldiers and attack.');};
 let shown=-1;
 return {readOptions:()=>mode.value==='tutorial'?{}:undefined,update(){const s=state();card.hidden=!s;if(!s)return;const step=tutorialStage(s);if(step!==shown){shown=step;title.textContent=texts[step][0];instruction.textContent=texts[step][1];}battle.hidden=step!==3||s.battleStarted;battle.disabled=context.paused;focus.hidden=step===4;},menu(){card.hidden=true;}};
}};
export default tutorial;
