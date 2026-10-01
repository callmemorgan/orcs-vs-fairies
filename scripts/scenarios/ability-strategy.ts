import { length2D } from '../../src/core/geometry';
import { unitFor } from '../../src/core/content-registry';
import { walkable } from '../../src/core/navigation';
import { isAllied, isHostile, isVisible } from '../../src/core/simulation';
import type { Command, Entity, GameState, Vec } from '../../src/core/types';

const distance = (a: Vec, b: Vec) => (a.level ?? 0) === (b.level ?? 0) ? length2D(a.x - b.x, a.y - b.y) : Infinity;
const ordinary = (entity: Entity) => entity.hp > 0 && entity.kind === 'unit' && !entity.illusion && !entity.raised;

/** Choose a permitted target using the same visible battlefield available to the player. */
export function missionAbilityCommand(state: GameState, actor: Entity): Extract<Command, { type: 'ability' }> | null {
  if (!ordinary(actor) || (actor.abilityReadyAt ?? 0) > state.time) return null;
  const ability = unitFor(state, actor).ability;
  if (!ability) return null;
  const command: Extract<Command, { type: 'ability' }> = { type: 'ability', ids: [actor.id] };
  const visible = state.entities.filter(entity => ordinary(entity) && isVisible(state, actor.side, entity.x, entity.y, entity.level ?? 0));
  const allies = visible.filter(entity => isAllied(state, actor.side, entity.side) && distance(actor, entity) <= 8)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || distance(actor, a) - distance(actor, b) || a.id - b.id);
  const enemies = visible.filter(entity => isHostile(state, actor.side, entity.side))
    .sort((a, b) => distance(actor, a) - distance(actor, b) || a.id - b.id);
  const point = (target: Vec) => ({ ...command, x: target.x, y: target.y, ...(target.level === undefined ? {} : { level: target.level }) });
  switch (ability) {
    case 'iron-command': return point(actor);
    case 'queen-step': return walkable(state, actor.x, actor.y, actor.level ?? 0) ? point(actor) : null;
    case 'thane-ward': return allies.length ? { ...command, target: allies[0].id } : null;
    case 'soul-drain': return enemies[0] && distance(actor, enemies[0]) <= 7 ? { ...command, target: enemies[0].id } : null;
    case 'admiral-wave': return point(enemies[0] && distance(actor, enemies[0]) <= 8 ? enemies[0] : allies[0] ?? actor);
    case 'prime-shield': {
      const target = allies.filter(entity => !!entity.maxShield)
        .sort((a, b) => (a.shield ?? 0) / a.maxShield! - (b.shield ?? 0) / b.maxShield! || a.id - b.id)[0];
      return target ? { ...command, target: target.id } : null;
    }
    case 'forest-leap':
    case 'shield-dash': {
      const range = ability === 'forest-leap' ? 5 : 4;
      if (ability === 'shield-dash' && (actor.shield ?? 0) < 15) return null;
      const target = enemies.find(entity => distance(actor, entity) <= range && walkable(state, entity.x, entity.y, entity.level ?? 0));
      return target ? point(target) : null;
    }
    default: return command;
  }
}
