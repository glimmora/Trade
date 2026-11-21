/**
 * Immutable drawing state: add / select / move / resize / delete /
 * duplicate / lock / hide / z-order / clear-all, plus an undo/redo
 * command stack. Every operation returns a new state object; nothing
 * is mutated in place, so the state is safe to keep in a store or a
 * Web Worker and to snapshot for history.
 */
import { moveDrawing, resizeDrawing, rotateDrawing } from './geometry.js';
import type { ChartScale } from './geometry.js';
import type { AnchorPoint, DrawingObject } from './types.js';
import { createDrawingId, createDrawingObject, sortByZIndex } from './types.js';
import type { CreateDrawingInput } from './types.js';

export interface DrawingState {
  objects: DrawingObject[];
  selectedIds: string[];
}

export function emptyDrawingState(): DrawingState {
  return { objects: [], selectedIds: [] };
}

function withUpdatedAt(obj: DrawingObject): DrawingObject {
  return { ...obj, updatedAt: Date.now() };
}

function nextZIndex(objects: readonly DrawingObject[]): number {
  let max = -1;
  for (const o of objects) {
    max = Math.max(max, o.zIndex);
  }
  return max + 1;
}

/** Add a new drawing (built via `createDrawingObject`). Selects it. */
export function addDrawing(
  state: DrawingState,
  input: CreateDrawingInput,
): DrawingState {
  const obj = createDrawingObject({
    ...input,
    zIndex: input.zIndex ?? nextZIndex(state.objects),
  });
  return {
    objects: [...state.objects, obj],
    selectedIds: [obj.id],
  };
}

/** Add an already-built drawing object (e.g. from import). Selects it. */
export function addExistingDrawing(
  state: DrawingState,
  obj: DrawingObject,
): DrawingState {
  const withZ =
    state.objects.some((o) => o.zIndex === obj.zIndex) || obj.zIndex < 0
      ? { ...obj, zIndex: nextZIndex(state.objects) }
      : obj;
  return {
    objects: [...state.objects, withZ],
    selectedIds: [withZ.id],
  };
}

export function getDrawing(
  state: DrawingState,
  id: string,
): DrawingObject | null {
  return state.objects.find((o) => o.id === id) ?? null;
}

/** Replace one drawing with the result of an updater function. */
export function updateDrawing(
  state: DrawingState,
  id: string,
  update: (obj: DrawingObject) => DrawingObject,
): DrawingState {
  let changed = false;
  const objects = state.objects.map((o) => {
    if (o.id !== id) {
      return o;
    }
    changed = true;
    return withUpdatedAt(update(o));
  });
  return changed ? { ...state, objects } : state;
}

/** Move a drawing by a time/price delta (anchor space). */
export function moveDrawingInState(
  state: DrawingState,
  id: string,
  dTimeSeconds: number,
  dPrice: number,
): DrawingState {
  return updateDrawing(state, id, (o) => moveDrawing(o, dTimeSeconds, dPrice));
}

/** Replace one anchor of a drawing (resize). */
export function resizeDrawingInState(
  state: DrawingState,
  id: string,
  anchorIndex: number,
  newAnchor: AnchorPoint,
): DrawingState {
  return updateDrawing(state, id, (o) => resizeDrawing(o, anchorIndex, newAnchor));
}

/** Rotate a drawing around its centroid (pixel-space rotation). */
export function rotateDrawingInState(
  state: DrawingState,
  id: string,
  scale: ChartScale,
  angleRadians: number,
): DrawingState {
  return updateDrawing(state, id, (o) => rotateDrawing(o, scale, angleRadians));
}

/** Remove a drawing; also deselects it. */
export function deleteDrawing(state: DrawingState, id: string): DrawingState {
  return {
    objects: state.objects.filter((o) => o.id !== id),
    selectedIds: state.selectedIds.filter((s) => s !== id),
  };
}

/** Remove several drawings at once. */
export function deleteDrawings(state: DrawingState, ids: readonly string[]): DrawingState {
  const idSet = new Set(ids);
  return {
    objects: state.objects.filter((o) => !idSet.has(o.id)),
    selectedIds: state.selectedIds.filter((s) => !idSet.has(s)),
  };
}

/** Duplicate a drawing with a fresh id, on top, and select the copy. */
export function duplicateDrawing(state: DrawingState, id: string): DrawingState {
  const original = getDrawing(state, id);
  if (original === null) {
    return state;
  }
  const copy: DrawingObject = {
    ...original,
    id: createDrawingId(),
    zIndex: nextZIndex(state.objects),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    points: original.points.map((p) => ({ ...p })),
    style: { ...original.style },
    ...(original.label !== undefined
      ? { label: `${original.label} copy` }
      : {}),
    ...(original.position !== undefined
      ? { position: { ...original.position } }
      : {}),
  };
  return {
    objects: [...state.objects, copy],
    selectedIds: [copy.id],
  };
}

/** Toggle (or force) the locked flag. Locked drawings cannot be hit-tested. */
export function setLocked(
  state: DrawingState,
  id: string,
  locked: boolean,
): DrawingState {
  return updateDrawing(state, id, (o) => ({ ...o, locked }));
}

/** Toggle (or force) the hidden flag. Hidden drawings never render or hit. */
export function setHidden(
  state: DrawingState,
  id: string,
  hidden: boolean,
): DrawingState {
  return updateDrawing(state, id, (o) => ({ ...o, hidden }));
}

function reorderZ(
  state: DrawingState,
  id: string,
  direction: 'forward' | 'back' | 'front' | 'backmost',
): DrawingState {
  const sorted = sortByZIndex(state.objects);
  const index = sorted.findIndex((o) => o.id === id);
  if (index === -1) {
    return state;
  }
  const target = sorted[index];
  if (target === undefined) {
    return state;
  }
  let newIndex = index;
  if (direction === 'forward') {
    newIndex = Math.min(sorted.length - 1, index + 1);
  } else if (direction === 'back') {
    newIndex = Math.max(0, index - 1);
  } else if (direction === 'front') {
    newIndex = sorted.length - 1;
  } else {
    newIndex = 0;
  }
  if (newIndex === index) {
    return state;
  }
  const without = sorted.filter((o) => o.id !== id);
  without.splice(newIndex, 0, target);
  const objects = without.map((o, i) => ({ ...o, zIndex: i }));
  // Preserve the caller's original object order by id for stability.
  const byId = new Map(objects.map((o) => [o.id, o]));
  return {
    ...state,
    objects: state.objects.map((o) => byId.get(o.id) ?? o),
  };
}

export function bringForward(state: DrawingState, id: string): DrawingState {
  return reorderZ(state, id, 'forward');
}

export function sendBackward(state: DrawingState, id: string): DrawingState {
  return reorderZ(state, id, 'back');
}

export function bringToFront(state: DrawingState, id: string): DrawingState {
  return reorderZ(state, id, 'front');
}

export function sendToBack(state: DrawingState, id: string): DrawingState {
  return reorderZ(state, id, 'backmost');
}

/** Remove all drawings and clear the selection. The UI confirms first. */
export function clearAllDrawings(state: DrawingState): DrawingState {
  return { objects: [], selectedIds: [] };
}

/** Replace the selection with the given ids (unknown ids are dropped). */
export function selectDrawings(
  state: DrawingState,
  ids: readonly string[],
): DrawingState {
  const known = new Set(state.objects.map((o) => o.id));
  return { ...state, selectedIds: ids.filter((id) => known.has(id)) };
}

export function selectDrawing(state: DrawingState, id: string): DrawingState {
  return selectDrawings(state, [id]);
}

export function clearSelection(state: DrawingState): DrawingState {
  return { ...state, selectedIds: [] };
}

/** All drawings for one symbol, in z-order. */
export function drawingsForSymbol(
  state: DrawingState,
  symbol: string,
): DrawingObject[] {
  return sortByZIndex(state.objects.filter((o) => o.symbol === symbol));
}

/* ------------------------------------------------------------------ */
/* Undo / redo history (command stack, capped)                         */
/* ------------------------------------------------------------------ */

export const MAX_HISTORY = 100;

export interface DrawingHistory {
  past: DrawingState[];
  present: DrawingState;
  future: DrawingState[];
}

export function createHistory(initial: DrawingState = emptyDrawingState()): DrawingHistory {
  return { past: [], present: initial, future: [] };
}

export function canUndo(history: DrawingHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: DrawingHistory): boolean {
  return history.future.length > 0;
}

/**
 * Push a new present state. A no-op (same object reference) is ignored.
 * Redo history is cleared, and the past is capped at MAX_HISTORY.
 */
export function pushHistory(history: DrawingHistory, next: DrawingState): DrawingHistory {
  if (next === history.present) {
    return history;
  }
  const past = [...history.past, history.present];
  const capped = past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past;
  return { past: capped, present: next, future: [] };
}

export function undoHistory(history: DrawingHistory): DrawingHistory {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) {
    return history;
  }
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory(history: DrawingHistory): DrawingHistory {
  const next = history.future[0];
  if (next === undefined) {
    return history;
  }
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}
