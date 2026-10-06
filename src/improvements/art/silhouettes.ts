import type { ClientImprovement } from '../host';
/** The packed sprites come from the named, editable gardener/sentinel meshes in units.py. */
export default {
  id:'feature-072',
  mount(context){
    const note=document.createElement('p');
    note.textContent='Fairy gardeners wear broad hats; melee sentinels carry pointed shields and tall crests.';
    context.menu.append(note);return {};
  }
} satisfies ClientImprovement;
