// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditorMap, makeMapPackage } from '../src/editor/map-package';
import { mountEditorTools } from '../src/ui/EditorTools';

const mounted: ReturnType<typeof mountEditorTools>[] = [];
beforeEach(() => {
  const context = new Proxy({}, { get: () => () => {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as CanvasRenderingContext2D);
});
afterEach(() => { mounted.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); localStorage.clear(); vi.restoreAllMocks(); });
function setup() {
  const root = document.createElement('main'), toolbar = document.createElement('nav'); document.body.append(root, toolbar);
  const visibility = vi.fn(), blocked = vi.fn(() => false);
  const editor = mountEditorTools(root, { toolbar, blocked, onOpen: visibility, playMap: vi.fn() }); mounted.push(editor); editor.open();
  return { root, toolbar, visibility, blocked, editor };
}
function upload(root: HTMLElement, read: () => Promise<string>) {
  const input = root.querySelector<HTMLInputElement>('[aria-label="Import map package"]')!, file = new File(['{}'], 'map.json', { type: 'application/json' });
  vi.spyOn(file, 'text').mockImplementation(read);
  const data = new DataTransfer(); data.items.add(file); input.files = data.files; input.dispatchEvent(new Event('change'));
}
const fixture = (seed: number) => makeMapPackage({ id: `map-${seed}`, title: `Map ${seed}`, author: 'Test', revision: 1 }, createEditorMap(seed, 'small'));

describe('native map editor import ownership', () => {
  it('keeps a new map created while an old file read is pending', async () => {
    const { root, editor } = setup(); let finish!: (value: string) => void;
    upload(root, () => new Promise(resolve => { finish = resolve; }));
    root.querySelector<HTMLInputElement>('[aria-label="New map seed"]')!.value = '87';
    [...root.querySelectorAll('button')].find(button => button.textContent === 'Create new map')!.click();
    finish(JSON.stringify(fixture(4127))); await Promise.resolve(); await Promise.resolve();
    expect(editor.getMap().map.seed).toBe(87);
  });

  it('keeps the later requested file when reads finish in reverse order', async () => {
    const { root, editor } = setup(); let finish!: (value: string) => void;
    upload(root, () => new Promise(resolve => { finish = resolve; }));
    upload(root, async () => JSON.stringify(fixture(91)));
    await vi.waitFor(() => expect(editor.getMap().map.seed).toBe(91));
    finish(JSON.stringify(fixture(4127))); await Promise.resolve(); await Promise.resolve();
    expect(editor.getMap().map.seed).toBe(91);
  });

  it('cancels a pending file read when the dialog closes', async () => {
    const { root, editor } = setup(); let finish!: (value: string) => void;
    upload(root, () => new Promise(resolve => { finish = resolve; })); editor.close();
    finish(JSON.stringify(fixture(92))); await Promise.resolve(); await Promise.resolve();
    expect(editor.getMap().map.seed).toBe(4127);
  });

  it('uses the shared launcher, obeys the host block and removes moved controls', () => {
    const { root, toolbar, editor, blocked, visibility } = setup(); editor.close(); visibility.mockClear(); blocked.mockReturnValue(true);
    toolbar.querySelector<HTMLButtonElement>('.editor-entry')!.click(); expect(root.querySelector<HTMLElement>('.editor-overlay')!.hidden).toBe(true); expect(visibility).not.toHaveBeenCalled();
    blocked.mockReturnValue(false); toolbar.querySelector<HTMLButtonElement>('.editor-entry')!.click(); expect(root.querySelector<HTMLElement>('.editor-overlay')!.hidden).toBe(false);
    editor.destroy(); expect(toolbar.querySelector('.editor-entry')).toBeNull();
  });
});
