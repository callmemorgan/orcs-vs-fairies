// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APPEARANCE_STORAGE_KEY, AppearancePreferences, DEFAULT_APPEARANCE, PALETTES } from '../src/game/Appearance';
import { displaySettings, type DisplaySettingsDialog } from '../src/ui/DisplaySettings';

const mounted: DisplaySettingsDialog[] = [];
afterEach(() => {
  for (const dialog of mounted.splice(0)) dialog.dispose();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function setup(appearance = new AppearancePreferences(null)) {
  const root = document.createElement('div'), launch = document.createElement('button');
  launch.textContent = 'Display settings';
  document.body.append(launch, root);
  const settings = displaySettings(root, appearance);
  mounted.push(settings);
  return {
    root, launch, settings, appearance,
    dialog: root.querySelector<HTMLElement>('[role="dialog"]')!,
    close: root.querySelector<HTMLButtonElement>('header button')!,
    reset: root.querySelector<HTMLButtonElement>('footer button')!,
    palette: root.querySelector<HTMLSelectElement>('[data-display-setting="palette"]')!,
    patterns: root.querySelector<HTMLInputElement>('[data-display-setting="patterns"]')!,
    outlines: root.querySelector<HTMLInputElement>('[data-display-setting="outlines"]')!,
    markers: Array.from(root.querySelectorAll<SVGPolygonElement>('[data-display-player] polygon')),
  };
}

function changePalette(input: HTMLSelectElement, palette: string) {
  input.value = palette;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function key(target: EventTarget, value: string, shiftKey = false, type = 'keydown') {
  const event = new KeyboardEvent(type, { key: value, code: value === 'Escape' || value === 'Tab' ? value : `Key${value.toUpperCase()}`, shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('display settings', () => {
  it('opens an accessible dialog, labels native controls, and restores the launcher on close', () => {
    const { launch, settings, dialog, close, palette, patterns, outlines } = setup();
    expect(settings.isOpen()).toBe(false);
    expect(dialog.closest('[hidden]')).not.toBeNull();
    launch.focus();
    settings.open();
    expect(settings.isOpen()).toBe(true);
    expect(dialog.closest('[hidden]')).toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Display settings');
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)!.textContent).toContain('Changes apply immediately');
    for (const input of [palette, patterns, outlines]) {
      expect(input.closest('label')?.htmlFor).toBe(input.id);
    }
    expect(document.activeElement).toBe(close);
    settings.open();
    close.click();
    expect(settings.isOpen()).toBe(false);
    expect(document.activeElement).toBe(launch);
  });

  it('applies each alternative palette to all eight preview markers and persists the chosen values', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const { settings, palette, patterns, outlines, markers, appearance } = setup(new AppearancePreferences(storage));
    settings.open();
    expect(markers).toHaveLength(8);
    expect(palette.options).toHaveLength(3);
    for (const name of ['deuteranopia', 'tritanopia'] as const) {
      changePalette(palette, name);
      expect(appearance.value.palette).toBe(name);
      expect(markers.map(marker => marker.getAttribute('fill'))).toEqual(PALETTES[name].map(color => `#${color.toString(16).padStart(6, '0')}`));
    }
    patterns.click();
    outlines.click();
    expect(appearance.value).toEqual({ palette: 'tritanopia', patterns: false, outlines: false });
    expect(JSON.parse(values.get(APPEARANCE_STORAGE_KEY)!)).toEqual({ version: 1, ...appearance.value });
    expect(new AppearancePreferences(storage).value).toEqual(appearance.value);
  });

  it('uses different player shapes and own, ally, and enemy outlines, then honors both toggles', () => {
    const { root, settings, patterns, outlines, markers } = setup();
    settings.open();
    expect(new Set(markers.map(marker => marker.getAttribute('points'))).size).toBe(8);
    expect(new Set(markers.slice(0, 3).map(marker => marker.getAttribute('stroke'))).size).toBe(3);
    expect(root.querySelector('[data-display-player="0"] svg')!.getAttribute('aria-label')).toContain('Your units');
    expect(root.querySelector('[data-display-player="1"] svg')!.getAttribute('aria-label')).toContain('Allied units');
    expect(root.querySelector('[data-display-player="2"] svg')!.getAttribute('aria-label')).toContain('Enemy units');
    patterns.click();
    expect(new Set(markers.map(marker => marker.getAttribute('points'))).size).toBe(1);
    outlines.click();
    expect(markers.every(marker => marker.getAttribute('stroke') === 'none')).toBe(true);
    patterns.click();
    outlines.click();
    expect(new Set(markers.map(marker => marker.getAttribute('points'))).size).toBe(8);
    expect(new Set(markers.slice(0, 3).map(marker => marker.getAttribute('stroke'))).size).toBe(3);
  });

  it('reflects external preference changes without replacing focused controls and resets to defaults', () => {
    const { settings, palette, patterns, outlines, reset, appearance } = setup();
    settings.open();
    palette.focus();
    appearance.set({ palette: 'deuteranopia', patterns: false, outlines: false });
    expect(document.activeElement).toBe(palette);
    expect(palette.value).toBe('deuteranopia');
    expect(patterns.checked).toBe(false);
    expect(outlines.checked).toBe(false);
    reset.click();
    expect(appearance.value).toEqual(DEFAULT_APPEARANCE);
    expect(palette.value).toBe('default');
    expect(patterns.checked).toBe(true);
    expect(outlines.checked).toBe(true);
  });

  it('wraps Tab and Shift+Tab, allows normal Tab movement, and keeps outside focus in the dialog', () => {
    const { settings, close, reset, palette, launch } = setup();
    settings.open();
    expect(key(close, 'Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(reset);
    expect(key(reset, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    palette.focus();
    expect(key(palette, 'Tab').defaultPrevented).toBe(false);
    launch.focus();
    expect(document.activeElement).toBe(close);
    expect(key(launch, 'Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(reset);
  });

  it('blocks gameplay key events on window while preserving events and defaults for native controls', () => {
    const { settings, patterns, launch } = setup();
    const gameplayDown = vi.fn(), gameplayUp = vi.fn(), inputDown = vi.fn();
    window.addEventListener('keydown', gameplayDown);
    window.addEventListener('keyup', gameplayUp);
    patterns.addEventListener('keydown', inputDown);
    try {
      key(launch, 'p');
      expect(gameplayDown).toHaveBeenCalledOnce();
      gameplayDown.mockClear();
      settings.open();
      patterns.focus();
      expect(key(patterns, ' ').defaultPrevented).toBe(false);
      expect(inputDown).toHaveBeenCalledOnce();
      expect(gameplayDown).not.toHaveBeenCalled();
      key(patterns, ' ', false, 'keyup');
      expect(gameplayUp).not.toHaveBeenCalled();
      expect(key(launch, 'p').defaultPrevented).toBe(true);
      key(window, 'p');
      key(launch, 'p', false, 'keyup');
      expect(gameplayDown).not.toHaveBeenCalled();
      expect(gameplayUp).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', gameplayDown);
      window.removeEventListener('keyup', gameplayUp);
    }
  });

  it('closes on Escape from outside the dialog without passing the close key to gameplay', () => {
    const { settings, launch } = setup();
    const gameplay = vi.fn();
    window.addEventListener('keydown', gameplay);
    try {
      launch.focus();
      settings.open();
      const escape = key(window, 'Escape');
      expect(escape.defaultPrevented).toBe(true);
      expect(settings.isOpen()).toBe(false);
      expect(document.activeElement).toBe(launch);
      expect(gameplay).not.toHaveBeenCalled();
      key(launch, 'p');
      expect(gameplay).toHaveBeenCalledOnce();
    } finally { window.removeEventListener('keydown', gameplay); }
  });

  it('blocks pointer events behind the dialog and closes when the backdrop is clicked', () => {
    const { root, settings, patterns } = setup();
    const gameplay = vi.fn();
    window.addEventListener('click', gameplay);
    try {
      settings.open();
      patterns.click();
      expect(gameplay).not.toHaveBeenCalled();
      const overlay = root.querySelector<HTMLElement>('.display-settings-overlay')!;
      overlay.click();
      expect(settings.isOpen()).toBe(false);
      expect(gameplay).not.toHaveBeenCalled();
    } finally { window.removeEventListener('click', gameplay); }
  });

  it('disposes its subscription and global handlers, and detached controls cannot change preferences', () => {
    const { root, settings, launch, palette, patterns, reset, appearance } = setup();
    const gameplay = vi.fn();
    window.addEventListener('keydown', gameplay);
    try {
      launch.focus();
      settings.open();
      appearance.set({ palette: 'tritanopia' });
      settings.dispose();
      settings.dispose();
      expect(root.children).toHaveLength(0);
      expect(settings.isOpen()).toBe(false);
      expect(document.activeElement).toBe(launch);
      key(window, 'p');
      expect(gameplay).toHaveBeenCalledOnce();
      appearance.set({ palette: 'deuteranopia' });
      expect(palette.value).toBe('tritanopia');
      patterns.click();
      reset.click();
      changePalette(palette, 'default');
      expect(appearance.value).toEqual({ palette: 'deuteranopia', patterns: true, outlines: true });
      settings.open();
      expect(settings.isOpen()).toBe(false);
      launch.focus();
      expect(document.activeElement).toBe(launch);
    } finally { window.removeEventListener('keydown', gameplay); }
  });

  it('can close safely if the original focused launcher is removed', () => {
    const { settings, launch } = setup();
    launch.focus();
    settings.open();
    launch.remove();
    expect(() => settings.close()).not.toThrow();
    expect(settings.isOpen()).toBe(false);
  });
});
