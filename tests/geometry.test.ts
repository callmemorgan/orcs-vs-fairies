import { describe, expect, it } from 'vitest';
import { DIRECTIONS_24, DIRECTIONS_32, MATCH_START_DIRECTIONS, NEAREST_DIRECTION_INDICES_32, facing8, length2D } from '../src/core/geometry';
import { openDestination, walkable } from '../src/core/navigation';
import { createGame } from '../src/core/simulation';

describe('eight-direction facing', () => {
  it.each([
    [1, 0, 0], [1, 1, 1], [0, 1, 2], [-1, 1, 3],
    [-1, 0, 4], [-1, -1, 5], [0, -1, 6], [1, -1, 7],
  ])('faces vector (%s, %s) in direction %s at different scales', (x, y, expected) => {
    for (const scale of [2 ** -20, 1, 2 ** 20]) expect(facing8(x * scale, y * scale)).toBe(expected);
  });

  it('treats signed zero as an axis and gives a stationary vector a stable default', () => {
    expect(facing8(1, -0)).toBe(0);
    expect(facing8(-1, -0)).toBe(4);
    expect(facing8(-0, 1)).toBe(2);
    expect(facing8(-0, -1)).toBe(6);
    for (const x of [0, -0]) for (const y of [0, -0]) expect(facing8(x, y)).toBe(0);
  });

  it('preserves direction when a nonzero vector is scaled into subnormal numbers', () => {
    const vectors = [
      [1, 0, 0], [3, 1, 0], [1, 1, 1], [1, 3, 2], [0, 1, 2],
      [-1, 3, 2], [-1, 1, 3], [-3, 1, 4], [-1, 0, 4], [-3, -1, 4],
      [-1, -1, 5], [-1, -3, 6], [0, -1, 6], [1, -3, 6], [1, -1, 7], [3, -1, 0],
    ];
    for (const scale of [Number.MIN_VALUE, 2 ** -1022, 1]) for (const [x, y, expected] of vectors) {
      expect(facing8(x * scale, y * scale), `(${x}, ${y}) scaled by ${scale}`).toBe(expected);
    }
  });

  const boundary = .41421356237309503;
  const boundaries: Array<{ angle: number; vector: (slope: number) => readonly [number, number]; increasing: boolean; before: number; tie: number }> = [
    { angle: 22.5, vector: slope => [1, slope], increasing: true, before: 0, tie: 1 },
    { angle: 67.5, vector: slope => [slope, 1], increasing: false, before: 1, tie: 2 },
    { angle: 112.5, vector: slope => [-slope, 1], increasing: true, before: 2, tie: 3 },
    { angle: 157.5, vector: slope => [-1, slope], increasing: false, before: 3, tie: 4 },
    { angle: -157.5, vector: slope => [-1, -slope], increasing: true, before: 4, tie: 5 },
    { angle: -112.5, vector: slope => [-slope, -1], increasing: false, before: 5, tie: 6 },
    { angle: -67.5, vector: slope => [slope, -1], increasing: true, before: 6, tie: 7 },
    { angle: -22.5, vector: slope => [1, -slope], increasing: false, before: 7, tie: 0 },
  ];
  it.each(boundaries)('rounds the $angle degree boundary toward increasing signed angle', ({ vector, increasing, before, tie }) => {
    const offset = increasing ? 1e-12 : -1e-12;
    expect(facing8(...vector(boundary - offset))).toBe(before);
    expect(facing8(...vector(boundary))).toBe(tie);
    expect(facing8(...vector(boundary + offset))).toBe(tie);
  });
});

describe('fixed direction geometry', () => {
  it.each([[24, DIRECTIONS_24], [32, DIRECTIONS_32]] as const)('covers a unit circle with %i equally spaced directions', (count, directions) => {
    expect(directions).toHaveLength(count);
    expect(directions[0]).toEqual([1, 0]);
    expect(directions[count / 4]).toEqual([0, 1]);
    const [firstX, firstY] = directions[0], [secondX, secondY] = directions[1];
    const adjacentDot = firstX * secondX + firstY * secondY;
    for (let index = 0; index < count; index++) {
      const [x, y] = directions[index], [nextX, nextY] = directions[(index + 1) % count];
      expect(length2D(x, y)).toBeCloseTo(1, 15);
      expect(x * nextY - y * nextX).toBeGreaterThan(0);
      expect(x * nextX + y * nextY).toBeCloseTo(adjacentDot, 15);
      const [oppositeX, oppositeY] = directions[(index + count / 2) % count];
      expect(oppositeX + x).toBe(0);
      expect(oppositeY + y).toBe(0);
    }
  });

  it('visits every search direction by angular distance, with positive deviation first in a tie', () => {
    expect(new Set(NEAREST_DIRECTION_INDICES_32).size).toBe(32);
    expect([...NEAREST_DIRECTION_INDICES_32].sort((a, b) => a - b)).toEqual(Array.from({ length: 32 }, (_, index) => index));
    const ordered = NEAREST_DIRECTION_INDICES_32.map(index => DIRECTIONS_32[index]);
    expect(ordered[0]).toEqual([1, 0]);
    expect(ordered.at(-1)).toEqual([-1, 0]);
    for (let index = 1; index < ordered.length; index++) {
      const [previousX, previousY] = ordered[index - 1], [x, y] = ordered[index];
      expect(previousX).toBeGreaterThanOrEqual(x);
      if (previousX === x) expect(previousY).toBeGreaterThan(y);
    }
  });

  it.each([3, 4, 5, 6, 7, 8])('spaces %i multiplayer starts evenly from the northwest', count => {
    const directions = MATCH_START_DIRECTIONS[count];
    expect(directions).toHaveLength(count);
    expect(directions[0][0]).toBeLessThan(0);
    expect(directions[0][0]).toBe(directions[0][1]);
    const [firstX, firstY] = directions[0], [secondX, secondY] = directions[1];
    const adjacentDot = firstX * secondX + firstY * secondY;
    for (let index = 0; index < count; index++) {
      const [x, y] = directions[index], [nextX, nextY] = directions[(index + 1) % count];
      expect(length2D(x, y)).toBeCloseTo(1, 15);
      expect(x * nextY - y * nextX).toBeGreaterThan(0);
      expect(x * nextX + y * nextY).toBeCloseTo(adjacentDot, 15);
    }
  });
});

it('chooses a consistent side of a blocked HQ approach at a symmetric distance tie', () => {
  const state = createGame('orcs', 4127, 'fairies', { mapSize: 'small', controllers: ['external', 'external'] });
  state.terrain.fill('grass');
  state.resources = [];
  state.entities = state.entities.filter(entity => entity.side === 1 && entity.role === 'hq');
  const order = { x: 28.9, y: 28.9 };
  expect(walkable(state, order.x, order.y)).toBe(false);
  // The second approach is the unit position before the replay's first drift at tick 3080.
  for (const from of [{ x: 17.5, y: 17.5 }, { x: 17.695250120602314, y: 17.695488660475984 }]) {
    const destination = openDestination(state, order, from)!;
    expect(walkable(state, destination.x, destination.y)).toBe(true);
    expect(length2D(destination.x - order.x, destination.y - order.y)).toBeCloseTo(1.5, 12);
    expect(destination.x).toBeGreaterThan(30.27);
    expect(destination.y).toBeLessThan(order.y);
  }
});
