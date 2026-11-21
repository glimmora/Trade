/**
 * Versioned JSON persistence for drawings, validated with zod.
 *
 * Format (v1):
 *   { "version": 1, "app": "trade", "exportedAt": <ms>, "objects": [...] }
 *
 * `migrateDrawingsFile` also accepts a bare array of drawing objects
 * (legacy / hand-written files) and wraps it as v1. Unknown future
 * versions are rejected rather than silently mangled.
 */
import { z } from 'zod';
import { DRAWING_TYPES } from './types.js';
import type { DrawingObject, DrawingType } from './types.js';

export const DRAWINGS_FILE_VERSION = 1 as const;

const anchorPointSchema = z.object({
  time: z.number().int(),
  price: z.number().finite(),
});

const dashStyleSchema = z.enum(['solid', 'dashed', 'dotted']);

const drawingStyleSchema = z.object({
  color: z.string().min(1),
  opacity: z.number().min(0).max(1),
  thickness: z.number().positive(),
  dash: dashStyleSchema,
  fill: z.string().min(1).optional(),
  fontSize: z.number().positive().optional(),
  showLabels: z.boolean().optional(),
});

const drawingTypeSchema = z.enum(
  DRAWING_TYPES as unknown as [DrawingType, ...DrawingType[]],
);

const positionToolDataSchema = z.object({
  direction: z.enum(['long', 'short']),
  entry: z.number().finite(),
  stop: z.number().finite(),
  target: z.number().finite(),
  riskAmount: z.number().finite().positive().optional(),
  accountSize: z.number().finite().positive().optional(),
});

export const drawingObjectSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1),
  type: drawingTypeSchema,
  points: z.array(anchorPointSchema).min(1),
  style: drawingStyleSchema,
  locked: z.boolean(),
  hidden: z.boolean(),
  zIndex: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  label: z.string().optional(),
  position: positionToolDataSchema.optional(),
  fibKind: z.enum(['retracement', 'extension']).optional(),
});

export const drawingsFileSchema = z.object({
  version: z.literal(DRAWINGS_FILE_VERSION),
  app: z.literal('trade'),
  exportedAt: z.number().int(),
  symbol: z.string().min(1).optional(),
  objects: z.array(drawingObjectSchema),
});

export type DrawingsFile = z.infer<typeof drawingsFileSchema>;

/**
 * Normalize a zod-parsed object into a clean `DrawingObject`, only
 * including optional fields when they are actually present. This keeps
 * the strict `exactOptionalPropertyTypes` contract intact.
 */
function toDrawingObject(parsed: z.infer<typeof drawingObjectSchema>): DrawingObject {
  return {
    id: parsed.id,
    symbol: parsed.symbol,
    type: parsed.type,
    points: parsed.points.map((p) => ({ time: p.time, price: p.price })),
    style: {
      color: parsed.style.color,
      opacity: parsed.style.opacity,
      thickness: parsed.style.thickness,
      dash: parsed.style.dash,
      ...(parsed.style.fill !== undefined ? { fill: parsed.style.fill } : {}),
      ...(parsed.style.fontSize !== undefined ? { fontSize: parsed.style.fontSize } : {}),
      ...(parsed.style.showLabels !== undefined
        ? { showLabels: parsed.style.showLabels }
        : {}),
    },
    locked: parsed.locked,
    hidden: parsed.hidden,
    zIndex: parsed.zIndex,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    ...(parsed.label !== undefined ? { label: parsed.label } : {}),
    ...(parsed.position !== undefined
      ? {
          position: {
            direction: parsed.position.direction,
            entry: parsed.position.entry,
            stop: parsed.position.stop,
            target: parsed.position.target,
            ...(parsed.position.riskAmount !== undefined
              ? { riskAmount: parsed.position.riskAmount }
              : {}),
            ...(parsed.position.accountSize !== undefined
              ? { accountSize: parsed.position.accountSize }
              : {}),
          },
        }
      : {}),
    ...(parsed.fibKind !== undefined ? { fibKind: parsed.fibKind } : {}),
  };
}

/**
 * Migrate an unknown parsed-JSON value to a v1 drawing list.
 * Accepts a v1 file object or a bare array of drawing objects.
 * Throws on unknown versions, wrong shapes, or invalid drawings.
 */
export function migrateDrawingsFile(value: unknown): DrawingObject[] {
  if (Array.isArray(value)) {
    // Legacy bare-array format: validate each entry as v1.
    return z.array(drawingObjectSchema).parse(value).map(toDrawingObject);
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (record.version === undefined && Array.isArray(record.objects)) {
      // Unversioned wrapper: treat the objects as v1.
      return z.array(drawingObjectSchema).parse(record.objects).map(toDrawingObject);
    }
    if (typeof record.version === 'number' && record.version !== DRAWINGS_FILE_VERSION) {
      throw new Error(
        `Unsupported drawings file version: ${String(record.version)} (expected ${String(DRAWINGS_FILE_VERSION)})`,
      );
    }
    return drawingsFileSchema.parse(value).objects.map(toDrawingObject);
  }
  throw new Error('Invalid drawings file: expected a v1 file object or an array of drawings');
}

export interface SerializeOptions {
  /** Optional symbol scope recorded in the file header. */
  symbol?: string;
  /** Explicit export timestamp (tests). Defaults to now. */
  exportedAt?: number;
}

/** Serialize drawings to a versioned JSON string (v1). */
export function serializeDrawings(
  objects: readonly DrawingObject[],
  options?: SerializeOptions,
): string {
  const file: DrawingsFile = {
    version: DRAWINGS_FILE_VERSION,
    app: 'trade',
    exportedAt: options?.exportedAt ?? Date.now(),
    objects: [...objects],
    ...(options?.symbol !== undefined ? { symbol: options.symbol } : {}),
  };
  return JSON.stringify(file, null, 2);
}

/** Parse a JSON string produced by `serializeDrawings` (or a legacy file). */
export function deserializeDrawings(json: string): DrawingObject[] {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    throw new Error('Invalid drawings file: not valid JSON');
  }
  return migrateDrawingsFile(value);
}

/** Export alias (file download in the UI). */
export const exportDrawingsFile = serializeDrawings;

/** Import alias (file upload in the UI). */
export const importDrawingsFile = deserializeDrawings;
