// @vitest-environment happy-dom
import {expect,it,vi} from 'vitest';
import layouts from '../src/improvements/maps/layout-client';
import type { ClientContext } from '../src/improvements/host';
it('lets the player choose a layout and gives the preview the same options',()=>{
 const root=document.createElement('div'),menu=document.createElement('div'),hud=document.createElement('div');root.append(menu,hud);
 const instance=layouts.mount({root,menu,hud,state:null,selected:[],paused:false,command:vi.fn(),select:vi.fn(),center:vi.fn(),setPaused:vi.fn(),notice:vi.fn()} as ClientContext);
 expect(instance.readOptions?.()).toBeUndefined();
 const select=menu.querySelector('select')!;
 select.value='river';select.dispatchEvent(new Event('change'));
 expect(menu.textContent).toContain('Three river crossings');
 expect(instance.readOptions?.()).toEqual({layout:'river'});
 const detail={improvements:{}};root.dispatchEvent(new CustomEvent('learning-map-options',{detail}));
 expect(detail.improvements).toEqual({'feature-061':{layout:'river'}});
 instance.dispose?.();
 const after={improvements:{}};root.dispatchEvent(new CustomEvent('learning-map-options',{detail:after}));
 expect(after.improvements).toEqual({});
});
