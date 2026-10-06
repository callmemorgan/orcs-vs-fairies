// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { createGame, issueCommand } from '../src/core/simulation';
import { technologyTree } from '../src/ui/TechnologyTree';
it('research choice buttons issue normal research and show the incompatible choice reason',()=>{
 const s=createGame('orcs',4127,'fairies',{controllers:['external','external'],improvements:{'feature-042':true}});
 Object.assign(s.players[0],{wood:2000,ore:2000,crystal:200,upgrades:['town-age']});
 const a={...s.entities[0],id:s.nextId++,role:'barracks' as const,queue:[],path:[]};s.entities.push(a);
 const root=document.createElement('div');document.body.append(root);
 const tree=technologyTree(root,(upgrade,id)=>issueCommand(s,0,{type:'research',id,upgrade}));tree.update(s,false);tree.open();
 const button=(id:string)=>root.querySelector<HTMLButtonElement>(`[data-technology="${id}"]`)!;
 expect(button('rapid-assault').disabled).toBe(false);button('rapid-assault').click();tree.update(s,false);
 expect(a.research).toBe('rapid-assault');expect(button('fortified-ranks').disabled).toBe(true);
 expect(button('fortified-ranks').textContent).toContain('Excluded by Rapid Assault');root.remove();
});
