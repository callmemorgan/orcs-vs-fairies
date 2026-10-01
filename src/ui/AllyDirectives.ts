import type { Command, Cost, Side, Vec } from '../core/types';

type DirectiveKind = 'defend' | 'scout' | 'attack' | 'support';
type DirectiveStatus = 'accepted' | 'active' | 'completed' | 'failed' | 'cancelled';
export interface AllyDirectivesView {
  side: Side;
  allies: readonly { side: Side; name: string }[];
  directives: readonly { id: number; issuer: Side; recipient: Side; kind: DirectiveKind; status: DirectiveStatus }[];
  width: number;
  height: number;
  enabled: boolean;
  destination?: Vec;
  levels?:readonly {id:number;name:string}[];
}
interface DirectiveRow { host: HTMLLIElement; text: HTMLElement; cancel: HTMLButtonElement }
const kinds: Record<DirectiveKind, string> = { defend: 'Defend', scout: 'Scout', attack: 'Attack', support: 'Resource support' };
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function field(parent: HTMLElement, title: string, control: HTMLElement) {
  const label = element('label', title); control.setAttribute('aria-label', title); label.append(control); parent.append(label);
}

/** Requests are sent through commands; only the supplied view reports their outcome. */
export class AllyDirectives {
  private readonly host: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly recipient: HTMLSelectElement;
  private readonly kind: HTMLSelectElement;
  private readonly destination: HTMLFieldSetElement;
  private readonly x: HTMLInputElement;
  private readonly y: HTMLInputElement;
  private readonly level:HTMLSelectElement;
  private readonly useSelection: HTMLButtonElement;
  private readonly bounds: HTMLElement;
  private readonly support: HTMLFieldSetElement;
  private readonly resources: Record<keyof Cost, HTMLInputElement>;
  private readonly send: HTMLButtonElement;
  private readonly feedback: HTMLElement;
  private readonly unavailable: HTMLElement;
  private readonly list: HTMLUListElement;
  private readonly empty: HTMLElement;
  private readonly rows = new Map<number, DirectiveRow>();
  private readonly removeListeners: Array<() => void> = [];
  private view?: AllyDirectivesView;
  private positionEdited = false;
  private destroyed = false;

  constructor(root: HTMLElement, private readonly dispatch: (command: Command) => boolean, private readonly notice: (text: string) => void) {
    this.host = element('section', undefined, 'ally-directives'); this.host.setAttribute('aria-label', 'Allied AI requests'); this.host.hidden = true;
    this.host.append(element('h3', 'Ally requests'), element('p', 'Ask an allied computer to defend, scout, attack, or send resources. Check the request status to see what happens.'));
    this.form = element('form', undefined, 'ally-directives-controls'); this.form.noValidate = true;
    this.recipient = element('select'); field(this.form, 'Allied AI recipient', this.recipient);
    this.kind = element('select');
    for (const [value, title] of Object.entries(kinds)) { const option = element('option', title); option.value = value; this.kind.append(option); }
    field(this.form, 'Ally request', this.kind);
    this.destination = element('fieldset', undefined, 'ally-directives-destination'); this.destination.append(element('legend', 'Destination'));
    this.x = this.numberInput('any', ''); this.y = this.numberInput('any', '');
    field(this.destination, 'Destination X', this.x); field(this.destination, 'Destination Y', this.y);
    this.level=element('select');field(this.destination,'Destination level',this.level);
    this.useSelection = element('button', 'Use selected unit position'); this.useSelection.type = 'button';
    this.bounds = element('p', undefined, 'ally-directives-bounds'); this.destination.append(this.useSelection, this.bounds);
    this.support = element('fieldset', undefined, 'ally-directives-support'); this.support.append(element('legend', 'Resources requested'));
    this.resources = { wood: this.numberInput('1', '0'), ore: this.numberInput('1', '0'), crystal: this.numberInput('1', '0') };
    for (const resource of ['wood', 'ore', 'crystal'] as const) field(this.support, `${resource[0].toUpperCase()}${resource.slice(1)} requested`, this.resources[resource]);
    this.send = element('button', 'Send request'); this.send.type = 'submit';
    this.form.append(this.destination, this.support, this.send);
    this.unavailable = element('p', 'Ally requests are unavailable right now.', 'ally-directives-unavailable');
    this.feedback = element('p', undefined, 'ally-directives-notice'); this.feedback.setAttribute('role', 'status'); this.feedback.setAttribute('aria-live', 'polite');
    this.empty = element('p', 'No ally requests yet.');
    this.list = element('ul', undefined, 'ally-directives-list'); this.list.setAttribute('aria-label', 'Ally request statuses'); this.list.setAttribute('aria-live', 'polite');
    this.host.append(this.form, this.unavailable, this.feedback, this.empty, this.list); root.append(this.host);
    this.listen(this.form, 'submit', event => { event.preventDefault(); this.submit(); });
    this.listen(this.kind, 'change', () => this.syncControls());
    for (const input of [this.x, this.y,this.level]) this.listen(input, 'input', () => { this.positionEdited = true; });
    this.listen(this.useSelection, 'click', () => {
      if (!this.canAct() || !this.validPosition(this.view?.destination)) return;
      this.setPosition(this.view!.destination!); this.positionEdited = true;
    });
    this.listen(this.list, 'click', event => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-cancel-directive]') : null;
      if (button && this.list.contains(button)) this.cancel(Number(button.dataset.cancelDirective));
    });
    for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel']) this.listen(this.host, type, event => event.stopPropagation());
    this.syncControls();
  }

  update(view: AllyDirectivesView): void {
    if (this.destroyed) return;
    const seen = new Set<Side>();
    const allies = view.allies.filter(ally => {
      if (ally.side === view.side || seen.has(ally.side)) return false;
      seen.add(ally.side); return true;
    }).map(ally => ({ ...ally }));
    this.view = { ...view, allies, directives: view.directives.map(directive => ({ ...directive })), ...(view.destination ? { destination: { ...view.destination } } : {}) };
    const chosen = this.recipient.value;
    const options = Array.from(this.recipient.options);
    if (options.length !== allies.length || allies.some((ally, index) => options[index].value !== String(ally.side) || options[index].textContent !== ally.name)) {
      this.recipient.replaceChildren(...allies.map(ally => { const option = element('option', ally.name); option.value = String(ally.side); return option; }));
    }
    this.recipient.value = allies.some(ally => String(ally.side) === chosen) ? chosen : allies.length ? String(allies[0].side) : '';
    this.host.hidden = allies.length === 0;
    this.bounds.textContent = `X must be at least 0 and less than ${view.width}. Y must be at least 0 and less than ${view.height}.`;
    this.x.max = String(view.width); this.y.max = String(view.height);
    const levels=view.levels??[{id:0,name:"Surface"}],oldLevel=this.level.value;
    if(this.level.dataset.signature!==JSON.stringify(levels)){this.level.dataset.signature=JSON.stringify(levels);this.level.replaceChildren(...levels.map(l=>{const o=element("option",l.name);o.value=String(l.id);return o;}));if(levels.some(l=>String(l.id)===oldLevel))this.level.value=oldLevel;}
    if (!this.positionEdited && this.validPosition(view.destination)) this.setPosition(view.destination!);
    this.syncControls(); this.renderDirectives();
  }

  destroy(): void {
    if (this.destroyed) return; this.destroyed = true;
    for (const remove of this.removeListeners.splice(0)) remove();
    this.rows.clear(); this.host.remove();
  }

  private numberInput(step: string, value: string): HTMLInputElement {
    const input = element('input'); input.type = 'number'; input.min = '0'; input.step = step; input.value = value; input.required = true; return input;
  }
  private listen(target: HTMLElement, type: string, listener: (event: Event) => void): void {
    target.addEventListener(type, listener); this.removeListeners.push(() => target.removeEventListener(type, listener));
  }
  private canAct(): boolean { return !this.destroyed && !!this.view?.enabled && this.view.allies.length > 0; }
  private validPosition(position?: Vec): boolean {
    return !!position && !!this.view && Number.isFinite(position.x) && Number.isFinite(position.y) && position.x >= 0 && position.y >= 0 && position.x < this.view.width && position.y < this.view.height && (this.view.levels??[{id:0}]).some(l=>l.id===(position.level??0));
  }
  private setPosition(position: Vec): void { this.x.value = String(position.x); this.y.value = String(position.y); this.level.value=String(position.level??0); }
  private syncControls(): void {
    const enabled = this.canAct(), support = this.kind.value === 'support';
    this.recipient.disabled = !enabled; this.kind.disabled = !enabled; this.send.disabled = !enabled;
    this.destination.hidden = support; this.support.hidden = !support;
    for (const input of [this.x, this.y,this.level]) input.disabled = !enabled || support;
    for (const input of Object.values(this.resources)) input.disabled = !enabled || !support;
    this.useSelection.disabled = !enabled || support || !this.validPosition(this.view?.destination);
    this.unavailable.hidden = !!this.view?.enabled;
  }
  private message(text: string): void { this.feedback.textContent = text; this.notice(text); }
  private submit(): void {
    if (!this.canAct()) return;
    const ally = this.view!.allies.find(candidate => String(candidate.side) === this.recipient.value);
    const directive = this.kind.value;
    if (!ally || !Object.hasOwn(kinds, directive)) { this.message('Choose an allied AI and a request.'); return; }
    let command: Command;
    if (directive === 'support') {
      const amount = (input: HTMLInputElement) => input.value.trim() ? Number(input.value) : NaN;
      const resources: Cost = { wood: amount(this.resources.wood), ore: amount(this.resources.ore), crystal: amount(this.resources.crystal) };
      if (Object.values(resources).some(amount => !Number.isSafeInteger(amount) || amount < 0) || !Object.values(resources).some(amount => amount > 0)) { this.message('Request a positive whole amount of at least one resource.'); return; }
      command = { type: 'allyDirective', ally: ally.side, directive, resources };
    } else {
      const position = { ...(Number(this.level.value)===0?{}:{level:Number(this.level.value)}),x: this.x.value.trim() ? Number(this.x.value) : NaN, y: this.y.value.trim() ? Number(this.y.value) : NaN };
      if (!this.validPosition(position)) { this.message('Enter an X and Y destination inside the map.'); return; }
      command = { type: 'allyDirective', ally: ally.side, directive: directive as Exclude<DirectiveKind, 'support'>, ...position };
    }
    this.sendCommand(command, 'Ally request sent. Check its status below.', 'The ally request could not be sent.');
  }
  private cancellable(directive: AllyDirectivesView['directives'][number]): boolean {
    return directive.issuer === this.view?.side && (directive.status === 'accepted' || directive.status === 'active');
  }
  private cancel(id: number): void {
    if (!this.canAct()) return;
    const directive = this.view!.directives.find(candidate => candidate.id === id);
    if (!directive || !this.cancellable(directive)) return;
    this.sendCommand({ type: 'cancelAllyDirective', directiveId: id }, 'Cancellation sent. Check the request status below.', 'The ally request could not be cancelled.');
  }
  private sendCommand(command: Command, success: string, failure: string): void {
    let accepted = false; try { accepted = this.dispatch(command); } catch { /* A rejected command leaves the supplied status unchanged. */ }
    this.message(accepted ? success : failure);
  }
  private renderDirectives(): void {
    const view = this.view!;
    for (const [id, row] of this.rows) if (!view.directives.some(directive => directive.id === id)) { row.host.remove(); this.rows.delete(id); }
    for (const directive of view.directives) {
      let row = this.rows.get(directive.id);
      if (!row) {
        const host = element('li'); host.dataset.directiveId = String(directive.id);
        const text = element('span'), cancel = element('button', 'Cancel'); cancel.type = 'button'; cancel.dataset.cancelDirective = String(directive.id);
        host.append(text, cancel); row = { host, text, cancel }; this.rows.set(directive.id, row); this.list.append(host);
      }
      const name = view.allies.find(ally => ally.side === directive.recipient)?.name ?? `Player ${directive.recipient + 1}`;
      const issuer = directive.issuer === view.side ? 'You' : view.allies.find(ally => ally.side === directive.issuer)?.name ?? `Player ${directive.issuer + 1}`;
      const status = `${directive.status[0].toUpperCase()}${directive.status.slice(1)}`;
      const text = `${issuer}: ${kinds[directive.kind] ?? directive.kind} request to ${name} · ${status}`;
      if (row.text.textContent !== text) row.text.textContent = text;
      row.cancel.setAttribute('aria-label', `Cancel ${kinds[directive.kind] ?? directive.kind} request ${directive.id} to ${name}`);
      row.cancel.hidden = !this.cancellable(directive); row.cancel.disabled = !this.canAct() || !this.cancellable(directive);
    }
    this.empty.hidden = view.directives.length > 0;
  }
}
