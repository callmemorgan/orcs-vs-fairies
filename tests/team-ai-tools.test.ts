// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mountTeamAITools} from '../src/ui/TeamAITools';
afterEach(()=>document.body.replaceChildren());
it('owns a toolbar dialog, sends the selected cavern request and restores focus without leaking key events',()=>{
 const root=document.createElement('main'),toolbar=document.createElement('nav');root.append(toolbar);document.body.append(root);const command=vi.fn(()=>true),visibility=vi.fn(),panel=mountTeamAITools(root,{toolbar,command,notice:()=>{},onVisibility:visibility});
 panel.update({side:0,allies:[{side:1,name:'Ally'}],directives:[],width:64,height:64,enabled:true,levels:[{id:0,name:'Surface'},{id:1,name:'Caverns'}],destination:{x:12,y:13,level:1}},{blocked:false});
 const opener=toolbar.querySelector('button')!;opener.focus();opener.click();expect(visibility).toHaveBeenLastCalledWith(true);expect(root.querySelector('.team-ai-overlay')!.hasAttribute('hidden')).toBe(false);
 const parentKey=vi.fn();root.addEventListener('keydown',parentKey);root.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));expect(command).toHaveBeenCalledWith({type:'allyDirective',ally:1,directive:'defend',x:12,y:13,level:1});
 const send=root.querySelector<HTMLButtonElement>('button[type=submit]')!;send.focus();const tab=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});send.dispatchEvent(tab);expect(tab.defaultPrevented).toBe(true);expect(document.activeElement).toBe(root.querySelector('[aria-label="Close ally requests"]'));root.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(parentKey).not.toHaveBeenCalled();expect(visibility).toHaveBeenLastCalledWith(false);expect(document.activeElement).toBe(opener);panel.destroy();
});
it('closes its own dialog when another owner blocks tools and prevents further sends',()=>{
 const root=document.createElement('main'),toolbar=document.createElement('nav');root.append(toolbar);document.body.append(root);const command=vi.fn(()=>true),visibility=vi.fn(),panel=mountTeamAITools(root,{toolbar,command,notice:()=>{},onVisibility:visibility}),view={side:0 as const,allies:[{side:1 as const,name:'Ally'}],directives:[],width:64,height:64,enabled:true,destination:{x:12,y:13}};
 panel.update(view,{blocked:false});toolbar.querySelector('button')!.click();panel.update({...view,enabled:false},{blocked:true});expect(visibility).toHaveBeenLastCalledWith(false);expect(toolbar.querySelector('button')!.disabled).toBe(true);root.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));expect(command).not.toHaveBeenCalled();panel.destroy();
});
