import {describe,it,expect} from 'vitest';
import {obscuresSelection} from '../src/improvements/art/occlusion';
const roof={left:100,right:160,top:20,bottom:95,depth:110};
describe('selection occlusion',()=>{
 it('fades a front roof or tree over the selected body',()=>expect(obscuresSelection(roof,[{x:130,y:60,depth:100}])).toBe(true));
 it('restores on deselection and when the body moves clear',()=>{expect(obscuresSelection(roof,[])).toBe(false);expect(obscuresSelection(roof,[{x:170,y:60,depth:100}])).toBe(false);});
 it('does not fade scenery behind the selected unit',()=>expect(obscuresSelection(roof,[{x:130,y:60,depth:115}])).toBe(false));
});
