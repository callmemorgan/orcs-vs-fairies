import type { FactionId } from '../../core/types';
import type { AudioTone } from './weaponAudio';
export type Acknowledgment='selection'|'order';
/** Synthesized short vocal calls: formants and syllables, rather than unavailable recorded voices. */
const designs:Record<FactionId,{pitch:number;formant:number;wave:OscillatorType;end:number}>={
 orcs:{pitch:105,formant:620,wave:'sawtooth',end:85},
 fairies:{pitch:360,formant:1450,wave:'sawtooth',end:450},
 dwarves:{pitch:145,formant:820,wave:'sawtooth',end:130},
 undead:{pitch:82,formant:1250,wave:'sawtooth',end:62},
 tideborn:{pitch:195,formant:780,wave:'triangle',end:245},
 automata:{pitch:280,formant:1400,wave:'square',end:280}
};
export const FACTION_ACKNOWLEDGMENTS={} as Record<FactionId,Record<Acknowledgment,readonly AudioTone[]>>;
for(const faction of Object.keys(designs) as FactionId[]){
 const {pitch,formant,wave,end}=designs[faction];
 const syllable=(offset:number,frequency:number,endFrequency:number):AudioTone=>({frequency,endFrequency,offset,duration:.19,volume:.26,wave,formant});
 const call=syllable(0,pitch,end);
 FACTION_ACKNOWLEDGMENTS[faction]={selection:[call],order:[call,syllable(.18,end,pitch*1.15)]};
}
