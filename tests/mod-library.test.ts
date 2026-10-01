// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentLibrary, contentHash, decodeContentPackage, type ContentPackage } from '../src/core/content-registry';
import { MOD_IMPORT_MAX_BYTES, mountModLibrary } from '../src/ui/ModLibrary';

const mounted: Array<ReturnType<typeof mountModLibrary>> = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function fixture(): ContentPackage {
  const body = {
    format: 'orcs-vs-fairies-mod', schemaVersion: 1, engineVersion: 3,
    id: 'lantern', version: '1.0.0', name: 'Lantern Keepers', dependencies: [], art: {},
    factions: [{
      id: 'lantern:keepers', baseFaction: 'fairies', name: 'Lantern Keepers', subtitle: 'Keep the light',
      description: 'A custom woodland faction.', color: 0x70d8bd, accent: '#a1e1c6',
      units: [], buildings: [], research: [],
    }],
  };
  return decodeContentPackage({ ...body, hash: contentHash(body) });
}
function setup(initial: ContentPackage[] = []) {
  const library = new ContentLibrary();
  library.restore(initial);
  const handlers = {
    installed: vi.fn(() => library.list()),
    install: vi.fn((value: unknown) => library.install(value)),
    launch: vi.fn(), onChange: vi.fn(),
  };
  const root = document.createElement('div');
  document.body.append(root);
  const view = mountModLibrary(root, handlers);
  mounted.push(view);
  return { root, view, handlers, library };
}
function button(root: ParentNode, text: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent === text);
  expect(found).toBeDefined();
  return found!;
}
function chooseFile(root: ParentNode, text: string, read = () => Promise.resolve(text)): File {
  const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File([text], 'package.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: vi.fn(read) });
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  return file;
}

describe('mod library', () => {
  it('labels the native import controls and shows the installed version, hash, dependencies and launch button', () => {
    const pkg = fixture(), dependencyHash = 'b'.repeat(64);
    const { root, view, handlers } = setup([pkg]);
    expect(root.querySelector('summary')!.textContent).toBe('Mod library');
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.getAttribute('aria-label')).toBe('Choose mod package JSON');
    expect(input.accept).toContain('application/json');
    expect(input.closest('label')!.textContent).toContain('Choose mod package JSON');
    handlers.installed.mockReturnValue([{ ...pkg, dependencies: [{ id: 'grove', version: '2.3.0', hash: dependencyHash }] }]);
    view.refresh();
    const card = root.querySelector<HTMLElement>('[data-mod-package="lantern"]')!;
    for (const text of ['lantern', '1.0.0', pkg.hash, 'grove 2.3.0', dependencyHash]) expect(card.textContent).toContain(text);
    button(root, 'Play Lantern Keepers').click();
    expect(handlers.launch).toHaveBeenCalledWith('lantern:keepers');
    expect(handlers.install).not.toHaveBeenCalled();
    expect(handlers.onChange).not.toHaveBeenCalled();
  });

  it('imports a real JSON file through the caller validator and refreshes the installed faction', async () => {
    const pkg = fixture(), { root, handlers, library } = setup();
    expect(root.textContent).toContain('No mod packages installed.');
    chooseFile(root, JSON.stringify(pkg));
    button(root, 'Import package').click();
    await vi.waitFor(() => expect(handlers.install).toHaveBeenCalledWith(pkg));
    expect(library.list()).toEqual([pkg]);
    expect(handlers.onChange).toHaveBeenCalledOnce();
    expect(root.querySelector('[role="status"]')!.textContent).toBe('Installed Lantern Keepers 1.0.0.');
    expect(root.querySelector<HTMLElement>('[role="alert"]')!.hidden).toBe(true);
    expect(button(root, 'Import package').disabled).toBe(false);
    button(root, 'Play Lantern Keepers').click();
    expect(handlers.launch).toHaveBeenCalledWith('lantern:keepers');
  });

  it('installs the bundled example through the same caller', () => {
    const { root, handlers, library } = setup();
    button(root, 'Install Lantern Keepers example').click();
    expect(handlers.install).toHaveBeenCalledOnce();
    const pkg = library.list()[0];
    expect(pkg.id).toBe('lantern');
    expect(pkg.factions[0].id).toBe('lantern:keepers');
    expect(pkg.factions[0].units.map(unit => unit.id)).toEqual(['lantern:sentinel', 'lantern:duelist']);
    expect(pkg.factions[0].units.map(unit => unit.role)).toEqual(['melee', 'melee']);
    expect(pkg.factions[0].units[0].ability).toBe('heal');
    expect(new Set(Object.values(pkg.art).map(art => art.path)).size).toBeGreaterThanOrEqual(2);
    expect(handlers.onChange).toHaveBeenCalledOnce();
    expect(button(root, 'Play Lantern Keepers')).toBeDefined();
  });

  it('downloads the complete admitted example as JSON with embedded art and a valid hash', async () => {
    const { root, handlers } = setup();
    let downloaded: Blob | undefined, filename = '', href = '';
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { downloaded = blob as Blob; return 'blob:lantern-example'; });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; href = this.href; });
    button(root, 'Download example JSON').click();
    expect(filename).toBe('lantern-keepers.json');
    expect(href).toBe('blob:lantern-example');
    expect(downloaded!.type).toBe('application/json');
    const pkg = decodeContentPackage(JSON.parse(await downloaded!.text()));
    expect(pkg.id).toBe('lantern');
    expect(pkg.art['lantern:sentinel'].svg).toContain('<svg');
    expect(pkg.art['lantern:duelist'].svg).toContain('<svg');
    expect(handlers.install).not.toHaveBeenCalled();
    expect(root.querySelector('a[download]')).toBeNull();
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:lantern-example'));
  });

  it('shows a missing file and malformed JSON without calling installation or changing installed packages', async () => {
    const pkg = fixture(), { root, handlers, library } = setup([pkg]);
    button(root, 'Import package').click();
    expect(root.querySelector('[role="alert"]')!.textContent).toBe('Choose a package JSON file first.');
    expect(document.activeElement).toBe(root.querySelector('input'));
    chooseFile(root, '{broken');
    button(root, 'Import package').click();
    await vi.waitFor(() => expect(root.querySelector('[role="alert"]')!.textContent).toContain('Could not read package JSON:'));
    expect(handlers.install).not.toHaveBeenCalled();
    expect(handlers.onChange).not.toHaveBeenCalled();
    expect(library.list()).toEqual([pkg]);
    expect(button(root, 'Play Lantern Keepers')).toBeDefined();
  });

  it('shows caller validation errors and allows a corrected import through the real validator', async () => {
    const pkg = fixture(), { root, handlers, library } = setup([pkg]);
    chooseFile(root, JSON.stringify({ ...pkg, hash: 'a'.repeat(64) }));
    button(root, 'Import package').click();
    await vi.waitFor(() => expect(root.querySelector('[role="alert"]')!.textContent).toContain('SHA-256 does not match'));
    expect(library.list()).toEqual([pkg]);
    expect(handlers.onChange).not.toHaveBeenCalled();
    expect(button(root, 'Import package').disabled).toBe(false);
    chooseFile(root, JSON.stringify(pkg));
    button(root, 'Import package').click();
    await vi.waitFor(() => expect(handlers.onChange).toHaveBeenCalledOnce());
    expect(root.querySelector<HTMLElement>('[role="alert"]')!.hidden).toBe(true);
  });

  it('rejects oversized files before reading and blocks duplicate actions during a pending read', async () => {
    const { root, handlers } = setup();
    const oversized = chooseFile(root, '{}');
    Object.defineProperty(oversized, 'size', { value: MOD_IMPORT_MAX_BYTES + 1 });
    button(root, 'Import package').click();
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('smaller than 2 MiB');
    expect(oversized.text).not.toHaveBeenCalled();
    let resolve!: (text: string) => void;
    const file = chooseFile(root, '{}', () => new Promise(done => { resolve = done; }));
    button(root, 'Import package').click();
    expect(button(root, 'Import package').disabled).toBe(true);
    expect(button(root, 'Install Lantern Keepers example').disabled).toBe(true);
    button(root, 'Import package').click();
    button(root, 'Install Lantern Keepers example').click();
    expect(file.text).toHaveBeenCalledOnce();
    expect(handlers.install).not.toHaveBeenCalled();
    resolve(JSON.stringify(fixture()));
    await vi.waitFor(() => expect(handlers.install).toHaveBeenCalledOnce());
    expect(root.querySelector('.mod-library-body')!.getAttribute('aria-busy')).toBe('false');
  });

  it('renders package, faction, dependency and error text without interpreting HTML', () => {
    const pkg = fixture(), markup = '<img src=x onerror=alert(1)>', { root, view, handlers } = setup();
    handlers.installed.mockReturnValue([{ ...pkg, name: markup, dependencies: [{ id: markup, version: markup, hash: markup }], factions: [{ ...pkg.factions[0], name: markup }] }]);
    view.refresh();
    expect(root.textContent).toContain(markup);
    expect(root.querySelector('img')).toBeNull();
    handlers.launch.mockImplementation(() => { throw new Error(markup); });
    button(root, `Play ${markup}`).click();
    expect(root.querySelector('[role="alert"]')!.textContent).toBe(markup);
    expect(root.querySelector('[role="alert"] img')).toBeNull();
  });

  it('removes old launch callbacks on refresh and all controls and pending imports on disposal', async () => {
    const { root, view, handlers } = setup([fixture()]);
    const oldLaunch = button(root, 'Play Lantern Keepers');
    view.refresh();
    oldLaunch.click();
    expect(handlers.launch).not.toHaveBeenCalled();
    const currentLaunch = button(root, 'Play Lantern Keepers'), example = button(root, 'Install Lantern Keepers example');
    let resolve!: (text: string) => void;
    chooseFile(root, '{}', () => new Promise(done => { resolve = done; }));
    button(root, 'Import package').click();
    view.dispose();
    view.dispose();
    currentLaunch.click();
    example.click();
    resolve(JSON.stringify(fixture()));
    await new Promise(done => setTimeout(done, 0));
    expect(handlers.install).not.toHaveBeenCalled();
    expect(handlers.launch).not.toHaveBeenCalled();
    expect(handlers.onChange).not.toHaveBeenCalled();
    expect(root.children).toHaveLength(0);
    view.refresh();
    expect(root.children).toHaveLength(0);
  });
});
