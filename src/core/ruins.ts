import type { WorldPoint, WorldSite } from './world-types';

export const RUIN_PILLAR_RADIUS = .45;
export type RuinGeometry = Readonly<WorldPoint & {site:number;radius:number}>;

/** Relic shrines retain the same stone pillar when ownership or capture progress changes. */
export function ruinGeometry(site:Pick<WorldSite,'id'|'kind'|'x'|'y'|'level'>):RuinGeometry|undefined {
 if(site.kind!=='relic')return;
 return {site:site.id,x:site.x,y:site.y,level:site.level,radius:RUIN_PILLAR_RADIUS};
}
