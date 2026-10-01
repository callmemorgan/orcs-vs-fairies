import { describe, expect, it } from 'vitest';
import { missionAbilityCommand } from '../scripts/scenarios/ability-strategy';
import { unitFor } from '../src/core/content-registry';
import { createGame, issueCommand, refreshVisibility, spawnDefinition, spawnEntity } from '../src/core/simulation';
import type { FactionId } from '../src/core/types';

describe('authored commander ability targets', () => {
  for (const faction of ['orcs', 'fairies', 'dwarves', 'undead', 'tideborn', 'automata'] as FactionId[]) {
    it(`${faction} issues its real commander ability through the shared command boundary`, () => {
      const state = createGame(faction, 7731), start = state.starts[0];
      const hero = spawnDefinition(state, 0, 'unit', `core:${faction}-commander`, start.x, start.y + 4);
      const ally = spawnEntity(state, 0, 'unit', 'melee', hero.x + 1, hero.y);
      const enemy = spawnEntity(state, 1, 'unit', 'melee', hero.x + 2, hero.y);
      ally.hp = ally.maxHp / 2; if (ally.maxShield) ally.shield = 0;
      refreshVisibility(state);
      const ability = unitFor(state, hero).ability!, command = missionAbilityCommand(state, hero);
      expect(command).not.toBeNull(); expect(issueCommand(state, 0, command!)).toBe(true);
      expect(state.events.some(event => event.type === 'ability' && event.source === hero.id)).toBe(true);
      expect(hero.abilityReadyAt).toBeGreaterThan(state.time);
      if (ability === 'iron-command') expect(ally.specialistBuffs!.some(buff => buff.damageFactor === 1.25)).toBe(true);
      if (ability === 'queen-step' || ability === 'thane-ward' || ability === 'admiral-wave') expect(ally.hp).toBeGreaterThan(ally.maxHp / 2);
      if (ability === 'soul-drain') expect(enemy.hp).toBeLessThan(enemy.maxHp);
      if (ability === 'prime-shield') expect(ally.shield).toBe(ally.maxShield);
      expect(missionAbilityCommand(state, hero)).toBeNull();
    });
  }
});
