import { describe, expect, it } from 'vitest';
import {
  deserializeDrawings,
  migrateDrawingsFile,
  serializeDrawings,
} from '../serialize.js';
import { createDrawingObject } from '../types.js';

const T0 = 1_700_000_000;

function sampleObjects() {
  return [
    createDrawingObject({
      symbol: 'BTC/USDT',
      type: 'trend-line',
      points: [
        { time: T0, price: 100 },
        { time: T0 + 600, price: 110 },
      ],
      id: 'drawing-1',
      createdAt: T0 * 1000,
      updatedAt: T0 * 1000,
    }),
    createDrawingObject({
      symbol: 'XAUT/USDT',
      type: 'long-position',
      points: [
        { time: T0, price: 100 },
        { time: T0, price: 90 },
        { time: T0 + 3600, price: 120 },
      ],
      position: { direction: 'long', entry: 100, stop: 90, target: 120, riskAmount: 50 },
      label: 'Setup A',
      id: 'drawing-2',
      createdAt: T0 * 1000,
      updatedAt: T0 * 1000,
    }),
  ];
}

describe('serialize / deserialize round-trip', () => {
  it('round-trips drawings exactly, including position data and labels', () => {
    const objects = sampleObjects();
    const json = serializeDrawings(objects, { symbol: 'BTC/USDT', exportedAt: 123 });
    expect(JSON.parse(json).version).toBe(1);
    expect(JSON.parse(json).app).toBe('trade');
    expect(JSON.parse(json).symbol).toBe('BTC/USDT');
    expect(deserializeDrawings(json)).toEqual(objects);
  });

  it('serializes an empty list', () => {
    expect(deserializeDrawings(serializeDrawings([]))).toEqual([]);
  });
});

describe('migration', () => {
  it('accepts a bare array of drawings (legacy format)', () => {
    const objects = sampleObjects();
    const migrated = migrateDrawingsFile(JSON.parse(serializeDrawings(objects)).objects);
    expect(migrated).toEqual(objects);
  });

  it('accepts an unversioned wrapper with an objects array', () => {
    const objects = sampleObjects();
    const migrated = migrateDrawingsFile({
      objects: JSON.parse(serializeDrawings(objects)).objects,
    });
    expect(migrated).toEqual(objects);
  });

  it('rejects unknown future versions', () => {
    expect(() => migrateDrawingsFile({ version: 99, app: 'trade', exportedAt: 1, objects: [] })).toThrow(
      /Unsupported drawings file version: 99/,
    );
  });

  it('rejects a non-object payload', () => {
    expect(() => migrateDrawingsFile('nope')).toThrow(/Invalid drawings file/);
    expect(() => migrateDrawingsFile(null)).toThrow(/Invalid drawings file/);
  });
});

describe('validation failures', () => {
  it('throws on invalid JSON', () => {
    expect(() => deserializeDrawings('{not json')).toThrow(/not valid JSON/);
  });

  it('throws on an unknown drawing type', () => {
    const bad = JSON.stringify({
      version: 1,
      app: 'trade',
      exportedAt: 1,
      objects: [
        {
          id: 'x',
          symbol: 'BTC/USDT',
          type: 'laser-beam',
          points: [{ time: T0, price: 100 }],
          style: { color: '#000', opacity: 1, thickness: 1, dash: 'solid' },
          locked: false,
          hidden: false,
          zIndex: 0,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    expect(() => deserializeDrawings(bad)).toThrow();
  });

  it('throws on an out-of-range opacity', () => {
    const objects = sampleObjects();
    const parsed = JSON.parse(serializeDrawings(objects)) as {
      objects: Array<Record<string, unknown>>;
    };
    const first = parsed.objects[0];
    if (first !== undefined) {
      first['style'] = { color: '#000', opacity: 2, thickness: 1, dash: 'solid' };
    }
    expect(() => deserializeDrawings(JSON.stringify(parsed))).toThrow();
  });
});
