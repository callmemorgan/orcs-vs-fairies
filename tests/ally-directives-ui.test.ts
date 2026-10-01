// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Command } from '../src/core/types';
import { AllyDirectives, type AllyDirectivesView } from '../src/ui/AllyDirectives';

const mounted: AllyDirectives[] = [];
afterEach(() => { for (const panel of mounted.splice(0)) panel.destroy(); document.body.replaceChildren(); });
function view(overrides: Partial<AllyDirectivesView> = {}): AllyDirectivesView {
  return { side: 1, allies: [{ side: 0, name: 'Orc ally' }, { side: 2, name: 'Fairy ally' }], directives: [], width: 48, height: 32, enabled: true, destination: { x: 5.5, y: 7.5 }, ...overrides };
}
function setup(initial = view()) {
  const root = document.createElement('div'); document.body.append(root);
  const dispatch = vi.fn<(command: Command) => boolean>(() => true), notice = vi.fn<(text: string) => void>();
  const panel = new AllyDirectives(root, dispatch, notice); mounted.push(panel); panel.update(initial);
  return { root, panel, dispatch, notice };
}
function field<T extends HTMLInputElement | HTMLSelectElement = HTMLInputElement>(root: ParentNode, label: string): T {
  const control = Array.from(root.querySelectorAll<T>('input,select')).find(node => node.getAttribute('aria-label') === label);
  expect(control, `Missing ${label}`).toBeDefined(); return control!;
}
function button(root: ParentNode, label: string): HTMLButtonElement {
  const result = Array.from(root.querySelectorAll('button')).find(node => node.textContent === label);
  expect(result, `Missing ${label}`).toBeDefined(); return result!;
}
function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
  control.value = value; control.dispatchEvent(new Event('input', { bubbles: true })); control.dispatchEvent(new Event('change', { bubbles: true }));
}
function submit(root: ParentNode) { button(root, 'Send request').click(); }
function request(root: ParentNode, kind: string) { change(field<HTMLSelectElement>(root, 'Ally request'), kind); }
function record(id: number, status: AllyDirectivesView['directives'][number]['status'], issuer: 0 | 1 = 1) {
  return { id, issuer, recipient: 0 as const, kind: 'defend' as const, status };
}

describe('allied AI directive panel', () => {
  it('offers labelled native controls and sends each destination request to recipient zero', () => {
    const { root, dispatch, notice } = setup();
    expect(root.querySelector('section')!.getAttribute('aria-label')).toBe('Allied AI requests');
    expect(root.querySelector('section')!.hidden).toBe(false);
    for (const control of Array.from(root.querySelectorAll('input,select'))) expect(control.closest('label')).not.toBeNull();
    expect(field<HTMLSelectElement>(root, 'Allied AI recipient').value).toBe('0');
    expect(field(root, 'Destination X').value).toBe('5.5');
    for (const directive of ['defend', 'scout', 'attack']) {
      request(root, directive); change(field(root, 'Destination X'), '0'); change(field(root, 'Destination Y'), '12.25'); submit(root);
      expect(dispatch).toHaveBeenLastCalledWith({ type: 'allyDirective', ally: 0, directive, x: 0, y: 12.25 });
    }
    expect(dispatch).toHaveBeenCalledTimes(3); expect(notice).toHaveBeenLastCalledWith('Ally request sent. Check its status below.');
    expect(root.querySelector('[role="status"]')!.textContent).toBe(notice.mock.lastCall![0]);
    expect(root.querySelectorAll('[data-directive-id]')).toHaveLength(0);
  });

  it('requests resource support without requiring a destination', () => {
    const { root, dispatch } = setup(view({ destination: undefined })); request(root, 'support');
    change(field<HTMLSelectElement>(root, 'Allied AI recipient'), '2');
    change(field(root, 'Wood requested'), '100'); change(field(root, 'Ore requested'), '25'); change(field(root, 'Crystal requested'), '3'); submit(root);
    expect(dispatch).toHaveBeenCalledWith({ type: 'allyDirective', ally: 2, directive: 'support', resources: { wood: 100, ore: 25, crystal: 3 } });
    expect(field(root, 'Destination X').disabled).toBe(true); expect(field(root, 'Wood requested').disabled).toBe(false);
    request(root, 'scout'); expect(field(root, 'Wood requested').disabled).toBe(true);
  });

  it('preserves recipient, request, edited destinations, resource drafts and focus across updates', () => {
    const { root, panel, dispatch } = setup();
    const x = field(root, 'Destination X'), recipient = field<HTMLSelectElement>(root, 'Allied AI recipient');
    change(recipient, '2'); change(x, '20.125'); change(field(root, 'Destination Y'), '18');
    request(root, 'support'); change(field(root, 'Wood requested'), '85'); request(root, 'attack'); x.focus();
    for (let frame = 0; frame < 4; frame++) panel.update(view({ destination: { x: 6 + frame, y: 8 + frame }, directives: [record(9, 'active')] }));
    expect(field(root, 'Destination X')).toBe(x); expect(document.activeElement).toBe(x);
    expect(recipient.value).toBe('2'); expect(field<HTMLSelectElement>(root, 'Ally request').value).toBe('attack');
    expect(x.value).toBe('20.125'); expect(field(root, 'Destination Y').value).toBe('18'); expect(field(root, 'Wood requested').value).toBe('85');
    submit(root); expect(dispatch).toHaveBeenLastCalledWith({ type: 'allyDirective', ally: 2, directive: 'attack', x: 20.125, y: 18 });
    panel.update(view({ allies: [{ side: 0, name: 'Renamed ally' }] }));
    expect(recipient.value).toBe('0'); submit(root); expect(dispatch).toHaveBeenLastCalledWith({ type: 'allyDirective', ally: 0, directive: 'attack', x: 20.125, y: 18 });
  });

  it('can replace a typed destination with the selected unit position', () => {
    const { root, panel, dispatch } = setup(); change(field(root, 'Destination X'), '20');
    panel.update(view({ destination: { x: 10.25, y: 11.125 } })); button(root, 'Use selected unit position').click();
    panel.update(view({ destination: { x: 11, y: 12 } }));
    submit(root); expect(dispatch).toHaveBeenLastCalledWith({ type: 'allyDirective', ally: 0, directive: 'defend', x: 10.25, y: 11.125 });
    panel.update(view({ destination: undefined })); expect(button(root, 'Use selected unit position').disabled).toBe(true);
  });

  it('blocks disabled and hidden-panel requests, including synthetic submit and cancellation', () => {
    const { root, panel, dispatch, notice } = setup(view({ directives: [record(8, 'accepted')] }));
    const form = root.querySelector('form')!, cancel = button(root, 'Cancel');
    panel.update(view({ enabled: false, directives: [record(8, 'active')] }));
    for (const control of Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input,select,button'))) expect(control.disabled).toBe(true);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); cancel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    panel.update(view({ allies: [] })); expect(root.querySelector('section')!.hidden).toBe(true);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(dispatch).not.toHaveBeenCalled(); expect(notice).not.toHaveBeenCalled();
    panel.update(view()); submit(root); expect(dispatch).toHaveBeenCalledTimes(1);
    panel.update(view({ allies: [{ side: 1, name: 'You' }] })); expect(root.querySelector('section')!.hidden).toBe(true);
  });

  it('shows supplied status changes and allows only the issuer to cancel accepted or active requests', () => {
    const { root, panel, dispatch } = setup(view({ directives: [record(1, 'accepted'), record(2, 'active', 0), record(3, 'completed'), record(4, 'failed'), record(5, 'cancelled')] }));
    const own = root.querySelector<HTMLButtonElement>('[data-cancel-directive="1"]')!;
    for (const id of [2, 3, 4, 5]) expect(root.querySelector<HTMLButtonElement>(`[data-cancel-directive="${id}"]`)!.hidden).toBe(true);
    own.click(); expect(dispatch).toHaveBeenLastCalledWith({ type: 'cancelAllyDirective', directiveId: 1 });
    expect(root.querySelector('[data-directive-id="1"]')!.textContent).toContain('Accepted');
    panel.update(view({ directives: [record(1, 'active')] })); expect(root.querySelector('[data-directive-id="1"]')!.textContent).toContain('Active');
    expect(root.querySelector('[data-cancel-directive="1"]')).toBe(own); own.click(); expect(dispatch).toHaveBeenCalledTimes(2);
    panel.update(view({ directives: [record(1, 'completed')] })); expect(own.hidden).toBe(true);
    own.dispatchEvent(new MouseEvent('click', { bubbles: true })); expect(dispatch).toHaveBeenCalledTimes(2);
    panel.update(view({ side: 0, allies: [{ side: 1, name: 'Other ally' }], directives: [record(1, 'active')] }));
    own.dispatchEvent(new MouseEvent('click', { bubbles: true })); expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('rejects blank, nonfinite and out-of-map destinations before dispatch', () => {
    const { root, dispatch, notice } = setup();
    for (const value of ['', 'Infinity', '-1', '48']) { change(field(root, 'Destination X'), value); submit(root); }
    change(field(root, 'Destination X'), '1'); change(field(root, 'Destination Y'), '32'); submit(root);
    expect(dispatch).not.toHaveBeenCalled(); expect(notice).toHaveBeenLastCalledWith('Enter an X and Y destination inside the map.');
  });

  it('rejects invalid resource quantities and reports dispatch failures without changing statuses', () => {
    const { root, dispatch, notice } = setup(); request(root, 'support');
    for (const value of ['0', '', '-1', '1.5', 'Infinity']) { change(field(root, 'Wood requested'), value); submit(root); }
    expect(dispatch).not.toHaveBeenCalled(); expect(notice).toHaveBeenLastCalledWith('Request a positive whole amount of at least one resource.');
    change(field(root, 'Wood requested'), '50'); dispatch.mockReturnValue(false); submit(root);
    expect(notice).toHaveBeenLastCalledWith('The ally request could not be sent.'); expect(root.querySelectorAll('[data-directive-id]')).toHaveLength(0);
    dispatch.mockImplementation(() => { throw new Error('Unavailable'); }); submit(root); expect(notice).toHaveBeenLastCalledWith('The ally request could not be sent.');
  });

  it('renders ally names and supplied status data as text', () => {
    const malicious = '<img src=x onerror=alert(1)>', directive = { ...record(8, 'accepted'), status: malicious } as unknown as AllyDirectivesView['directives'][number];
    const { root } = setup(view({ allies: [{ side: 0, name: malicious }], directives: [directive] }));
    expect(field<HTMLSelectElement>(root, 'Allied AI recipient').selectedOptions[0].textContent).toBe(malicious);
    expect(root.querySelector('[data-directive-id]')!.textContent).toContain(malicious); expect(root.querySelectorAll('img,script')).toHaveLength(0);
  });

  it('keeps panel keyboard and pointer events away from gameplay without blocking native defaults', () => {
    const { root, dispatch } = setup(), gameplay = vi.fn(), local = vi.fn();
    const send = button(root, 'Send request'); send.addEventListener('keydown', local);
    for (const type of ['keydown', 'keyup', 'pointerdown', 'click', 'wheel']) window.addEventListener(type, gameplay);
    try {
      const key = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }); send.dispatchEvent(key);
      send.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true })); send.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      send.dispatchEvent(new WheelEvent('wheel', { bubbles: true })); submit(root);
      expect(local).toHaveBeenCalledTimes(1); expect(key.defaultPrevented).toBe(false); expect(gameplay).not.toHaveBeenCalled(); expect(dispatch).toHaveBeenCalledTimes(1);
    } finally { for (const type of ['keydown', 'keyup', 'pointerdown', 'click', 'wheel']) window.removeEventListener(type, gameplay); }
  });

  it('destroys only its own panel and blocks retained events after destruction', () => {
    const { root, panel, dispatch, notice } = setup(); const sibling = document.createElement('p'); root.append(sibling);
    const form = root.querySelector('form')!; panel.destroy(); panel.destroy(); panel.update(view());
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); expect(root.contains(sibling)).toBe(true);
    expect(root.querySelector('section')).toBeNull(); expect(dispatch).not.toHaveBeenCalled(); expect(notice).not.toHaveBeenCalled();
  });
});
