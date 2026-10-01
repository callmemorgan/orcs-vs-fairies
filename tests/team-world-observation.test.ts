import { describe, expect, it } from 'vitest';
import { createMatch, refreshVisibility } from '../src/core/simulation';
import { fogKey } from '../src/core/world-map';
import type { Side } from '../src/core/types';
import type { WorldPoint, WorldSite } from '../src/core/world-types';
import { observationToRenderState } from '../src/online/render-state';
import { teamObservation } from '../src/server/team-view';
import { OnlineView } from '../src/server/views';

function fixture(sharedVision: boolean) {
 const state = createMatch({ map: { seed: 4127, size: 'huge', biome: 'forest' }, players: [
  { id: 0, teamId: 0, factionId: 'orcs', controller: 'external' },
  { id: 1, teamId: 0, factionId: 'fairies', controller: 'external' },
  { id: 2, teamId: 1, factionId: 'dwarves', controller: 'external' },
  { id: 3, teamId: 1, factionId: 'automata', controller: 'external' },
 ], rules: { sharedVision } });
 const world = state.world!;
 for (const level of world.levels) { level.terrain.fill('grass'); level.elevation.fill(0); }
 const positions: WorldPoint[] = [{ x: 20.5, y: 20.5, level: 1 }, { x: 40.5, y: 40.5, level: 1 }, { x: 60.5, y: 60.5, level: 1 }];
 const sites: WorldSite[] = positions.map((point, index) => ({ id: state.nextId++, ...point, kind: 'village', owner: null,
  loyalty: index === 0 ? [71, 91, 0, 0] : index === 1 ? [33, 60, 0, 0] : [0, 0, 100, 0],
  progress: 0, capturing: null, reward: { wood: 180, ore: 100, crystal: 40 }, rewarded: [],
  request: { wood: 80, ore: 20, crystal: 0 }, supplied: false, creatureIds: [], respawnAt: 0 }));
 world.sites = sites;
 world.transitions = positions.map((point, index) => ({ id: index + 1, from: point, to: { ...point, level: 0 } }));
 world.bridges = positions.map(point => ({ id: state.nextId++, ...point, hp: 120, maxHp: 160,
  tiles: [Math.floor(point.y) * state.width + Math.floor(point.x)], rebuilding: 0, repairSide: 2 }));
 world.creatures = positions.map((point, index) => ({ id: state.nextId++, ...point, site: sites[index].id,
  hp: 110, maxHp: 110, cooldown: 42, target: state.entities[0].id, path: [{ x: 11, y: 13, level: 1 }], patrol: 5, respawnAt: 88 }));
 world.fires = positions.map(point => ({ ...point, heat: .5, expires: 100, nextSpread: 40 }));
 const workers = (side: Side) => state.entities.filter(entity => entity.side === side && entity.role === 'worker');
 Object.assign(workers(0)[0], { ...positions[0], x: positions[0].x - 1 });
 Object.assign(workers(1)[0], { ...positions[0], x: positions[0].x + 1 });
 Object.assign(workers(1)[1], { ...positions[1], x: positions[1].x + 1 });
 Object.assign(workers(2)[0], { ...positions[2], x: positions[2].x + 1 });
 refreshVisibility(state);
 const frames = () => ([0, 1, 2, 3] as const).map(side => new OnlineView(side).observe(state));
 return { state, world, sites, positions, frames };
}

for (const sharedVision of [false, true]) describe(`team village rewards with shared vision=${sharedVision}`, () => {
 for (const rewarded of [0, 1] as const) for (const perspective of [0, 1] as const) {
  it(`keeps player ${perspective}'s village claim after player ${rewarded} collected supplies`, () => {
   const { sites, frames } = fixture(sharedVision);
   sites[0].rewarded = [rewarded];
   const observed = frames(), before = structuredClone(observed), own = observed[perspective].world!.sites.find(site => site.id === sites[0].id)!;
   const teammate = observed[1 - perspective].world!.sites.find(site => site.id === sites[0].id)!;
   expect(own.rewardClaimed).toBe(rewarded === perspective);
   expect(teammate.rewardClaimed).toBe(rewarded !== perspective);
   const merged = teamObservation(observed, perspective), site = merged.world!.sites.find(site => site.id === sites[0].id)!;
   expect(site.loyalty).toBe(own.loyalty);
   expect(site.rewardClaimed).toBe(own.rewardClaimed);
   const rendered = observationToRenderState(merged, 'spectator').state.world!.sites.find(site => site.id === sites[0].id)!;
   expect(rendered.rewarded).toEqual(rewarded === perspective ? [perspective] : []);
   expect(observed).toEqual(before);
  });
 }
});

describe('team world union and private perspective data', () => {
 for (const rewarded of [0, 1] as const) it(`does not infer the absent base village claim from player ${rewarded}'s reward`, () => {
  const { sites, frames } = fixture(false);
  sites[1].rewarded = [rewarded];
  const observed = frames();
  expect(observed[0].world!.sites.some(site => site.id === sites[1].id)).toBe(false);
  expect(observed[1].world!.sites.find(site => site.id === sites[1].id)!.rewardClaimed).toBe(rewarded === 1);
  const merged = teamObservation(observed, 0), site = merged.world!.sites.find(site => site.id === sites[1].id)!;
  expect(site).toMatchObject({ loyalty: 0, rewardClaimed: false });
  expect(observationToRenderState(merged, 'spectator').state.world!.sites.find(site => site.id === sites[1].id)!.rewarded).toEqual([]);
  const before = structuredClone(merged.world);
  sites[1].rewarded = [rewarded === 0 ? 1 : 0]; sites[1].loyalty[0] = 999;
  expect(teamObservation(frames(), 0).world).toEqual(before);
 });

 for (const sharedVision of [false, true]) it(`does not borrow village claims when the entire base world frame is absent (shared vision=${sharedVision})`, () => {
  const { sites, frames } = fixture(sharedVision);
  sites[0].rewarded = [1];
  const observed = frames(); observed[0] = { ...observed[0], world: undefined };
  expect(observed[1].world!.sites.find(site => site.id === sites[0].id)!.rewardClaimed).toBe(true);
  const merged = teamObservation(observed, 0);
  expect(merged.world!.sites.find(site => site.id === sites[0].id)).toMatchObject({ loyalty: 0, rewardClaimed: false });
  expect(observationToRenderState(merged, 'spectator').state.world!.sites.find(site => site.id === sites[0].id)!.rewarded).toEqual([]);
 });

 it('retains a visible monster den global reward status when the base record is absent', () => {
  const { sites, frames } = fixture(false);
  Object.assign(sites[1], { kind: 'monster', rewarded: [1], reward: { wood: 0, ore: 0, crystal: 0 } });
  const observed = frames();
  expect(observed[0].world!.sites.some(site => site.id === sites[1].id)).toBe(false);
  expect(observed[1].world!.sites.find(site => site.id === sites[1].id)!.rewardClaimed).toBe(true);
  expect(teamObservation(observed, 0).world!.sites.find(site => site.id === sites[1].id)!.rewardClaimed).toBe(true);
 });

 it('keeps teammate world objects and terrain without exposing hostile or private runtime fields', () => {
  const { state, world, sites, positions, frames } = fixture(false), observed = frames(), merged = teamObservation(observed, 0), view = merged.world!;
  expect(view.sites.map(site => site.id)).toEqual(sites.slice(0, 2).map(site => site.id));
  expect(view.bridges.map(bridge => bridge.id)).toEqual(world.bridges.slice(0, 2).map(bridge => bridge.id));
  expect(view.creatures.map(creature => creature.id)).toEqual(world.creatures.slice(0, 2).map(creature => creature.id));
  expect(view.transitions.map(transition => transition.id)).toEqual([1, 2]);
  expect(view.fires).toHaveLength(2);
  const tile = (index: number) => Math.floor(positions[index].y) * state.width + Math.floor(positions[index].x);
  expect(merged.visible).toContain(fogKey(state, positions[1]));
  expect(view.levels[1].terrain[tile(1)]).toBe('grass'); expect(view.levels[1].elevation[tile(1)]).toBe(0);
  expect(view.levels[1].terrain[tile(2)]).toBeNull(); expect(view.levels[1].elevation[tile(2)]).toBeNull();
  for (const creature of view.creatures) for (const field of ['target', 'path', 'cooldown', 'patrol', 'respawnAt']) expect(creature).not.toHaveProperty(field);
  for (const bridge of view.bridges) for (const field of ['repairSide', 'tiles']) expect(bridge).not.toHaveProperty(field);
  for (const site of view.sites) expect(site).not.toHaveProperty('rewarded');
  expect(view).not.toHaveProperty('nextEnvironmentAt'); expect(view).not.toHaveProperty('dayLength');
  const before = structuredClone(view);
  sites[2].loyalty = [100, 99, 98, 97]; sites[2].rewarded = [0]; sites[2].reward.wood = 987654;
  world.bridges[2].hp = 1; world.creatures[2].hp = 1; world.fires[2].heat = .9;
  world.levels[1].terrain[tile(2)] = 'water'; world.levels[1].elevation[tile(2)] = 3;
  expect(teamObservation(frames(), 0).world).toEqual(before);
 });
});
