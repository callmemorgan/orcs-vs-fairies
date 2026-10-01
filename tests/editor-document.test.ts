import { describe, expect, it } from 'vitest';
import { EditorDocument } from '../src/editor/document';

interface Drawing { tiles: number[]; name: string }
function validate(value: unknown): Drawing {
  const record = value as Drawing;
  if (!record || !Array.isArray(record.tiles) || record.tiles.some(tile => !Number.isInteger(tile) || tile < 0 || tile > 3) || typeof record.name !== 'string') throw new Error('Invalid drawing.');
  return structuredClone(record);
}
describe('editor document changes', () => {
  it('groups a drag into one undo and redo without sharing caller objects', () => {
    const original = { tiles: [0, 0, 0], name: 'Before' }, model = new EditorDocument(original, validate);
    original.tiles[0] = 3;
    model.begin('Paint ridge'); model.change(draft => { draft.tiles[0] = 1; }); model.change(draft => { draft.tiles[1] = 2; }); model.finish();
    expect(model.value.tiles).toEqual([1, 2, 0]); expect(model.undoLabel).toBe('Paint ridge');
    expect(model.undo()).toBe(true); expect(model.value.tiles).toEqual([0, 0, 0]);
    expect(model.redo()).toBe(true); expect(model.value.tiles).toEqual([1, 2, 0]); expect(model.undo()).toBe(true); expect(model.undo()).toBe(false);
  });
  it('preserves the current document and redo after invalid import and failed mutation', () => {
    const model = new EditorDocument({ tiles: [0, 0], name: 'Original' }, validate);
    model.edit('Raise', draft => { draft.tiles[0] = 1; }); model.undo();
    expect(() => model.replace('Import', { tiles: [9], name: 'Invalid' })).toThrow('Invalid drawing');
    expect(model.value).toEqual({ tiles: [0, 0], name: 'Original' }); expect(model.canRedo).toBe(true);
    expect(() => model.edit('Broken edit', draft => { draft.tiles[0] = 9; })).toThrow('Invalid drawing');
    expect(model.value).toEqual({ tiles: [0, 0], name: 'Original' }); expect(model.redo()).toBe(true); expect(model.value.tiles).toEqual([1, 0]);
  });
  it('drops redo only after a different committed change and bounds history', () => {
    const model = new EditorDocument({ tiles: [0], name: 'Original' }, validate, 2);
    model.edit('First', draft => { draft.name = 'One'; }); model.edit('Second', draft => { draft.name = 'Two'; }); model.edit('Third', draft => { draft.name = 'Three'; });
    model.undo(); model.undo(); expect(model.value.name).toBe('One'); expect(model.undo()).toBe(false);
    model.edit('Branch', draft => { draft.name = 'New branch'; }); expect(model.canRedo).toBe(false);
    model.begin('Cancel stroke'); model.change(draft => { draft.tiles[0] = 2; }); model.cancel(); expect(model.value.tiles).toEqual([0]);
  });
});
