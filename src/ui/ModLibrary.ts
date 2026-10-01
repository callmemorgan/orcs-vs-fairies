import { MAX_CONTENT_BYTES, type ContentPackage } from '../core/content-registry';
import { exampleMod } from '../core/example-mod';
import './mod-library.css';

/** The caller validates packages and owns installation and match creation. */
export interface ModLibraryHandlers {
  installed: () => ContentPackage[];
  install: (input: unknown) => ContentPackage;
  launch: (factionId: string) => void;
  onChange?: () => void;
}

export const MOD_IMPORT_MAX_BYTES = MAX_CONTENT_BYTES;
const create = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const errorText = (error: unknown): string => error instanceof Error ? error.message : typeof error === 'string' ? error : 'The package could not be installed. Try another JSON file.';

/** Mount in a menu. Refresh after external registry changes; dispose when removing the menu. */
export function mountModLibrary(root: HTMLElement, handlers: ModLibraryHandlers) {
  let disposed = false, importing = false;
  const removers: Array<() => void> = [], cardRemovers: Array<() => void> = [];
  const host = create('details', undefined, 'mod-library');
  const summary = create('summary', 'Mod library');
  const body = create('div', undefined, 'mod-library-body');
  const notice = create('p', undefined, 'mod-library-notice');
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.hidden = true;
  const error = create('p', undefined, 'mod-library-notice mod-library-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const listen = (node: HTMLElement, type: string, callback: EventListener, cleanup = removers) => {
    node.addEventListener(type, callback);
    cleanup.push(() => node.removeEventListener(type, callback));
  };
  const button = (text: string, callback: () => void, cleanup = removers): HTMLButtonElement => {
    const node = create('button', text);
    node.type = 'button';
    listen(node, 'click', () => { if (!disposed) callback(); }, cleanup);
    return node;
  };
  const message = (text: string, failed = false) => {
    if (disposed) return;
    notice.textContent = failed ? '' : text;
    notice.hidden = failed || !text;
    error.textContent = failed ? text : '';
    error.hidden = !failed || !text;
  };

  const controls = create('div', undefined, 'mod-library-import');
  const fileInput = create('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.setAttribute('aria-label', 'Choose mod package JSON');
  const fileLabel = create('label', 'Choose mod package JSON');
  fileLabel.append(fileInput);
  const importButton = button('Import package', () => { void importFile(); });
  controls.append(fileLabel, importButton);
  const example = create('div', undefined, 'mod-library-example');
  const exampleDetails = create('div');
  exampleDetails.append(create('h3', 'Lantern Keepers example'), create('p', 'Sentinels heal nearby allies. Duelists trade armor for speed. Both fight in melee.'));
  const exampleButton = button('Install Lantern Keepers example', () => {
    if (importing) return;
    try { install(exampleMod()); }
    catch (reason) { message(errorText(reason), true); }
  });
  const exampleDownload = button('Download example JSON', () => {
    try { downloadExample(); }
    catch (reason) { message(errorText(reason), true); }
  });
  example.append(exampleDetails, exampleButton, exampleDownload);
  const heading = create('div', undefined, 'mod-library-heading');
  heading.append(create('h3', 'Installed packages'), button('Refresh packages', () => refresh()));
  const list = create('ul', undefined, 'mod-library-list');
  list.setAttribute('aria-label', 'Installed mod packages');
  body.append(create('p', 'Import a JSON package to add local factions, units and art. Packages can use the game\'s existing abilities.'), controls, example, notice, error, heading, list);
  host.append(summary, body);
  root.append(host);

  function downloadExample() {
    const pkg = exampleMod();
    const url = URL.createObjectURL(new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' }));
    const link = create('a');
    link.href = url;
    link.download = 'lantern-keepers.json';
    link.hidden = true;
    host.append(link);
    try { link.click(); message('Lantern Keepers example download started.'); }
    finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 0); }
  }

  function setImporting(value: boolean) {
    importing = value;
    fileInput.disabled = value;
    importButton.disabled = value;
    exampleButton.disabled = value;
    body.setAttribute('aria-busy', String(value));
  }

  function install(input: unknown) {
    if (disposed) return;
    const installed = handlers.install(input);
    refresh();
    handlers.onChange?.();
    message(`Installed ${installed.name} ${installed.version}.`);
  }

  async function importFile() {
    if (disposed || importing) return;
    const file = fileInput.files?.[0];
    if (!file) { message('Choose a package JSON file first.', true); fileInput.focus(); return; }
    if (file.size > MOD_IMPORT_MAX_BYTES) { message('The package is too large. Choose a JSON file smaller than 2 MiB.', true); return; }
    setImporting(true);
    message(`Reading ${file.name}…`);
    try {
      let input: unknown;
      try { input = JSON.parse(await file.text()); }
      catch (reason) { throw new Error(`Could not read package JSON: ${errorText(reason)}`); }
      if (disposed) return;
      install(input);
      fileInput.value = '';
    } catch (reason) { message(errorText(reason), true); }
    finally { if (!disposed) setImporting(false); }
  }

  function metadata(parent: HTMLElement, label: string, value: string, className?: string) {
    parent.append(create('dt', label), create('dd', value, className));
  }

  function refresh() {
    if (disposed) return;
    try {
      const packages = handlers.installed();
      for (const remove of cardRemovers.splice(0)) remove();
      const cards = packages.map(pkg => {
        const card = create('li', undefined, 'mod-library-card');
        card.dataset.modPackage = pkg.id;
        const data = create('dl');
        metadata(data, 'Package ID', pkg.id);
        metadata(data, 'Version', pkg.version);
        metadata(data, 'Content hash', pkg.hash, 'mod-library-hash');
        metadata(data, 'Dependencies', pkg.dependencies.length ? pkg.dependencies.map(dependency => `${dependency.id} ${dependency.version} (${dependency.hash})`).join(', ') : 'None');
        const factions = create('div', undefined, 'mod-library-factions');
        for (const faction of pkg.factions) {
          const launch = button(`Play ${faction.name}`, () => {
            try { handlers.launch(faction.id); }
            catch (reason) { message(errorText(reason), true); }
          }, cardRemovers);
          launch.dataset.modFaction = faction.id;
          factions.append(launch);
        }
        card.append(create('h3', pkg.name), data, factions);
        return card;
      });
      list.replaceChildren(...cards);
      if (!cards.length) list.append(create('li', 'No mod packages installed.', 'mod-library-empty'));
    } catch (reason) { message(errorText(reason), true); }
  }

  refresh();
  return {
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const remove of [...removers.splice(0), ...cardRemovers.splice(0)]) remove();
      host.remove();
    },
  };
}
