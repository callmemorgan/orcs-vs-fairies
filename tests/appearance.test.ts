import { describe, expect, it } from 'vitest';
import { APPEARANCE_STORAGE_KEY, AppearancePreferences, DEFAULT_APPEARANCE, PALETTES, markerPolygon, ownershipStyle } from '../src/game/Appearance';
import { createGame } from '../src/core/simulation';
import { saveGame } from '../src/core/saves';
import { replayChecksum } from '../src/core/replays';

describe('faction appearance preferences',()=>{
  it('persists display preferences without changing a complete match save',()=>{
    const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
    const state=createGame('orcs',4127),before=JSON.stringify(saveGame(state)),checksum=replayChecksum(state);
    const preferences=new AppearancePreferences(storage);
    preferences.set({palette:'deuteranopia',patterns:false,outlines:false});
    expect(new AppearancePreferences(storage).value).toEqual({palette:'deuteranopia',patterns:false,outlines:false});
    expect(JSON.stringify(saveGame(state))).toBe(before);expect(replayChecksum(state)).toBe(checksum);
    expect(values.size).toBe(1);expect(values.has(APPEARANCE_STORAGE_KEY)).toBe(true);
  });
  it('falls back when saved preferences are corrupt or storage is denied',()=>{
    for(const value of ['{','null',JSON.stringify({version:1,palette:'unknown',patterns:true,outlines:true}),JSON.stringify({version:2,...DEFAULT_APPEARANCE})])expect(new AppearancePreferences({getItem:()=>value,setItem:()=>{throw Error('denied');}}).value).toEqual(DEFAULT_APPEARANCE);
    const preferences=new AppearancePreferences({getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');}});
    preferences.set({palette:'tritanopia'});expect(preferences.value.palette).toBe('tritanopia');
  });
  it('isolates snapshots and unsubscribes listeners',()=>{
    const preferences=new AppearancePreferences(null),seen:string[]=[];
    const unsubscribe=preferences.subscribe(settings=>{seen.push(settings.palette);settings.patterns=false;});
    const value=preferences.value;value.outlines=false;
    preferences.set({palette:'deuteranopia'});unsubscribe();preferences.reset();
    expect(preferences.value).toEqual(DEFAULT_APPEARANCE);expect(seen).toEqual(['deuteranopia']);
    expect(()=>preferences.set({palette:'unknown' as 'default'})).toThrow();
  });
  it('uses eight different colors and player shapes in each palette',()=>{
    for(const palette of Object.keys(PALETTES) as Array<keyof typeof PALETTES>){
      const styles=Array.from({length:8},(_,side)=>ownershipStyle(side,0,{...DEFAULT_APPEARANCE,palette}));
      expect(new Set(styles.map(style=>style.css)).size).toBe(8);
      expect(new Set(styles.map(style=>JSON.stringify(markerPolygon(style.shape,0,0,1)))).size).toBe(8);
    }
  });
  it('distinguishes self, teammates and enemies, including the eighth player',()=>{
    const teams=[4,4,1,1,2,2,4,4];
    const style=(side:number)=>ownershipStyle(side,7,{...DEFAULT_APPEARANCE},teams);
    expect(style(7).relation).toBe('own');expect(style(0).relation).toBe('ally');expect(style(5).relation).toBe('enemy');
    expect(new Set([style(7).outline,style(0).outline,style(5).outline]).size).toBe(3);
    expect(ownershipStyle(0,7,{...DEFAULT_APPEARANCE}).relation).toBe('enemy');
  });
});
