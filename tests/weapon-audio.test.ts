// @vitest-environment happy-dom
import { afterEach,expect,it,vi } from 'vitest';
import GameAudio from '../src/game/GameAudio';
import { weaponSound,WEAPON_SOUNDS } from '../src/improvements/accessibility/weaponAudio';
const param=()=>({value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn(),cancelScheduledValues:vi.fn(),setTargetAtTime:vi.fn()});
let oscillators:any[]=[];
class AudioGraph {
 currentTime=1;state='running';destination={};
 createGain(){return {gain:param(),connect:vi.fn(),disconnect:vi.fn()};}
 createAnalyser(){return {fftSize:256,connect:vi.fn(),disconnect:vi.fn(),getFloatTimeDomainData:vi.fn()};}
 createOscillator(){const oscillator={type:'sine',frequency:param(),connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};oscillators.push(oscillator);return oscillator;}
 close(){return Promise.resolve();}
}
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();oscillators=[];});
it('routes faction weapons and keeps an unknown attacker neutral',()=>{
 expect(weaponSound({kind:'unit',role:'ranged'},'orcs')).toBe('bolt');expect(weaponSound({kind:'unit',role:'ranged'},'fairies')).toBe('bow');expect(weaponSound({kind:'unit',role:'special'},'dwarves')).toBe('cannon');expect(weaponSound({kind:'unit',role:'ranged'},'automata')).toBe('beam');expect(weaponSound(undefined,'orcs')).toBe('impact');
});
it('schedules distinct launch and impact graph envelopes, throttles volleys and honors mute',()=>{
 vi.stubGlobal('AudioContext',AudioGraph);const audio=new GameAudio();(audio as unknown as {unlock:()=>void}).unlock();
 audio.playWeapon('cannon');expect(oscillators).toHaveLength(3);expect(oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(55,1);expect(oscillators[2].start).toHaveBeenCalledWith(1.16);expect(oscillators[2].frequency.exponentialRampToValueAtTime.mock.calls[0][0]).toBe(45);expect(oscillators[2].frequency.exponentialRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(1.34);
 audio.playWeapon('cannon');expect(oscillators).toHaveLength(3);audio.playWeapon('bow');expect(oscillators).toHaveLength(5);expect(audio.status.scheduledWeapons).toEqual({cannon:1,bow:1});
 audio.toggleMuted();audio.playWeapon('beam');expect(oscillators).toHaveLength(5);expect(localStorage.getItem('orcs-vs-fairies.audio-muted')).toBe('true');audio.dispose();
});
it('gives every weapon a different waveform sequence',()=>{expect(new Set(Object.values(WEAPON_SOUNDS).map(s=>JSON.stringify(s))).size).toBe(Object.keys(WEAPON_SOUNDS).length);});
