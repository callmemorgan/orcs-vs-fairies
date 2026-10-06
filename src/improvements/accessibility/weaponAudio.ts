import type { Entity, FactionId } from '../../core/types';

export type WeaponSound = 'blade'|'pike'|'bow'|'bolt'|'musket'|'cannon'|'stone'|'magic'|'beam'|'impact';
export interface AudioTone { frequency:number; offset:number; duration:number; volume:number; wave:OscillatorType; endFrequency?:number }
const tone=(frequency:number,offset:number,duration:number,volume:number,wave:OscillatorType,endFrequency?:number):AudioTone=>({frequency,offset,duration,volume,wave,endFrequency});
/** Launch transient followed by a short impact; no downloaded audio or speech voices required. */
export const WEAPON_SOUNDS:Record<WeaponSound,readonly AudioTone[]>={
 blade:[tone(1800,0,.045,.13,'sawtooth',300),tone(740,.035,.09,.14,'triangle',280)],
 pike:[tone(960,0,.06,.12,'triangle',170),tone(2400,.045,.065,.09,'square',900)],
 bow:[tone(360,0,.085,.14,'triangle',110),tone(140,.09,.08,.16,'triangle',70)],
 bolt:[tone(120,0,.045,.18,'square',65),tone(2800,.055,.055,.09,'triangle',500)],
 musket:[tone(85,0,.12,.19,'sawtooth',32),tone(2100,0,.04,.09,'square',180),tone(480,.08,.08,.11,'triangle',90)],
 cannon:[tone(55,0,.26,.22,'sawtooth',22),tone(110,.025,.22,.16,'triangle',32),tone(170,.16,.18,.15,'square',45)],
 stone:[tone(120,0,.16,.13,'triangle',40),tone(75,.14,.18,.21,'sawtooth',26)],
 magic:[tone(660,0,.18,.12,'sine',1320),tone(990,.06,.18,.10,'sine',420),tone(330,.16,.16,.10,'triangle',180)],
 beam:[tone(1800,0,.14,.10,'sine',320),tone(900,0,.14,.10,'triangle',160),tone(2600,.12,.06,.06,'sine',1200)],
 impact:[tone(145,0,.07,.18,'triangle',92)]
};
/** Every building of a faction shares one sound; unlisted unit roles fall back to a blade. */
const WEAPONS:Record<FactionId,Partial<Record<Entity['role']|'building',WeaponSound>>>={
 orcs:{building:'bolt',ranged:'bolt',spear:'pike',siege:'stone'},
 fairies:{building:'magic',melee:'pike',ranged:'bow',special:'magic',spear:'pike',siege:'stone'},
 dwarves:{building:'musket',ranged:'musket',special:'cannon',spear:'pike',siege:'cannon'},
 undead:{building:'magic',ranged:'bow',special:'magic',spear:'pike',siege:'stone'},
 tideborn:{building:'bolt',ranged:'pike',special:'magic',spear:'pike',siege:'stone'},
 automata:{building:'beam',ranged:'beam',special:'beam',spear:'pike',siege:'beam'}
};
export function weaponSound(entity:Pick<Entity,'kind'|'role'>|undefined,faction:FactionId):WeaponSound{
 return entity?WEAPONS[faction][entity.kind==='building'?'building':entity.role]??'blade':'impact';
}
