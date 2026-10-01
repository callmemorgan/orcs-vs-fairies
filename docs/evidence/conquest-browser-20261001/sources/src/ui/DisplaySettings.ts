import { AppearancePreferences, markerPolygon, ownershipStyle, type AppearanceSettings, type PaletteId } from '../game/Appearance';
import './display-settings.css';

export interface DisplaySettingsDialog {
  open(): void;
  close(): void;
  dispose(): void;
  isOpen(): boolean;
}

const paletteLabels: Record<PaletteId, string> = {
  default: 'Default',
  deuteranopia: 'Deuteranopia (red-green)',
  tritanopia: 'Tritanopia (blue-yellow)',
};
const relationLabels = { own: 'Your units', ally: 'Allied units', enemy: 'Enemy units' } as const;
const previewTeams = [0, 0, 1, 2, 3, 4, 5, 6] as const;
let nextDialogId = 0;

/** Mount once beside the HUD. The host can use isOpen() to block controller input. */
export function displaySettings(root: HTMLElement, appearance: AppearancePreferences): DisplaySettingsDialog {
  const doc = root.ownerDocument, view = doc.defaultView!;
  let opened = false, disposed = false, previousFocus: HTMLElement | null = null;
  const id = `display-settings-${++nextDialogId}`;
  const create = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
    const element = doc.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const svg = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] => doc.createElementNS('http://www.w3.org/2000/svg', tag);
  const button = (text: string, run: () => void) => {
    const element = create('button', text);
    element.type = 'button';
    element.addEventListener('click', () => { if (!disposed) run(); });
    return element;
  };
  const host = create('section', undefined, 'display-settings');
  const overlay = create('div', undefined, 'display-settings-overlay');
  overlay.hidden = true;
  const dialog = create('section', undefined, 'display-settings-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  dialog.setAttribute('aria-describedby', `${id}-description`);
  dialog.tabIndex = -1;
  const header = create('header'), heading = create('h2', 'Display settings');
  heading.id = `${id}-title`;
  const closeButton = button('Close', close);
  closeButton.setAttribute('aria-label', 'Close display settings');
  header.append(heading, closeButton);
  const description = create('p', 'Choose colors and markers that are easy to distinguish. Changes apply immediately and stay saved on this device.', 'display-settings-help');
  description.id = `${id}-description`;

  const fields = create('div', undefined, 'display-settings-fields');
  const palette = create('select');
  palette.setAttribute('aria-label', 'Color palette');
  palette.id = `${id}-palette`;
  palette.dataset.displaySetting = 'palette';
  for (const [value, label] of Object.entries(paletteLabels)) {
    const option = create('option', label);
    option.value = value;
    palette.append(option);
  }
  const paletteField = create('label', 'Color palette', 'display-settings-field');
  paletteField.htmlFor = palette.id;
  paletteField.append(palette);
  const toggle = (text: string, name: 'patterns' | 'outlines') => {
    const input = create('input');
    input.type = 'checkbox';
    input.id = `${id}-${name}`;
    input.dataset.displaySetting = name;
    const label = create('label', undefined, 'display-settings-toggle');
    label.htmlFor = input.id;
    label.append(input, create('span', text));
    input.addEventListener('change', () => { if (!disposed) appearance.set({ [name]: input.checked }); });
    return { input, label };
  };
  const patterns = toggle('Player shapes and patterns', 'patterns');
  const outlines = toggle('Outlines for your units, allies and enemies', 'outlines');
  palette.addEventListener('change', () => { if (!disposed) appearance.set({ palette: palette.value as PaletteId }); });
  fields.append(paletteField, patterns.label, outlines.label);

  const preview = create('figure', undefined, 'display-settings-preview');
  const caption = create('figcaption', 'Player markers (example teams)');
  const playerList = create('ul', undefined, 'display-settings-players');
  const markers: { image: SVGSVGElement; label: HTMLElement; polygon: SVGPolygonElement }[] = [];
  for (let side = 0; side < 8; side++) {
    const item = create('li', undefined, 'display-settings-player');
    item.dataset.displayPlayer = String(side);
    const image = svg('svg');
    image.setAttribute('viewBox', '0 0 64 52');
    image.setAttribute('role', 'img');
    image.setAttribute('focusable', 'false');
    const polygon = svg('polygon');
    polygon.setAttribute('stroke-linejoin', 'round');
    image.append(polygon);
    const label = create('span');
    item.append(image, label);
    playerList.append(item);
    markers.push({ image, label, polygon });
  }
  preview.append(caption, playerList);
  const footer = create('footer');
  footer.append(button('Reset display settings', () => appearance.reset()));
  dialog.append(header, description, fields, preview, footer);
  overlay.append(dialog);
  host.append(overlay);
  root.append(host);

  function refresh(settings: AppearanceSettings) {
    if (disposed) return;
    palette.value = settings.palette;
    patterns.input.checked = settings.patterns;
    outlines.input.checked = settings.outlines;
    for (let side = 0; side < markers.length; side++) {
      const style = ownershipStyle(side, 0, settings, previewTeams);
      const marker = markers[side], relation = relationLabels[style.relation];
      marker.polygon.setAttribute('points', markerPolygon(settings.patterns ? style.shape : 1, 32, 25, 16).map(point => `${point.x},${point.y}`).join(' '));
      marker.polygon.setAttribute('fill', style.css);
      marker.polygon.setAttribute('stroke', settings.outlines ? style.outlineCss : 'none');
      marker.polygon.setAttribute('stroke-width', settings.outlines ? '3' : '0');
      marker.image.setAttribute('aria-label', `Player ${side + 1}: ${relation}`);
      marker.label.replaceChildren(create('strong', `Player ${side + 1}`), create('small', relation));
    }
  }
  refresh(appearance.value);
  const unsubscribe = appearance.subscribe(refresh);

  function open() {
    if (disposed || opened) return;
    previousFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    opened = true;
    overlay.hidden = false;
    refresh(appearance.value);
    closeButton.focus();
  }
  function close() {
    if (!opened) return;
    opened = false;
    overlay.hidden = true;
    if (previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
  }
  function keyboard(event: KeyboardEvent) {
    if (!opened) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }
    if (event.key === 'Tab') {
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button,input,select,[tabindex]')).filter(element => element.tabIndex >= 0 && !element.closest('[hidden]') && !(element as HTMLButtonElement).disabled);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (doc.activeElement === first || !dialog.contains(doc.activeElement))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        (last ?? dialog).focus();
        return;
      }
      if (!event.shiftKey && (doc.activeElement === last || !dialog.contains(doc.activeElement))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        (first ?? dialog).focus();
        return;
      }
    }
    if (!(event.target instanceof Node) || !dialog.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  function keyup(event: KeyboardEvent) {
    if (opened && (!(event.target instanceof Node) || !dialog.contains(event.target))) event.stopImmediatePropagation();
  }
  function keepFocus(event: FocusEvent) {
    if (opened && (!(event.target instanceof Node) || !dialog.contains(event.target))) closeButton.focus();
  }
  const stop = (event: Event) => event.stopPropagation();
  const stopContextMenu = (event: Event) => { event.preventDefault(); event.stopPropagation(); };
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel']) host.addEventListener(type, stop);
  host.addEventListener('contextmenu', stopContextMenu);
  view.addEventListener('keydown', keyboard, true);
  view.addEventListener('keyup', keyup, true);
  view.addEventListener('focusin', keepFocus, true);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });

  return {
    open,
    close,
    isOpen: () => opened,
    dispose() {
      if (disposed) return;
      close();
      disposed = true;
      unsubscribe();
      view.removeEventListener('keydown', keyboard, true);
      view.removeEventListener('keyup', keyup, true);
      view.removeEventListener('focusin', keepFocus, true);
      host.remove();
    },
  };
}
