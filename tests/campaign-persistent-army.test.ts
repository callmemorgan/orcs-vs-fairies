import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { provePersistentArmy } from '../scripts/scenarios/prove-persistent-army';

describe('earned persistent campaign army', () => {
  it('replays earned ranks and artifacts, removes a deployed casualty, and preserves reserves deterministically', () => {
    const directory = mkdtempSync(join(tmpdir(), 'campaign-persistent-army-'));
    const first = provePersistentArmy(join(directory, 'first'));
    const second = provePersistentArmy(join(directory, 'second'));
    expect(Object.values(first.assertions).every(Boolean)).toBe(true);
    expect(first.chapters.map(chapter => chapter.mission)).toEqual(['dwarves-1', 'dwarves-2', 'dwarves-3-alt']);
    expect(first.promotions.length).toBeGreaterThan(0);
    expect(first.equipment).toContainEqual(expect.objectContaining({ id: 1, artifact: 1 }));
    expect(first.casualty).not.toBeNull();
    expect(first.reserves).toContain(2);
    expect(first.recruited.some(id => first.reserves.includes(id))).toBe(true);
    expect(first.continuations).toHaveLength(3);
    expect(first.deterministicSha256).toBe(second.deterministicSha256);
    const finalArmy = JSON.parse(readFileSync(join(directory, 'first', 'final-army.json'), 'utf8'));
    expect(finalArmy.some((soldier: { entity: { id: number } }) => soldier.entity.id === first.casualty)).toBe(false);
  }, 60000);
});
