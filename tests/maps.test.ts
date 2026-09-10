import { expect, it } from 'vitest';
import { generateMap, MAP_SIZES, validateMap } from '../src/core/maps';
import type { MapSize } from '../src/core/types';

it.each(Object.keys(MAP_SIZES) as MapSize[])('generates connected, symmetric %s maps for 100 seeds',(size)=>{
 for(let seed=0;seed<100;seed++){
  const map=generateMap(seed,size),check=validateMap(map);
  expect(check.issues,`${size}/${seed}`).toEqual([]);
  expect(map.width).toBe(MAP_SIZES[size]);
  expect(check.reachableResources).toBe(map.resources.length);
 }
},30_000);
it('uses the seed reproducibly and changes terrain and resources between seeds',()=>{
 expect(generateMap(4127,'medium')).toEqual(generateMap(4127,'medium'));
 const a=generateMap(4127,'medium'),b=generateMap(4128,'medium');
 expect(a.terrain).not.toEqual(b.terrain);expect(a.resources).not.toEqual(b.resources);
 expect(new Set(a.terrain).size).toBeGreaterThanOrEqual(5);
});
it('rejects invalid sizes and seeds',()=>{
 expect(()=>generateMap(NaN)).toThrow();expect(()=>generateMap(-1)).toThrow();expect(()=>generateMap(1,'huge' as MapSize)).toThrow();
});
