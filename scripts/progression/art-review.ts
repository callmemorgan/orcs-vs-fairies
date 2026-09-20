import Phaser from 'phaser';
import ArtRuntime from '../../src/game/ArtRuntime';
import { FACTIONS } from '../../src/core/content';
import { createGame } from '../../src/core/simulation';
import type { BuildingRole, Entity, FactionId, UnitRole } from '../../src/core/types';

const params = new URLSearchParams(location.search);
const factionSelect = document.querySelector<HTMLSelectElement>('#faction')!;
const animationSelect = document.querySelector<HTMLSelectElement>('#animation')!;
const buildingState = document.querySelector<HTMLSelectElement>('#building-state')!;
const slider = document.querySelector<HTMLInputElement>('#frame')!;
const playing = document.querySelector<HTMLInputElement>('#playing')!;
const status = document.querySelector<HTMLElement>('#status')!;
const requested = params.get('faction') ?? 'fairies';
const faction: FactionId = Object.hasOwn(FACTIONS, requested) ? requested as FactionId : 'fairies';
factionSelect.value = faction;
factionSelect.onchange = () => { location.search = new URLSearchParams({ faction: factionSelect.value }).toString(); };
const counts: Record<string, number> = { idle: 4, walk: 8, attack: 6, death: 6 };
animationSelect.onchange = () => { slider.max = String(counts[animationSelect.value] - 1); slider.value = '0'; };
const roles: UnitRole[] = ['worker', 'melee', 'ranged', 'special', 'spear', 'cavalry', 'siege'];
const state = createGame(faction, 4127, faction, { controllers: ['external', 'external'] });
const template = state.entities.find(e => e.side === 0 && e.kind === 'unit')!;
const entities = roles.flatMap((role, row) => Array.from({ length: 8 }, (_, facing) => ({
  ...template, id: row * 8 + facing + 1, role, facing, cooldown: 0, hp: 100, maxHp: 100,
})));
const buildingRoles: BuildingRole[] = ['hq', 'depot', 'barracks', 'tower', 'wall', 'gate'];
const buildingTemplate = state.entities.find(e => e.side === 0 && e.kind === 'building')!;
const buildings = buildingRoles.map((role, index) => ({ ...buildingTemplate, id: 100 + index, role, hp: 100, maxHp: 100 }));
function buildingPose(entity: Entity, animation: string, frame: number) {
  entity.hp = animation === 'death' ? 0 : 100;
  entity.progress = animation === 'construction' ? (frame % 3 + .1) / 3 : 1;
  entity.gateOpen = entity.role === 'gate' && animation === 'open';
  entity.animTime = 0;
}
const failures: string[] = [];
let checked = 0;
let stage = 'boot';
let art: ArtRuntime;

class ReviewScene extends Phaser.Scene {
  preload() {
    stage = 'loading';
    art = new ArtRuntime(this);
    art.preload([faction]);
    this.load.on('loaderror', (file: { key: string }) => failures.push(`load: ${file.key}`));
  }
  create() {
    stage = 'validating';
    art.ready();
    for (let row = 0; row < roles.length; row++) {
      const def = FACTIONS[faction].units[roles[row]];
      this.add.text(16, row * 210 + 8, def.name, { fontSize: '15px', color: '#eee5cc' });
      for (let direction = 0; direction < 8; direction++) {
        const x = 94 + direction * 172, y = 174 + row * 210;
        this.add.ellipse(x, y + 3, 46, 15, 0x13231b, .7);
        this.add.text(x - 20, y + 18, String(direction), { fontSize: '12px', color: '#a7bfae' });
      }
    }
    const checkFrame = (entity: Entity, id: string, label: string) => {
      const asset = art.manifest!.assets[id];
      art.begin();
      if (!art.entity(entity, state, 200, 200)) failures.push(`frame: ${id}/${label}`);
      else {
        const key = `entity:${entity.id}`;
        const top = art.top(key);
        if (top === null || !Number.isFinite(top)) failures.push(`anchor: ${id}/${label}`);
        let hit = false;
        for (let y = 200 - asset.anchor[1]; y < 200 + asset.height - asset.anchor[1] && !hit; y += 3) {
          for (let x = 200 - asset.anchor[0]; x < 200 + asset.width - asset.anchor[0]; x += 3) {
            if (art.contains(key, x, y)) { hit = true; break; }
          }
        }
        if (!hit) failures.push(`alpha: ${id}/${label}`);
      }
      checked++;
    };
    // Check every packed frame through the same lookup and placement path used
    // by GameScene. Alpha hit testing also exercises trimmed atlas offsets.
    for (const entity of entities) {
      const id = FACTIONS[faction].units[entity.role].id;
      const asset = art.manifest!.assets[id];
      for (const [animation, count] of Object.entries(counts)) {
        for (let frame = 0; frame < count; frame++) {
          entity.animation = animation === 'death' ? 'idle' : animation as 'idle' | 'walk' | 'attack';
          entity.hp = animation === 'death' ? 0 : 100;
          entity.animTime = (frame + .1) / (animation === 'death' ? 5 : asset.animations![animation].fps);
          checkFrame(entity, id, `${animation}/${entity.facing}/${frame}`);
        }
      }
    }
    for (let index = 0; index < buildings.length; index++) {
      const entity = buildings[index];
      const def = FACTIONS[faction].buildings[entity.role];
      this.add.text(16 + index * 232, roles.length * 210 + 14, def.name, { fontSize: '15px', color: '#eee5cc' });
      for (const [animation, info] of Object.entries(art.manifest!.assets[def.id].animations!)) {
        for (let frame = 0; frame < info.frames; frame++) {
          buildingPose(entity, animation, frame);
          checkFrame(entity, def.id, `${animation}/0/${frame}`);
        }
      }
    }
    art.reset();
    stage = 'ready';
    const portraits = document.querySelector('#portraits')!;
    for (const role of roles) {
      const def = FACTIONS[faction].units[role];
      const figure = document.createElement('figure');
      const image = document.createElement('img'); image.src = `/assets/selection-${def.id}.png`; image.alt = def.name;
      const caption = document.createElement('figcaption'); caption.textContent = def.name;
      figure.append(image, caption); portraits.append(figure);
    }
  }
  update(time: number) {
    if (!art?.manifest) return;
    const animation = animationSelect.value;
    const frame = playing.checked ? Math.floor(time / 160) % counts[animation] : Number(slider.value);
    if (playing.checked) slider.value = String(frame);
    document.querySelector('output')!.value = String(frame);
    art.begin();
    for (let index = 0; index < entities.length; index++) {
      const entity = entities[index];
      entity.animation = animation === 'death' ? 'idle' : animation as 'idle' | 'walk' | 'attack';
      entity.hp = animation === 'death' ? 0 : 100;
      const asset = art.manifest.assets[FACTIONS[faction].units[entity.role].id];
      entity.animTime = (frame + .1) / (animation === 'death' ? 5 : asset.animations![animation].fps);
      art.entity(entity, state, 94 + index % 8 * 172, 174 + Math.floor(index / 8) * 210);
    }
    for (let index = 0; index < buildings.length; index++) {
      buildingPose(buildings[index], buildingState.value, frame);
      art.entity(buildings[index], state, 116 + index * 232, roles.length * 210 + 270);
    }
    art.end();
    status.textContent = `${art.loaded ? 'Loaded' : 'INCOMPLETE'} · ${checked} frames checked · ${failures.length} errors · ${animation} frame ${frame} · ${art.loadedAtlasPages} atlas pages`;
  }
}
// Keep this inspection fixture advancing when a preview pauses animation frames.
// It checks asset rendering and is not a frame-rate benchmark.
new Phaser.Game({ type: Phaser.AUTO, parent: 'canvas', width: 1440, height: roles.length * 210 + 310, backgroundColor: '#202d29', scene: ReviewScene, audio: { noAudio: true }, fps: { forceSetTimeOut: true }, render: { antialias: true } });
Object.defineProperty(window, 'artReview', { get: () => ({ faction, stage, assets: art?.assetCount ?? 0, loaded: art?.loaded ?? false, checked, failures: [...failures], pages: art?.loadedAtlasPages ?? 0, renderedUnits: art?.renderedUnits ?? 0 }) });
