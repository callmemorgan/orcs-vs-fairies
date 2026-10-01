import { contentHash, decodeContentPackage } from './content-registry';
import type { ContentPackage } from './content-registry';
import sentinel from '../content-art/lantern/sentinel.svg?raw';
import duelist from '../content-art/lantern/duelist.svg?raw';
import banner from '../content-art/lantern/banner.svg?raw';

/** An authored package using the same admission path as imported files. */
export function exampleMod():ContentPackage {
  const body={format:'orcs-vs-fairies-mod' as const,schemaVersion:1 as const,engineVersion:3 as const,id:'lantern',version:'1.0.0',name:'Lantern Keepers',dependencies:[],
    factions:[{id:'lantern:keepers' as const,baseFaction:'fairies' as const,name:'Lantern Keepers',subtitle:'Keep the light burning',description:'Shielded Sentinels heal the line while fast Duelists press the attack. The Lantern Hall trains both melee units.',color:0xf3bd55,accent:'#f3bd55',defaultUnits:{melee:'lantern:sentinel'},defaultBuildings:{barracks:'lantern:hall'},
      units:[{id:'lantern:sentinel',name:'Lantern Sentinel',role:'melee' as const,cost:{wood:65,ore:25,crystal:0},hp:160,damage:12,armor:3,range:1.5,speed:2,cooldown:1.3,trainTime:8,sight:8,ability:'heal' as const,description:'Shield bearer. Q restores 35 health to wounded allies nearby.'},{id:'lantern:duelist',name:'Lantern Duelist',role:'melee' as const,cost:{wood:55,ore:35,crystal:0},hp:110,damage:24,armor:1,range:1.5,speed:3,cooldown:1,trainTime:6,sight:8,description:'Fast paired blades trade armor for attack damage.'}],
      buildings:[{id:'lantern:hall',name:'Lantern Hall',role:'barracks' as const,cost:{wood:140,ore:40,crystal:0},hp:900,size:3,buildTime:12,sight:9,description:'Recruits Sentinels and Duelists along with the inherited woodland roster.'}],
      research:[{id:'lantern:bright-blades' as const,name:'Bright Blades',description:'Both melee definitions deal 40% more damage.',cost:{wood:80,ore:60,crystal:0},researchTime:10,building:'barracks' as const,appliesTo:'melee' as const,effects:{damage:1.4}}]}],
    art:{'lantern:sentinel':{path:'/mods/lantern/sentinel.svg',svg:sentinel,width:128,height:128,anchor:[64,110] as [number,number],visualTop:12},'lantern:duelist':{path:'/mods/lantern/duelist.svg',svg:duelist,width:128,height:128,anchor:[64,110] as [number,number],visualTop:12},'lantern:hall':{path:'/mods/lantern/banner.svg',svg:banner,width:128,height:128,anchor:[64,110] as [number,number],visualTop:10}}};
  return decodeContentPackage({...body,hash:contentHash(body)});
}
