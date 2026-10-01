export type GamepadAction =
  | 'selectPrevious'
  | 'selectNext'
  | 'select'
  | 'contextOrder'
  | 'attackMode'
  | 'cancel'
  | 'ability'
  | 'hold'
  | 'stop'
  | 'centerHq'
  | 'pause'
  | 'photo'
  | 'action1'
  | 'action2'
  | 'action3'
  | 'action4'
  | 'action5'
  | 'action6';

export interface GamepadButtonSample {
  readonly pressed?: boolean;
  readonly value?: number;
}

/** A browser Gamepad or a small snapshot suitable for replaying controller input. */
export interface GamepadSample {
  readonly index: number;
  readonly id?: string;
  readonly connected?: boolean;
  readonly mapping?: string;
  readonly timestamp?: number;
  readonly axes: readonly number[];
  readonly buttons: readonly (GamepadButtonSample | number)[];
}

export interface GamepadFrame {
  connected: boolean;
  padIndex: number | null;
  /** Pixel deltas; the scene applies its camera zoom and display density. */
  cameraX: number;
  cameraY: number;
  /** Zoom-factor delta; positive values zoom in. */
  zoom: number;
  /** Pixel deltas in canvas coordinates. */
  cursorX: number;
  cursorY: number;
  pressed: GamepadAction[];
  queued: boolean;
}

export const GAMEPAD_BUTTON_ACTIONS = {
  0: 'select',
  1: 'cancel',
  2: 'contextOrder',
  3: 'attackMode',
  4: 'selectPrevious',
  5: 'selectNext',
  8: 'photo',
  9: 'pause',
  12: 'ability',
  13: 'hold',
  14: 'stop',
  15: 'centerHq',
} as const satisfies Readonly<Record<number, GamepadAction>>;

export const GAMEPAD_HELP = [
  { control: 'Left stick', action: 'Move camera' },
  { control: 'Right stick', action: 'Move cursor' },
  { control: 'LT / RT', action: 'Zoom out / in' },
  { control: 'LB / RB', action: 'Select previous / next unit' },
  { control: 'A', action: 'Select at cursor' },
  { control: 'X', action: 'Order at cursor' },
  { control: 'Y', action: 'Attack mode' },
  { control: 'B', action: 'Cancel' },
  { control: 'D-pad up', action: 'Use ability' },
  { control: 'D-pad down', action: 'Hold position' },
  { control: 'D-pad left', action: 'Stop' },
  { control: 'D-pad right', action: 'Center headquarters' },
  { control: 'Left stick click (hold)', action: 'Queue orders' },
  { control: 'Right stick click (hold) + A/B/X/Y/LB/RB', action: 'Action slots 1–6' },
  { control: 'Start / Menu', action: 'Pause' },
  { control: 'Select / View', action: 'Photo mode' },
] as const;

const STICK_DEADZONE = 0.18;
const TRIGGER_DEADZONE = 0.05;
const MAX_FRAME_MS = 50;
const CAMERA_PIXELS_PER_SECOND = 750;
const CURSOR_PIXELS_PER_SECOND = 650;
const ZOOM_PER_SECOND = 0.8;
const BUTTON_COUNT = 17;
const QUEUE_BUTTON = 10;
const ACTION_SLOT_MODIFIER = 11;
const SLOT_ACTIONS: readonly GamepadAction[] = ['action1', 'action2', 'action3', 'action4', 'action5', 'action6'];

function finite(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stick(axes: readonly number[], offset: number): [number, number] {
  const x = clamp(finite(axes[offset]), -1, 1);
  const y = clamp(finite(axes[offset + 1]), -1, 1);
  const magnitude = Math.hypot(x, y);
  if (magnitude <= STICK_DEADZONE) return [0, 0];
  const strength = (Math.min(1, magnitude) - STICK_DEADZONE) / (1 - STICK_DEADZONE);
  return [x / magnitude * strength, y / magnitude * strength];
}

function buttonValue(button: GamepadButtonSample | number | undefined): number {
  if (typeof button === 'number') return clamp(finite(button), 0, 1);
  if (!button) return 0;
  if (button.value !== undefined) return clamp(finite(button.value), 0, 1);
  return button.pressed ? 1 : 0;
}

function buttonPressed(button: GamepadButtonSample | number | undefined): boolean {
  return (typeof button === 'object' && button?.pressed === true) || buttonValue(button) >= 0.5;
}

function trigger(button: GamepadButtonSample | number | undefined): number {
  return Math.max(0, buttonValue(button) - TRIGGER_DEADZONE) / (1 - TRIGGER_DEADZONE);
}

function emptyFrame(padIndex: number | null = null): GamepadFrame {
  return {
    connected: padIndex !== null,
    padIndex,
    cameraX: 0,
    cameraY: 0,
    zoom: 0,
    cursorX: 0,
    cursorY: 0,
    pressed: [],
    queued: false,
  };
}

/**
 * Polls standard-mapped controllers without depending on a browser or scene.
 * A new device, timestamp rollback, or focus restoration primes held buttons:
 * those buttons must be released before they can issue commands. Axes remain
 * responsive immediately. An omitted mapping is accepted for recorded samples.
 */
export class GamepadController {
  private padIndex: number | null = null;
  private padId = '';
  private lastTimestamp = 0;
  private previousButtons: boolean[] = [];
  private blockedButtons = new Set<number>();
  private wasSuppressed = false;

  reset(): void {
    this.padIndex = null;
    this.padId = '';
    this.lastTimestamp = 0;
    this.previousButtons = [];
    this.blockedButtons.clear();
    this.wasSuppressed = false;
  }

  update(
    pads: readonly (GamepadSample | null | undefined)[],
    deltaMs: number,
    suppressed = false,
  ): GamepadFrame {
    const available = pads.filter((pad): pad is GamepadSample =>
      pad !== null && pad !== undefined && pad.connected !== false &&
      Number.isInteger(pad.index) && pad.index >= 0 &&
      (pad.mapping === undefined || pad.mapping === 'standard'),
    );
    const pad = available.find(candidate => candidate.index === this.padIndex) ?? available[0];
    if (!pad) {
      this.reset();
      return emptyFrame();
    }

    const buttons = Array.from({ length: BUTTON_COUNT }, (_, index) => buttonPressed(pad.buttons[index]));
    const timestamp = Math.max(0, finite(pad.timestamp));
    const newDevice = pad.index !== this.padIndex || (pad.id ?? '') !== this.padId ||
      (timestamp > 0 && this.lastTimestamp > 0 && timestamp < this.lastTimestamp);
    const primeButtons = newDevice || suppressed || this.wasSuppressed;

    if (newDevice) this.blockedButtons.clear();
    for (let index = 0; index < BUTTON_COUNT; index++) {
      if (!buttons[index]) this.blockedButtons.delete(index);
      else if (primeButtons) this.blockedButtons.add(index);
    }

    const frame = emptyFrame(pad.index);
    if (!suppressed) {
      const seconds = clamp(finite(deltaMs), 0, MAX_FRAME_MS) / 1000;
      if (seconds > 0) {
        const [cameraX, cameraY] = stick(pad.axes, 0);
        const [cursorX, cursorY] = stick(pad.axes, 2);
        frame.cameraX = cameraX * CAMERA_PIXELS_PER_SECOND * seconds;
        frame.cameraY = cameraY * CAMERA_PIXELS_PER_SECOND * seconds;
        frame.cursorX = cursorX * CURSOR_PIXELS_PER_SECOND * seconds;
        frame.cursorY = cursorY * CURSOR_PIXELS_PER_SECOND * seconds;
        frame.zoom = (trigger(pad.buttons[7]) - trigger(pad.buttons[6])) * ZOOM_PER_SECOND * seconds;
      }
      frame.queued = buttons[QUEUE_BUTTON] && !this.blockedButtons.has(QUEUE_BUTTON);
      if (!primeButtons) {
        for (const [indexString, action] of Object.entries(GAMEPAD_BUTTON_ACTIONS)) {
          const index = Number(indexString);
          if (buttons[index] && !this.previousButtons[index] && !this.blockedButtons.has(index)) {
            if (index < SLOT_ACTIONS.length && buttons[ACTION_SLOT_MODIFIER]) {
              if (!this.blockedButtons.has(ACTION_SLOT_MODIFIER)) frame.pressed.push(SLOT_ACTIONS[index]);
            } else {
              frame.pressed.push(action);
            }
          }
        }
      }
    }

    this.padIndex = pad.index;
    this.padId = pad.id ?? '';
    this.lastTimestamp = timestamp;
    this.previousButtons = buttons;
    this.wasSuppressed = suppressed;
    return frame;
  }
}
