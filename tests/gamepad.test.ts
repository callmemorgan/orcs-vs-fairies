import { describe, expect, it } from 'vitest';
import { GAMEPAD_HELP, GamepadController, type GamepadSample } from '../src/game/Gamepad';

function pad(overrides: Partial<GamepadSample> = {}): GamepadSample {
  return {
    index: 0,
    id: 'test-controller',
    connected: true,
    mapping: 'standard',
    timestamp: 1,
    axes: [0, 0, 0, 0],
    buttons: Array(17).fill(0),
    ...overrides,
  };
}

function withButtons(indices: number[], overrides: Partial<GamepadSample> = {}): GamepadSample {
  const buttons = Array(17).fill(0);
  for (const index of indices) buttons[index] = 1;
  return pad({ buttons, ...overrides });
}

describe('gamepad polling', () => {
  it('reports disconnection without retaining input from an earlier frame', () => {
    const controller = new GamepadController();
    controller.update([pad()], 16, false);
    expect(controller.update([withButtons([0, 10], { axes: [1, 1, 1, 1] })], 16, false).pressed).toEqual(['select']);
    const disconnected = controller.update([null, pad({ connected: false })], 16, false);
    expect(disconnected).toEqual({
      connected: false, padIndex: null, cameraX: 0, cameraY: 0, zoom: 0,
      cursorX: 0, cursorY: 0, pressed: [], queued: false,
    });
    expect(controller.update([withButtons([0, 10])], 16, false).pressed).toEqual([]);
    expect(controller.update([withButtons([0, 10])], 16, false).queued).toBe(false);
    controller.update([pad()], 16, false);
    expect(controller.update([withButtons([0, 10])], 16, false)).toMatchObject({ pressed: ['select'], queued: true });
  });

  it('uses a radial deadzone and caps diagonal movement at the same speed as a straight stick', () => {
    const controller = new GamepadController();
    expect(controller.update([pad({ axes: [0.1, 0.1, 0.1, -0.1] })], 20, false)).toMatchObject({
      cameraX: 0, cameraY: 0, cursorX: 0, cursorY: 0,
    });
    const half = controller.update([pad({ axes: [0.59, 0, 0, -0.59] })], 20, false);
    expect(half.cameraX).toBeCloseTo(7.5);
    expect(half.cursorY).toBeCloseTo(-6.5);
    const straight = controller.update([pad({ axes: [1, 0, 0, 1] })], 20, false);
    const diagonal = controller.update([pad({ axes: [1, 1, -1, -1] })], 20, false);
    expect(Math.hypot(diagonal.cameraX, diagonal.cameraY)).toBeCloseTo(straight.cameraX);
    expect(Math.hypot(diagonal.cursorX, diagonal.cursorY)).toBeCloseTo(straight.cursorY);
    expect(diagonal.cursorX).toBeLessThan(0);
    expect(diagonal.cursorY).toBeLessThan(0);
    // Each component is below the deadzone, but their combined movement is intentional.
    expect(controller.update([pad({ axes: [0.15, 0.15] })], 20, false).cameraX).toBeGreaterThan(0);
  });

  it('scales movement by frame time, caps stalled frames, and rejects invalid analog samples', () => {
    const controller = new GamepadController();
    const moving = pad({ axes: [1, -1, 1, 0], buttons: Array.from({ length: 17 }, (_, index) => index === 7 ? 1 : 0) });
    const short = controller.update([moving], 10, false);
    const long = controller.update([moving], 20, false);
    expect(long.cameraX).toBeCloseTo(short.cameraX * 2);
    expect(long.cursorX).toBeCloseTo(short.cursorX * 2);
    expect(long.zoom).toBeCloseTo(short.zoom * 2);
    expect(controller.update([moving], 1000, false).cursorX).toBe(32.5);
    for (const delta of [-1, NaN, Infinity]) {
      expect(controller.update([moving], delta, false)).toMatchObject({ cameraX: 0, cameraY: 0, cursorX: 0, cursorY: 0, zoom: 0 });
    }
    expect(controller.update([pad({ axes: [NaN, Infinity, undefined as unknown as number, -Infinity], buttons: [NaN] })], 16, false))
      .toMatchObject({ cameraX: 0, cameraY: 0, cursorX: 0, cursorY: 0, pressed: [] });
    expect(controller.update([pad({ axes: [9, 0, -9] })], 20, false)).toMatchObject({ cameraX: 15, cursorX: -13 });
  });

  it('zooms with proportional triggers and cancels equal trigger input', () => {
    const controller = new GamepadController();
    const buttons = Array(17).fill(0);
    buttons[6] = 0.05;
    buttons[7] = 0.525;
    expect(controller.update([pad({ buttons })], 20, false).zoom).toBeCloseTo(0.008);
    buttons[6] = 1;
    buttons[7] = 0;
    expect(controller.update([pad({ buttons })], 20, false).zoom).toBeCloseTo(-0.016);
    buttons[7] = 1;
    expect(controller.update([pad({ buttons })], 20, false).zoom).toBe(0);
    buttons[6] = { value: 0.525, pressed: true };
    buttons[7] = { value: 0.05, pressed: false };
    expect(controller.update([pad({ buttons })], 20, false).zoom).toBeCloseTo(-0.008);
  });

  it('maps every command and emits only rising edges even when timestamps are unchanged', () => {
    const controller = new GamepadController();
    controller.update([pad()], 16, false);
    const pressed = withButtons([0, 1, 2, 3, 4, 5, 8, 9, 12, 13, 14, 15]);
    expect(controller.update([pressed], 16, false).pressed).toEqual([
      'select', 'cancel', 'contextOrder', 'attackMode', 'selectPrevious', 'selectNext',
      'photo', 'pause', 'ability', 'hold', 'stop', 'centerHq',
    ]);
    expect(controller.update([pressed], 16, false).pressed).toEqual([]);
    controller.update([pad()], 16, false);
    expect(controller.update([withButtons([0])], 16, false).pressed).toEqual(['select']);
    const firstFrame = controller.update([pad()], 16, false);
    controller.update([withButtons([2])], 16, false);
    expect(firstFrame.pressed).toEqual([]);
  });

  it('accepts browser button objects and distinguishes queue modifiers from shoulder selection', () => {
    const controller = new GamepadController();
    controller.update([pad()], 16, false);
    const buttons = Array(17).fill({ value: 0, pressed: false });
    buttons[0] = { value: 0, pressed: true };
    buttons[2] = { value: 0.75, pressed: false };
    buttons[5] = { value: 1, pressed: true };
    buttons[10] = { value: 1, pressed: true };
    expect(controller.update([pad({ buttons })], 16, false)).toMatchObject({
      pressed: ['select', 'contextOrder', 'selectNext'], queued: true,
    });
    expect(controller.update([pad({ buttons })], 16, false)).toMatchObject({ pressed: [], queued: true });
    buttons[10] = { value: 0, pressed: false };
    expect(controller.update([pad({ buttons })], 16, false).queued).toBe(false);
    expect(GAMEPAD_HELP.find(item => item.action === 'Queue orders')?.control).toContain('Left stick click');
  });

  it('suppresses all controls and requires release after dialog focus is restored', () => {
    const controller = new GamepadController();
    controller.update([pad()], 16, false);
    const active = withButtons([0, 7, 10], { axes: [1, 0, 0, 1] });
    expect(controller.update([active], 16, true)).toEqual({
      connected: true, padIndex: 0, cameraX: 0, cameraY: 0, zoom: 0,
      cursorX: 0, cursorY: 0, pressed: [], queued: false,
    });
    const resumed = controller.update([active], 16, false);
    expect(resumed.pressed).toEqual([]);
    expect(resumed.queued).toBe(false);
    expect(resumed.cameraX).toBeGreaterThan(0);
    controller.update([pad()], 16, false);
    expect(controller.update([active], 16, false)).toMatchObject({ pressed: ['select'], queued: true });
    controller.update([pad()], 16, true);
    expect(controller.update([withButtons([2])], 16, false).pressed).toEqual([]);
    controller.update([pad()], 16, false);
    expect(controller.update([withButtons([2])], 16, false).pressed).toEqual(['contextOrder']);
  });

  it('retains the active pad and safely primes a second controller when the first disconnects', () => {
    const controller = new GamepadController();
    const second = pad({ index: 2, id: 'second-controller', axes: [-1, 0] });
    expect(controller.update([null, pad(), second], 16, false).padIndex).toBe(0);
    expect(controller.update([second, withButtons([0])], 16, false)).toMatchObject({ padIndex: 0, pressed: ['select'] });
    const takeover = withButtons([2], { index: 2, id: 'second-controller', axes: [-1, 0] });
    expect(controller.update([null, takeover], 16, false)).toMatchObject({ padIndex: 2, pressed: [], cameraX: -12 });
    controller.update([second], 16, false);
    expect(controller.update([takeover], 16, false).pressed).toEqual(['contextOrder']);
    expect(controller.update([pad(), takeover], 16, false).padIndex).toBe(2);
  });

  it('primes replacement controllers and timestamp rollbacks without blocking later fresh input', () => {
    const controller = new GamepadController();
    controller.update([pad({ timestamp: 100 })], 16, false);
    expect(controller.update([withButtons([0], { id: 'replacement', timestamp: 101 })], 16, false).pressed).toEqual([]);
    controller.update([pad({ id: 'replacement', timestamp: 102 })], 16, false);
    expect(controller.update([withButtons([0], { id: 'replacement', timestamp: 103 })], 16, false).pressed).toEqual(['select']);
    controller.update([pad({ id: 'replacement', timestamp: 104 })], 16, false);
    expect(controller.update([withButtons([0], { id: 'replacement', timestamp: 1 })], 16, false).pressed).toEqual([]);
    controller.update([pad({ id: 'replacement', timestamp: 2 })], 16, false);
    expect(controller.update([withButtons([0], { id: 'replacement', timestamp: 3 })], 16, false).pressed).toEqual(['select']);
    controller.reset();
    expect(controller.update([withButtons([0], { id: 'replacement', timestamp: 4 })], 16, false).pressed).toEqual([]);
  });

  it('accepts minimal samples, ignores unsupported mappings, and ignores invalid device indices', () => {
    const controller = new GamepadController();
    expect(controller.update([pad({ mapping: '', axes: [1, 0] })], 16, false).connected).toBe(false);
    expect(controller.update([pad({ index: NaN }), pad({ index: -1 }), pad({ index: 0.5 })], 16, false).connected).toBe(false);
    const sample = { index: 3, axes: [1, 0], buttons: [] };
    expect(controller.update([sample], 16, false)).toMatchObject({ connected: true, padIndex: 3, cameraX: 12 });
    expect(controller.update([undefined, sample], 16, false).padIndex).toBe(3);
  });

  it('activates all six HUD action slots with R3 while replacing normal commands', () => {
    const controller = new GamepadController();
    controller.update([pad()], 16, false);
    const slotButtons = withButtons([0, 1, 2, 3, 4, 5, 11]);
    expect(controller.update([slotButtons], 16, false).pressed).toEqual([
      'action1', 'action2', 'action3', 'action4', 'action5', 'action6',
    ]);
    expect(controller.update([slotButtons], 16, false).pressed).toEqual([]);
    expect(controller.update([withButtons([11])], 16, false).pressed).toEqual([]);
    expect(controller.update([withButtons([3, 11, 12])], 16, false).pressed).toEqual(['action4', 'ability']);
    expect(controller.update([pad()], 16, false).pressed).toEqual([]);
    expect(controller.update([withButtons([0, 1, 2, 3, 4, 5])], 16, false).pressed).toEqual([
      'select', 'cancel', 'contextOrder', 'attackMode', 'selectPrevious', 'selectNext',
    ]);
    expect(GAMEPAD_HELP.find(item => item.action === 'Action slots 1–6')?.control).toContain('Right stick click');
  });

  it('requires fresh face-button presses when R3 is activated or released', () => {
    const controller = new GamepadController();
    controller.update([pad()], 16, false);
    expect(controller.update([withButtons([0])], 16, false).pressed).toEqual(['select']);
    expect(controller.update([withButtons([0, 11])], 16, false).pressed).toEqual([]);
    controller.update([withButtons([11])], 16, false);
    expect(controller.update([withButtons([0, 11])], 16, false).pressed).toEqual(['action1']);
    expect(controller.update([withButtons([0])], 16, false).pressed).toEqual([]);
    controller.update([pad()], 16, false);
    expect(controller.update([withButtons([0])], 16, false).pressed).toEqual(['select']);
  });

  it('primes R3 safely on connection and focus restoration', () => {
    const controller = new GamepadController();
    expect(controller.update([withButtons([11])], 16, false).pressed).toEqual([]);
    // A held modifier from the connection cannot turn fresh face-button presses into actions.
    expect(controller.update([withButtons([0, 11])], 16, false).pressed).toEqual([]);
    controller.update([pad()], 16, false);
    expect(controller.update([withButtons([0, 11])], 16, false).pressed).toEqual(['action1']);
    controller.update([withButtons([11])], 16, true);
    expect(controller.update([withButtons([11])], 16, false).pressed).toEqual([]);
    expect(controller.update([withButtons([2, 11])], 16, false).pressed).toEqual([]);
    controller.update([pad()], 16, false);
    expect(controller.update([withButtons([2, 11])], 16, false).pressed).toEqual(['action3']);
    controller.update([], 16, false);
    expect(controller.update([withButtons([2, 11])], 16, false).pressed).toEqual([]);
  });
});
