import { describe, expect, it } from 'vitest';
import {
  addDrawing,
  bringForward,
  bringToFront,
  canRedo,
  canUndo,
  clearAllDrawings,
  clearSelection,
  createHistory,
  deleteDrawing,
  drawingsForSymbol,
  duplicateDrawing,
  emptyDrawingState,
  getDrawing,
  MAX_HISTORY,
  moveDrawingInState,
  pushHistory,
  redoHistory,
  resizeDrawingInState,
  selectDrawing,
  sendBackward,
  sendToBack,
  setHidden,
  setLocked,
  undoHistory,
  updateDrawing,
} from '../store.js';
import type { DrawingState } from '../store.js';

const T0 = 1_700_000_000;

function trendInput(symbol = 'BTC/USDT') {
  return {
    symbol,
    type: 'trend-line' as const,
    points: [
      { time: T0, price: 100 },
      { time: T0 + 600, price: 110 },
    ],
  };
}

function stateWithTwoLines(): DrawingState {
  let state = emptyDrawingState();
  state = addDrawing(state, trendInput());
  const firstId = state.selectedIds[0];
  state = addDrawing(state, {
    ...trendInput(),
    points: [
      { time: T0, price: 200 },
      { time: T0 + 600, price: 210 },
    ],
  });
  return { ...state, selectedIds: firstId !== undefined ? [firstId] : [] };
}

describe('add / get / update', () => {
  it('adds a drawing and selects it', () => {
    const state = addDrawing(emptyDrawingState(), trendInput());
    expect(state.objects).toHaveLength(1);
    expect(state.selectedIds).toEqual([state.objects[0]?.id]);
    expect(state.objects[0]?.zIndex).toBe(0);
  });

  it('stacks z-indexes on successive adds', () => {
    const state = stateWithTwoLines();
    expect(state.objects.map((o) => o.zIndex)).toEqual([0, 1]);
  });

  it('rejects an invalid point list', () => {
    expect(() =>
      addDrawing(emptyDrawingState(), {
        symbol: 'BTC/USDT',
        type: 'trend-line',
        points: [{ time: T0, price: 100 }],
      }),
    ).toThrow(/at least 2/);
  });

  it('gets a drawing by id and returns null for unknown ids', () => {
    const state = addDrawing(emptyDrawingState(), trendInput());
    const id = state.objects[0]?.id ?? '';
    expect(getDrawing(state, id)?.id).toBe(id);
    expect(getDrawing(state, 'missing')).toBeNull();
  });

  it('updates, moves and resizes immutably', () => {
    const state = addDrawing(emptyDrawingState(), trendInput());
    const id = state.objects[0]?.id ?? '';
    const moved = moveDrawingInState(state, id, 60, 5);
    expect(moved.objects[0]?.points[0]).toEqual({ time: T0 + 60, price: 105 });
    expect(state.objects[0]?.points[0]).toEqual({ time: T0, price: 100 });
    const resized = resizeDrawingInState(state, id, 1, { time: T0 + 300, price: 120 });
    expect(resized.objects[0]?.points[1]).toEqual({ time: T0 + 300, price: 120 });
    const updated = updateDrawing(state, id, (o) => ({ ...o, locked: true }));
    expect(updated.objects[0]?.locked).toBe(true);
    expect(updateDrawing(state, 'missing', (o) => o)).toBe(state);
  });
});

describe('delete / duplicate', () => {
  it('deletes a drawing and deselects it', () => {
    const state = addDrawing(emptyDrawingState(), trendInput());
    const id = state.objects[0]?.id ?? '';
    const next = deleteDrawing(state, id);
    expect(next.objects).toHaveLength(0);
    expect(next.selectedIds).toHaveLength(0);
  });

  it('duplicates with a fresh id on top and selects the copy', () => {
    const state = addDrawing(emptyDrawingState(), trendInput());
    const id = state.objects[0]?.id ?? '';
    const next = duplicateDrawing(state, id);
    expect(next.objects).toHaveLength(2);
    const copy = next.objects[1];
    expect(copy?.id).not.toBe(id);
    expect(copy?.points).toEqual(state.objects[0]?.points);
    expect(copy?.zIndex).toBe(1);
    expect(next.selectedIds).toEqual([copy?.id]);
    expect(duplicateDrawing(state, 'missing')).toBe(state);
  });
});

describe('lock / hide / z-order', () => {
  it('toggles lock and hide', () => {
    const state = addDrawing(emptyDrawingState(), trendInput());
    const id = state.objects[0]?.id ?? '';
    expect(setLocked(state, id, true).objects[0]?.locked).toBe(true);
    expect(setHidden(state, id, true).objects[0]?.hidden).toBe(true);
    expect(setLocked(state, id, false).objects[0]?.locked).toBe(false);
  });

  it('reorders z-indexes', () => {
    const state = stateWithTwoLines();
    const [first, second] = state.objects;
    const firstId = first?.id ?? '';
    const secondId = second?.id ?? '';
    expect(bringForward(state, firstId).objects.find((o) => o.id === firstId)?.zIndex).toBe(1);
    expect(sendBackward(state, secondId).objects.find((o) => o.id === secondId)?.zIndex).toBe(0);
    expect(bringToFront(state, firstId).objects.find((o) => o.id === firstId)?.zIndex).toBe(1);
    expect(sendToBack(state, secondId).objects.find((o) => o.id === secondId)?.zIndex).toBe(0);
    // No-ops at the ends return the same state.
    expect(bringToFront(state, secondId)).toBe(state);
    expect(sendToBack(state, firstId)).toBe(state);
  });

  it('clears all drawings', () => {
    const state = clearAllDrawings(stateWithTwoLines());
    expect(state.objects).toHaveLength(0);
    expect(state.selectedIds).toHaveLength(0);
  });
});

describe('selection', () => {
  it('selects, drops unknown ids, and clears', () => {
    const state = stateWithTwoLines();
    const id = state.objects[0]?.id ?? '';
    const selected = selectDrawing(state, id);
    expect(selected.selectedIds).toEqual([id]);
    expect(selectDrawing(state, 'missing').selectedIds).toEqual([]);
    expect(clearSelection(selected).selectedIds).toEqual([]);
  });

  it('filters drawings by symbol in z-order', () => {
    let state = addDrawing(emptyDrawingState(), trendInput('BTC/USDT'));
    state = addDrawing(state, trendInput('XAUT/USDT'));
    expect(drawingsForSymbol(state, 'XAUT/USDT')).toHaveLength(1);
    expect(drawingsForSymbol(state, 'BTC/USDT')).toHaveLength(1);
    expect(drawingsForSymbol(state, 'XAU/USD')).toHaveLength(0);
  });
});

describe('undo / redo history', () => {
  it('undoes and redoes a push', () => {
    let history = createHistory();
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    const one = addDrawing(emptyDrawingState(), trendInput());
    history = pushHistory(history, one);
    expect(canUndo(history)).toBe(true);
    history = undoHistory(history);
    expect(history.present.objects).toHaveLength(0);
    expect(canRedo(history)).toBe(true);
    history = redoHistory(history);
    expect(history.present.objects).toHaveLength(1);
    // Undo at the start and redo at the end are no-ops.
    history = undoHistory(history);
    expect(undoHistory(history)).toBe(history);
    history = redoHistory(history);
    expect(redoHistory(history)).toBe(history);
  });

  it('clears redo history on a new push', () => {
    let history = createHistory();
    const one = addDrawing(emptyDrawingState(), trendInput());
    history = pushHistory(history, one);
    history = undoHistory(history);
    expect(canRedo(history)).toBe(true);
    history = pushHistory(history, one);
    expect(canRedo(history)).toBe(false);
  });

  it('ignores a push of the same state reference', () => {
    const history = createHistory();
    expect(pushHistory(history, history.present)).toBe(history);
  });

  it('caps the past at MAX_HISTORY', () => {
    let history = createHistory();
    for (let i = 0; i < MAX_HISTORY + 5; i += 1) {
      history = pushHistory(history, { objects: [], selectedIds: [] });
    }
    expect(history.past.length).toBe(MAX_HISTORY);
  });
});
