export interface EditorHistoryEntry<T> { label: string; value: T }

/** Each edit owns a complete snapshot. A failed edit/import cannot alter history. */
export class EditorDocument<T> {
  private current: T;
  private undoEntries: EditorHistoryEntry<T>[] = [];
  private redoEntries: EditorHistoryEntry<T>[] = [];
  private pending?: EditorHistoryEntry<T>;

  constructor(value: T, private readonly validate: (value: unknown) => T, readonly limit = 80) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 256) throw new Error('Editor history limit must be 1 through 256.');
    this.current = structuredClone(validate(value));
  }
  get value(): Readonly<T> { return this.current; }
  get canUndo(): boolean { return this.undoEntries.length > 0; }
  get canRedo(): boolean { return this.redoEntries.length > 0; }
  get undoLabel(): string { return this.undoEntries.at(-1)?.label ?? ''; }
  get redoLabel(): string { return this.redoEntries.at(-1)?.label ?? ''; }
  snapshot(): T { return structuredClone(this.current); }

  begin(label: string): void {
    if (this.pending) throw new Error('Finish the previous editor stroke first.');
    this.pending = { label, value: this.snapshot() };
  }
  change(mutator: (draft: T) => void): void {
    if (!this.pending) throw new Error('Begin an edit before changing a document.');
    const draft = this.snapshot(); mutator(draft);
    this.current = structuredClone(this.validate(draft));
  }
  finish(): boolean {
    const pending = this.pending; this.pending = undefined;
    if (!pending || JSON.stringify(pending.value) === JSON.stringify(this.current)) return false;
    this.undoEntries.push(pending);
    if (this.undoEntries.length > this.limit) this.undoEntries.shift();
    this.redoEntries = [];
    return true;
  }
  cancel(): void {
    if (!this.pending) return;
    this.current = this.pending.value; this.pending = undefined;
  }
  edit(label: string, mutator: (draft: T) => void): boolean {
    this.begin(label);
    try { this.change(mutator); return this.finish(); }
    catch (error) { this.cancel(); throw error; }
  }
  replace(label: string, input: unknown): void {
    const next = structuredClone(this.validate(input));
    this.edit(label, draft => {
      for (const key of Object.keys(draft as object)) delete (draft as Record<string, unknown>)[key];
      Object.assign(draft as object, next);
    });
  }
  undo(): boolean {
    if (this.pending) this.cancel();
    const entry = this.undoEntries.pop(); if (!entry) return false;
    this.redoEntries.push({ label: entry.label, value: this.snapshot() });
    this.current = entry.value; return true;
  }
  redo(): boolean {
    if (this.pending) this.cancel();
    const entry = this.redoEntries.pop(); if (!entry) return false;
    this.undoEntries.push({ label: entry.label, value: this.snapshot() });
    this.current = entry.value; return true;
  }
}
